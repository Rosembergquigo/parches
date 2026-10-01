import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PlayerEnrollment, PlayerProfile, User } from '@prisma/client';
import { prisma } from './prisma.js';
import { requireTeamRosterAccess } from './authz.js';
import { toTitleCase } from './text.js';

export type EnrollmentWithPlayer = PlayerEnrollment & {
  playerProfile: PlayerProfile & { user: User };
};

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function parseJersey(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    throw Object.assign(new Error('El dorsal debe ser un entero entre 0 y 99'), { statusCode: 400 });
  }
  return n;
}

export function toEnrollmentDto(e: EnrollmentWithPlayer) {
  const user = e.playerProfile.user;
  return {
    id: e.id,
    jerseyNumber: e.jerseyNumber,
    position: e.position,
    isActive: e.isActive,
    joinedAt: e.joinedAt,
    player: {
      id: user.id,
      playerProfileId: e.playerProfileId,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  };
}

/** Editor del torneo o capitán del equipo. */
export async function teamForEditor(req: FastifyRequest, reply: FastifyReply, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { tournament: true },
  });
  if (!team) {
    reply.status(404).send({ error: 'Not found' });
    return null;
  }
  if (!(await requireTeamRosterAccess(req, reply, team))) return null;
  return team;
}

/** Busca o crea User + PlayerProfile. El correo es la llave de negocio. */
export async function ensurePlayerUser(opts: {
  email: string;
  name?: string;
  phone?: string | null;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
    include: { playerProfile: true },
  });

  if (!existing) {
    const name = toTitleCase(opts.name ?? '');
    if (!name) {
      throw Object.assign(new Error('El nombre es obligatorio para un jugador nuevo'), { statusCode: 400 });
    }
    return prisma.user.create({
      data: {
        email: opts.email,
        name,
        role: 'PLAYER',
        phone: opts.phone?.trim() || null,
        playerProfile: { create: {} },
      },
      include: { playerProfile: true },
    });
  }

  let user = existing;
  if (!user.playerProfile) {
    const playerProfile = await prisma.playerProfile.create({ data: { userId: user.id } });
    user = { ...user, playerProfile };
  }
  const data: { role?: 'PLAYER'; phone?: string } = {};
  if (user.role === 'VIEWER') data.role = 'PLAYER';
  const phone = opts.phone?.trim();
  if (phone && !user.phone) data.phone = phone;
  if (Object.keys(data).length > 0) {
    user = await prisma.user.update({
      where: { id: user.id },
      data,
      include: { playerProfile: true },
    });
  }
  return user;
}

export async function loadEnrollment(id: string, teamId: string) {
  return prisma.playerEnrollment.findFirst({
    where: { id, teamId },
    include: { playerProfile: { include: { user: true } } },
  });
}

const TEAM_COLORS = [
  '#00e5ff', '#f97316', '#22c55e', '#a855f7',
  '#eab308', '#ef4444', '#3b82f6', '#ec4899',
];

export function teamColorForIndex(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length]!;
}

/** Hex #rrggbb. `undefined` si no vino, `null` si vacío, lanza si es inválido. */
export function parseTeamColor(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw Object.assign(new Error('El color no es válido'), { statusCode: 400 });
  }
  const hex = (raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) {
    throw Object.assign(new Error('El color debe ser un hex de 6 dígitos'), { statusCode: 400 });
  }
  return hex;
}

/** Solo fotos subidas a /uploads/teams/. */
export function parseTeamImageUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !/^\/uploads\/teams\/[A-Za-z0-9._-]+$/.test(raw.trim())) {
    throw Object.assign(new Error('La foto no es válida'), { statusCode: 400 });
  }
  return raw.trim();
}

/** Abreviación 2–4 A-Z/0-9, única en el torneo. "Danilo Torres" → DT. */
export async function uniqueTeamShortName(tournamentId: string, displayName: string): Promise<string> {
  const taken = new Set(
    (await prisma.team.findMany({
      where: { tournamentId },
      select: { shortName: true },
    })).map(t => t.shortName.toUpperCase()),
  );
  const ascii = displayName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim();
  const parts = ascii.split(/\s+/).filter(Boolean);
  let base = parts.length >= 2
    ? `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`
    : (parts[0] ?? 'JN').slice(0, 2);
  base = base.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (base.length < 2) base = `${base}XX`.slice(0, 2);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const suffix = String(n);
    const candidate = `${base.slice(0, Math.max(1, 4 - suffix.length))}${suffix}`.toUpperCase();
    if (/^[A-Z0-9]{2,4}$/.test(candidate) && !taken.has(candidate)) return candidate;
  }
  return `J${String(Date.now()).slice(-3)}`;
}

/** Una sola inscripción por torneo (activo o no). Otros torneos / deportes sí se permiten. */
export async function findEnrollmentInTournament(playerProfileId: string, tournamentId: string) {
  return prisma.playerEnrollment.findUnique({
    where: { playerProfileId_tournamentId: { playerProfileId, tournamentId } },
    include: { team: { select: { id: true, name: true, shortName: true } } },
  });
}

export function sameTournamentConflict(team: { id: string; name: string }) {
  return {
    error: `Este jugador ya está inscrito en ${team.name} en este torneo`,
    teamId: team.id,
    teamName: team.name,
  };
}

export type CaptainFields = {
  captainName: string;
  captainEmail: string;
  captainPhone: string;
  captainUserId: string | null;
};

/** Nombre, correo y celular de contacto. Si el correo ya es un User, lo enlaza. */
export async function parseCaptain(
  body: { captainName?: unknown; captainEmail?: unknown; captainPhone?: unknown },
  required: boolean
): Promise<CaptainFields | null> {
  const name = toTitleCase(typeof body.captainName === 'string' ? body.captainName : '');
  const emailRaw = typeof body.captainEmail === 'string' ? body.captainEmail.trim() : '';
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const phone = typeof body.captainPhone === 'string' ? body.captainPhone.trim() : '';
  const any = !!(name || emailRaw || phone);

  if (!any && !required) return null;
  if (emailRaw && !email) {
    throw Object.assign(new Error('El correo del capitán no es válido'), { statusCode: 400 });
  }
  if (!name || !email || !phone) {
    throw Object.assign(new Error('El capitán requiere nombre, correo y celular'), { statusCode: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return {
    captainName: name,
    captainEmail: email,
    captainPhone: phone,
    captainUserId: user?.id ?? null,
  };
}
