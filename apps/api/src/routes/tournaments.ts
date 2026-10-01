import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueTournamentSlug, tournamentWhere } from '../lib/slug.js';
import { requireTournamentEditor, userIdFrom } from '../lib/authz.js';
import type { TournamentPostCategory } from '@prisma/client';
import { dateForRound, planFixture } from '../lib/fixture.js';
import { toTitleCase } from '../lib/text.js';
import { isIndividualSport } from '@parches/config';
import {
  ensurePlayerUser,
  findEnrollmentInTournament,
  parseCaptain,
  parseTeamColor,
  sameTournamentConflict,
  teamColorForIndex,
  uniqueTeamShortName,
} from '../lib/enrollments.js';
import { notifyCaptainAssigned, kickoffRemindedValue, notifyMatchKickoff } from '../lib/notify.js';
import { withPlayerPhotos, withTournamentLooks } from '../lib/playerPhoto.js';
import {
  computeStandings,
  computeCompiledQualifiers,
  computeCrossmatches,
  computeCleanSheets,
  type QualifierRow,
  type Crossmatch,
} from '../lib/standings.js';

/** Iniciales para el avatar placeholder ("Danilo Torres" → "DT"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface PlayerStatRow {
  position: number;
  playerName: string;
  playerShortName: string;
  playerAvatarUrl?: string | null;
  userId?: string;
  team: { id: string; name: string; shortName: string };
  statValue: number;
  statLabel?: string;
}

interface PlayerStatTab {
  id: string;
  tabLabel: string;
  colHeader: string;
  rows: PlayerStatRow[];
}

type EnrollmentWithStats = Prisma.PlayerEnrollmentGetPayload<{
  include: { team: true; playerProfile: { include: { user: true } }; tournamentStats: true };
}>;

/** Un tab de leaderboard = un campo numérico de PlayerTournamentStat.stats a rankear. */
interface LeaderboardDef {
  id: string;
  tabLabel: string;
  colHeader: string;
  statKey: string;
}

/**
 * Tabs de "Estadísticas" por deporte — todas rankean un campo de
 * PlayerTournamentStat.stats (JSON libre, ver prisma/schema.prisma).
 * Fútbol además agrega "Valla menos vencida" aparte (ver más abajo),
 * porque esa se calcula de los marcadores, no de stats de jugador.
 */
const SPORT_LEADERBOARDS: Record<string, LeaderboardDef[]> = {
  football: [{ id: 'scorers', tabLabel: 'Goleadores', colHeader: 'Goles', statKey: 'goals' }],
  basketball: [
    { id: 'scorers', tabLabel: 'Anotadores', colHeader: 'Pts', statKey: 'points' },
    { id: 'rebounders', tabLabel: 'Reboteadores', colHeader: 'Reb', statKey: 'rebounds' },
    { id: 'assists', tabLabel: 'Asistencias', colHeader: 'Ast', statKey: 'assists' },
  ],
  volleyball: [
    { id: 'scorers', tabLabel: 'Anotadores', colHeader: 'Pts', statKey: 'points' },
    { id: 'acers', tabLabel: 'Aces', colHeader: 'Aces', statKey: 'aces' },
  ],
};

/** Rankea las inscripciones por `def.statKey` — genérico para cualquier deporte/stat. */
function buildLeaderboardTab(enrollments: EnrollmentWithStats[], def: LeaderboardDef): PlayerStatTab | null {
  const rows = enrollments
    .map(e => ({
      e,
      value: Number((e.tournamentStats?.stats as Record<string, unknown> | undefined)?.[def.statKey] ?? 0),
      matchesPlayed: e.tournamentStats?.matchesPlayed ?? 0,
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((x, i): PlayerStatRow => ({
      position: i + 1,
      playerName: x.e.playerProfile.user.name,
      playerShortName: initials(x.e.playerProfile.user.name),
      playerAvatarUrl: x.e.playerProfile.user.avatarUrl?.trim() || null,
      userId: x.e.playerProfile.user.id,
      team: { id: x.e.team.id, name: x.e.team.name, shortName: x.e.team.shortName },
      statValue: x.value,
      statLabel: `${x.matchesPlayed} partido${x.matchesPlayed === 1 ? '' : 's'}`,
    }));

  return rows.length > 0 ? { id: def.id, tabLabel: def.tabLabel, colHeader: def.colHeader, rows } : null;
}

function sendParseError(reply: FastifyReply, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return reply.status(e.statusCode ?? 400).send({ error: e.message });
}

const TOURNAMENT_STATUSES = ['UPCOMING', 'LIVE', 'FINISHED'] as const;
type TournamentStatusValue = (typeof TOURNAMENT_STATUSES)[number];

function parseTournamentStatus(raw: unknown): TournamentStatusValue | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !(TOURNAMENT_STATUSES as readonly string[]).includes(raw)) {
    throw Object.assign(new Error('El estado no es válido'), { statusCode: 400 });
  }
  return raw as TournamentStatusValue;
}

function parseTournamentDate(raw: unknown): Date | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw Object.assign(new Error('La fecha no es válida'), { statusCode: 400 });
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('La fecha no es válida'), { statusCode: 400 });
  }
  return date;
}

/** Logo o portada: `/uploads/tournaments/...` o URL http(s). */
function parseTournamentMediaUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw Object.assign(new Error('La imagen no es válida'), { statusCode: 400 });
  }
  const value = raw.trim();
  if (/^\/uploads\/tournaments\/[A-Za-z0-9._-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (/^\/uploads\/tournaments\/[A-Za-z0-9._-]+$/.test(url.pathname)) return url.pathname;
      return value;
    }
  } catch {
    /* fall through */
  }
  throw Object.assign(new Error('La imagen no es válida'), { statusCode: 400 });
}

export const tournamentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const matchInclude = {
      homeTeam: true,
      awayTeam: true,
      referee: { select: { id: true, name: true } },
    } as const;

    const [tournaments, liveMatches] = await Promise.all([
      prisma.tournament.findMany({
        include: {
          organization: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true } },
          teams: true,
          matches: {
            include: matchInclude,
            where: { status: { notIn: ['LIVE', 'HALFTIME'] } },
            orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
            take: 6,
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.match.findMany({
        where: { status: { in: ['LIVE', 'HALFTIME'] } },
        include: matchInclude,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    const liveByTournament = new Map<string, typeof liveMatches>();
    for (const match of liveMatches) {
      const list = liveByTournament.get(match.tournamentId) ?? [];
      list.push(match);
      liveByTournament.set(match.tournamentId, list);
    }

    return reply.send(await Promise.all(
      tournaments.map(async tournament => withTournamentLooks({
        ...tournament,
        matches: [...(liveByTournament.get(tournament.id) ?? []), ...tournament.matches],
      })),
    ));
  });

  // :idOrSlug acepta el uuid del torneo o su slug ("liga-betplay-2025").
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        organization: { select: { id: true, slug: true, name: true, logoUrl: true, brandColor: true } },
        teams: { include: { group: true } },
        groups: { orderBy: { order: 'asc' } },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
            referee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    return reply.send(await withTournamentLooks(tournament));
  });

  const POST_CATEGORIES = new Set<TournamentPostCategory>(['COMUNICADO', 'NOTICIA', 'ANUNCIO']);

  function excerptFrom(body: string, excerpt?: string): string | null {
    const text = (excerpt ?? body).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  }

  const postInclude = { author: { select: { id: true, name: true } } } as const;

  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/posts', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    const posts = await prisma.tournamentPost.findMany({
      where: { tournamentId: tournament.id },
      include: postInclude,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return reply.send(posts);
  });

  app.get<{ Params: { idOrSlug: string; postId: string } }>('/:idOrSlug/posts/:postId', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    const post = await prisma.tournamentPost.findFirst({
      where: { id: req.params.postId, tournamentId: tournament.id },
      include: postInclude,
    });
    if (!post) return reply.status(404).send({ error: 'Not found' });
    return reply.send(post);
  });

  app.post<{
    Params: { idOrSlug: string };
    Body: {
      category?: string;
      title: string;
      body: string;
      excerpt?: string;
      coverImageUrl?: string;
      imageUrls?: string[];
      pinned?: boolean;
    };
  }>('/:idOrSlug/posts', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

    const title = String(req.body?.title ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    if (!title || !body) {
      return reply.status(400).send({ error: 'title and body are required' });
    }

    const rawCategory = String(req.body?.category ?? 'NOTICIA').toUpperCase();
    const category = POST_CATEGORIES.has(rawCategory as TournamentPostCategory)
      ? (rawCategory as TournamentPostCategory)
      : 'NOTICIA';

    const imageUrls = (req.body?.imageUrls ?? []).filter(u => typeof u === 'string' && u.startsWith('/uploads/'));
    const coverImageUrl = req.body?.coverImageUrl?.startsWith('/uploads/')
      ? req.body.coverImageUrl
      : imageUrls[0];

    const post = await prisma.tournamentPost.create({
      data: {
        tournamentId: tournament.id,
        authorId: userIdFrom(req),
        category,
        title,
        body,
        excerpt: excerptFrom(body, req.body?.excerpt),
        coverImageUrl,
        imageUrls,
        pinned: Boolean(req.body?.pinned),
      },
      include: postInclude,
    });
    return reply.status(201).send(post);
  });

  app.patch<{
    Params: { idOrSlug: string; postId: string };
    Body: {
      category?: string;
      title?: string;
      body?: string;
      excerpt?: string;
      coverImageUrl?: string;
      imageUrls?: string[];
      pinned?: boolean;
    };
  }>('/:idOrSlug/posts/:postId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

    const existing = await prisma.tournamentPost.findFirst({
      where: { id: req.params.postId, tournamentId: tournament.id },
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
    const body = req.body?.body !== undefined ? String(req.body.body).trim() : existing.body;
    if (!title || !body) {
      return reply.status(400).send({ error: 'title and body are required' });
    }

    const rawCategory = String(req.body?.category ?? existing.category).toUpperCase();
    const category = POST_CATEGORIES.has(rawCategory as TournamentPostCategory)
      ? (rawCategory as TournamentPostCategory)
      : existing.category;

    const imageUrls = Array.isArray(req.body?.imageUrls)
      ? req.body.imageUrls.filter(u => typeof u === 'string' && u.startsWith('/uploads/'))
      : existing.imageUrls;
    const coverImageUrl = req.body?.coverImageUrl?.startsWith('/uploads/')
      ? req.body.coverImageUrl
      : imageUrls[0] ?? existing.coverImageUrl;

    const post = await prisma.tournamentPost.update({
      where: { id: existing.id },
      data: {
        category,
        title,
        body,
        excerpt: excerptFrom(body, req.body?.excerpt),
        coverImageUrl,
        imageUrls,
        pinned: req.body?.pinned === undefined ? existing.pinned : Boolean(req.body.pinned),
      },
      include: postInclude,
    });
    return reply.send(post);
  });

  app.delete<{ Params: { idOrSlug: string; postId: string } }>(
    '/:idOrSlug/posts/:postId',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
      const existing = await prisma.tournamentPost.findFirst({
        where: { id: req.params.postId, tournamentId: tournament.id },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      await prisma.tournamentPost.delete({ where: { id: existing.id } });
      return reply.status(204).send();
    }
  );

  app.post<{
    Body: {
      organizationId: string;
      name: string;
      sport: string;
      startDate: string;
      endDate: string;
      brandColor?: string;
      logoUrl?: string;
      backgroundImageUrl?: string;
      description?: string;
      hasPlayoffs?: boolean;
      qualifyingSpots?: number;
    };
  }>('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!req.body?.organizationId) {
      return reply.status(400).send({ error: 'organizationId is required' });
    }
    const org = await prisma.organization.findUnique({ where: { id: req.body.organizationId } });
    if (!org) return reply.status(404).send({ error: 'Organization not found' });
    if (!(await requireTournamentEditor(req, reply, org.id))) return;

    const slug = await generateUniqueTournamentSlug(req.body.name);
    const { organizationId, ...rest } = req.body;
    const tournament = await prisma.tournament.create({
      data: { ...rest, slug, organizationId },
    });
    return reply.status(201).send(tournament);
  });

  app.patch<{
    Params: { idOrSlug: string };
    Body: Partial<{
      name: string;
      sport: string;
      status: 'UPCOMING' | 'LIVE' | 'FINISHED';
      startDate: string;
      endDate: string;
      brandColor: string;
      logoUrl: string | null;
      backgroundImageUrl: string | null;
      description: string | null;
      hasPlayoffs: boolean;
      qualifyingSpots: number | null;
    }>;
  }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, existing.organizationId))) return;

    const body = req.body ?? {};
    const data: {
      name?: string;
      sport?: string;
      status?: TournamentStatusValue;
      startDate?: Date;
      endDate?: Date;
      brandColor?: string | null;
      logoUrl?: string | null;
      backgroundImageUrl?: string | null;
      description?: string | null;
      hasPlayoffs?: boolean;
      qualifyingSpots?: number | null;
    } = {};

    try {
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return reply.status(400).send({ error: 'name is required' });
        }
        data.name = body.name.trim();
      }
      if (typeof body.sport === 'string' && body.sport.trim()) data.sport = body.sport.trim();
      const status = parseTournamentStatus(body.status);
      if (status !== undefined) data.status = status;
      const startDate = parseTournamentDate(body.startDate);
      if (startDate !== undefined) data.startDate = startDate;
      const endDate = parseTournamentDate(body.endDate);
      if (endDate !== undefined) data.endDate = endDate;
      if (body.brandColor !== undefined) {
        const color = parseTeamColor(body.brandColor);
        if (color !== undefined) data.brandColor = color;
      }
      if (body.logoUrl !== undefined) {
        const logo = parseTournamentMediaUrl(body.logoUrl);
        if (logo !== undefined) data.logoUrl = logo;
      }
      if (body.backgroundImageUrl !== undefined) {
        const cover = parseTournamentMediaUrl(body.backgroundImageUrl);
        if (cover !== undefined) data.backgroundImageUrl = cover;
      }
      if (body.description !== undefined) {
        data.description = typeof body.description === 'string' ? (body.description.trim() || null) : null;
      }
      if (body.hasPlayoffs !== undefined) data.hasPlayoffs = Boolean(body.hasPlayoffs);
      if (body.qualifyingSpots !== undefined) {
        data.qualifyingSpots = body.qualifyingSpots === null ? null : Number(body.qualifyingSpots);
      }
    } catch (err) {
      return sendParseError(reply, err);
    }

    const nextStart = data.startDate ?? existing.startDate;
    const nextEnd = data.endDate ?? existing.endDate;
    if (nextStart > nextEnd) {
      return reply.status(400).send({ error: 'La fecha de inicio no puede ser posterior al fin' });
    }

    const tournament = await prisma.tournament.update({ where: { id: existing.id }, data });
    return reply.send(tournament);
  });

  app.delete<{ Params: { idOrSlug: string } }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, existing.organizationId))) return;
    try {
      await prisma.match.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.team.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.group.deleteMany({ where: { tournamentId: existing.id } });
      await prisma.tournament.delete({ where: { id: existing.id } });
    } catch {
      return reply.status(409).send({ error: 'Could not delete tournament (referenced by other records)' });
    }
    return reply.status(204).send();
  });

  // ── Nested: Teams ────────────────────────────────────────────
  app.post<{
    Params: { idOrSlug: string };
    Body: {
      name: string;
      shortName: string;
      color?: string;
      logoUrl?: string;
      groupId?: string;
      captainName?: string;
      captainEmail?: string;
      captainPhone?: string;
    };
  }>('/:idOrSlug/teams', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    const body = req.body ?? {};
    const individual = isIndividualSport(tournament.sport);
    const name = toTitleCase(String(body.name ?? ''));
    if (!name) return reply.status(400).send({ error: individual ? 'El nombre del jugador es obligatorio' : 'El nombre del equipo es obligatorio' });

    let shortName = String(body.shortName ?? '').trim().toUpperCase();
    if (shortName && !/^[A-Z0-9]{2,4}$/.test(shortName)) {
      return reply.status(400).send({ error: 'La abreviación debe tener 2–4 letras o números' });
    }

    let captain: Awaited<ReturnType<typeof parseCaptain>> = null;
    try {
      captain = await parseCaptain(
        individual
          ? {
              captainName: body.captainName || name,
              captainEmail: body.captainEmail,
              captainPhone: body.captainPhone,
            }
          : body,
        individual,
      );
      if (!shortName) {
        shortName = individual
          ? await uniqueTeamShortName(tournament.id, name)
          : '';
      }
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.status(e.statusCode ?? 400).send({ error: e.message });
    }
    if (!shortName) {
      return reply.status(400).send({ error: 'La abreviación debe tener 2–4 letras o números' });
    }

    let individualColor: string | null = null;
    if (individual && captain?.captainEmail) {
      const player = await prisma.user.findUnique({
        where: { email: captain.captainEmail },
        include: { playerProfile: true },
      });
      const profileId = player?.playerProfile?.id;
      if (profileId) {
        const existing = await findEnrollmentInTournament(profileId, tournament.id);
        if (existing?.isActive) {
          return reply.status(409).send(sameTournamentConflict(existing.team));
        }
      }
      const teamCount = await prisma.team.count({ where: { tournamentId: tournament.id } });
      individualColor = player?.color?.trim() || teamColorForIndex(teamCount);
    }

    const team = await prisma.team.create({
      data: {
        name,
        shortName,
        color: individual ? individualColor : (body.color?.trim() || null),
        logoUrl: individual ? null : (body.logoUrl?.trim() || null),
        groupId: body.groupId?.trim() || null,
        tournamentId: tournament.id,
        ...(captain ?? {}),
      },
    });

    let created = team;
    if (individual && captain) {
      try {
        const player = await ensurePlayerUser({
          email: captain.captainEmail,
          name: captain.captainName,
          phone: captain.captainPhone,
        });
        const playerProfileId = player.playerProfile?.id;
        if (playerProfileId) {
          const prior = await findEnrollmentInTournament(playerProfileId, tournament.id);
          if (prior && !prior.isActive) {
            await prisma.playerEnrollment.update({
              where: { id: prior.id },
              data: { isActive: true, teamId: created.id },
            });
          } else if (!prior) {
            await prisma.playerEnrollment.create({
              data: {
                playerProfileId,
                teamId: created.id,
                tournamentId: tournament.id,
                isActive: true,
              },
            });
          }
        }
        if (!created.captainUserId) {
          created = await prisma.team.update({
            where: { id: created.id },
            data: { captainUserId: player.id },
          });
        }
      } catch (err) {
        await prisma.playerEnrollment.deleteMany({ where: { teamId: created.id } }).catch(() => undefined);
        await prisma.team.delete({ where: { id: created.id } }).catch(() => undefined);
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 400).send({ error: e.message });
      }
    } else if (captain?.captainEmail) {
      notifyCaptainAssigned({
        teamId: created.id,
        captainName: captain.captainName,
        captainEmail: captain.captainEmail,
      });
    }
    return reply.status(201).send(
      individual ? (await withPlayerPhotos(tournament.sport, [created]))[0]! : created,
    );
  });

  function entryDto(team: { id: string; name: string; shortName: string }, enrollmentId: string) {
    return { teamId: team.id, teamName: team.name, shortName: team.shortName, enrollmentId };
  }

  app.get<{ Params: { idOrSlug: string } }>(
    '/:idOrSlug/entries/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      const user = await prisma.user.findUnique({
        where: { id: userIdFrom(req) },
        include: { playerProfile: true },
      });
      const playerProfileId = user?.playerProfile?.id;
      if (!playerProfileId) return reply.status(404).send({ error: 'Not found' });
      const enrollment = await findEnrollmentInTournament(playerProfileId, tournament.id);
      if (!enrollment || !enrollment.isActive) return reply.status(404).send({ error: 'Not found' });
      return reply.send(entryDto(enrollment.team, enrollment.id));
    },
  );

  /**
   * Autoinscripción en deporte individual: crea un Team de una persona
   * (nombre = jugador) y lo mete en la plantilla. El organizador sigue
   * pudiendo cargar inscripciones desde Equipos.
   */
  app.post<{
    Params: { idOrSlug: string };
    Body: { color?: string; logoUrl?: string };
  }>(
    '/:idOrSlug/entries',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!isIndividualSport(tournament.sport)) {
        return reply.status(400).send({ error: 'Este torneo no admite inscripción individual' });
      }
      if (tournament.status === 'FINISHED') {
        return reply.status(400).send({ error: 'Las inscripciones están cerradas' });
      }

      const actor = await prisma.user.findUnique({ where: { id: userIdFrom(req) } });
      if (!actor) return reply.status(401).send({ error: 'Unauthorized' });

      let player: Awaited<ReturnType<typeof ensurePlayerUser>>;
      try {
        player = await ensurePlayerUser({
          email: actor.email,
          name: actor.name,
          phone: actor.phone,
        });
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 400).send({ error: e.message });
      }
      const playerProfileId = player.playerProfile?.id;
      if (!playerProfileId) {
        return reply.status(500).send({ error: 'No se pudo crear el perfil de jugador' });
      }

      const existing = await findEnrollmentInTournament(playerProfileId, tournament.id);
      if (existing) {
        if (existing.isActive) {
          return reply.status(409).send({
            error: 'Ya estás inscrito en este torneo',
            ...entryDto(existing.team, existing.id),
          });
        }
        const reactivated = await prisma.playerEnrollment.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        return reply.send(entryDto(existing.team, reactivated.id));
      }

      const name = toTitleCase(player.name);
      const [shortName, teamCount] = await Promise.all([
        uniqueTeamShortName(tournament.id, name),
        prisma.team.count({ where: { tournamentId: tournament.id } }),
      ]);

      try {
        const created = await prisma.$transaction(async (tx) => {
          const team = await tx.team.create({
            data: {
              name,
              shortName,
              color: actor.color?.trim() || teamColorForIndex(teamCount),
              tournamentId: tournament.id,
              captainName: name,
              captainEmail: player.email.trim().toLowerCase(),
              captainPhone: player.phone?.trim() || null,
              captainUserId: player.id,
            },
          });
          const enrollment = await tx.playerEnrollment.create({
            data: {
              playerProfileId,
              teamId: team.id,
              tournamentId: tournament.id,
              isActive: true,
            },
          });
          return { team, enrollment };
        });
        return reply.status(201).send(entryDto(created.team, created.enrollment.id));
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'P2002') {
          const conflict = await findEnrollmentInTournament(playerProfileId, tournament.id);
          if (conflict) {
            return reply.status(409).send({
              error: 'Ya estás inscrito en este torneo',
              ...entryDto(conflict.team, conflict.id),
            });
          }
        }
        throw err;
      }
    },
  );

  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/teams', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      include: { group: true },
      orderBy: { name: 'asc' },
    });
    return reply.send(teams);
  });

  // ── Nested: Groups ───────────────────────────────────────────
  app.post<{ Params: { idOrSlug: string }; Body: { label: string; order?: number } }>(
    '/:idOrSlug/groups',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
      try {
        const group = await prisma.group.create({
          data: { label: req.body.label, order: req.body.order ?? 0, tournamentId: tournament.id },
        });
        return reply.status(201).send(group);
      } catch {
        return reply.status(409).send({ error: 'A group with that label already exists in this tournament' });
      }
    }
  );

  // ── Nested: Matches (partido regular, fuera de cruces) ────────
  app.post<{
    Params: { idOrSlug: string };
    Body: {
      homeTeamId: string;
      awayTeamId: string;
      scheduledAt?: string;
      venue?: string;
      stage?: string;
      refereeId?: string;
    };
  }>('/:idOrSlug/matches', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({ where: tournamentWhere(req.params.idOrSlug) });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;
    if (req.body.homeTeamId === req.body.awayTeamId) {
      return reply.status(400).send({ error: 'homeTeamId and awayTeamId must differ' });
    }
    const teamIds = [req.body.homeTeamId, req.body.awayTeamId];
    const teams = await prisma.team.count({
      where: { tournamentId: tournament.id, id: { in: teamIds } },
    });
    if (teams !== 2) {
      return reply.status(400).send({ error: 'Both teams must belong to this tournament' });
    }
    const refereeId = req.body.refereeId?.trim() || undefined;
    if (refereeId) {
      const referee = await prisma.user.findFirst({ where: { id: refereeId, role: 'REFEREE' } });
      if (!referee) return reply.status(400).send({ error: 'refereeId is not a referee' });
    }
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined;
    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: req.body.homeTeamId,
        awayTeamId: req.body.awayTeamId,
        status: 'SCHEDULED',
        scheduledAt,
        kickoffRemindedAt: scheduledAt ? kickoffRemindedValue(scheduledAt) : undefined,
        venue: req.body.venue?.trim() || undefined,
        stage: req.body.stage?.trim() || undefined,
        refereeId,
      },
      include: { homeTeam: true, awayTeam: true, referee: { select: { id: true, name: true } } },
    });
    if (scheduledAt) notifyMatchKickoff(match.id, 'scheduled');
    return reply.status(201).send(match);
  });

  /**
   * GET /api/tournaments/:idOrSlug/standings
   *
   * Tabla de posiciones calculada al vuelo desde los Match FINISHED
   * (no se persiste — así una corrección de marcador se refleja al
   * instante). Si el torneo tiene Group rows, devuelve una tabla por
   * grupo; si no, una sola tabla con todos los equipos.
   *
   * Cuando `hasPlayoffs` + `qualifyingSpots` están configurados y hay
   * más de un grupo, además incluye `compiled` (tabla compilada de
   * clasificados) y `crossmatches` (cruces sugeridos: 1° vs último,
   * 2° vs penúltimo... con bye al equipo del medio si el total es impar).
   */
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/standings', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        groups: { orderBy: { order: 'asc' }, include: { teams: true } },
        teams: true,
        matches: true,
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });

    const looked = await withTournamentLooks(tournament);
    const groupBuckets = looked.groups.length > 0
      ? looked.groups.map(g => ({ id: g.id, label: g.label, teams: g.teams }))
      : [{ id: 'all', label: 'Tabla de posiciones', teams: looked.teams }];

    const groups = groupBuckets.map(g => ({
      id: g.id,
      label: g.label,
      standings: computeStandings(g.teams, looked.matches),
    }));

    const response: {
      groups: typeof groups;
      compiled?: QualifierRow[];
      crossmatches?: Crossmatch[];
    } = { groups };

    if (tournament.hasPlayoffs && tournament.qualifyingSpots && groups.length > 1) {
      const compiled = computeCompiledQualifiers(groups, tournament.qualifyingSpots);
      response.compiled = compiled;
      response.crossmatches = computeCrossmatches(compiled);
    }

    return reply.send(response);
  });

  /**
   * GET /api/tournaments/:idOrSlug/player-stats
   *
   * Tabs de estadísticas de jugadores calculadas al vuelo (igual que
   * /standings, no se persisten). Los tabs de ranking (goleadores,
   * anotadores, reboteadores...) salen de SPORT_LEADERBOARDS y rankean
   * un campo de PlayerTournamentStat.stats — agregar un deporte nuevo
   * es solo agregar una entrada ahí.
   *
   * Fútbol además suma "Valla menos vencida": partidos FINISHED sin
   * recibir gol, por equipo (no requiere un arquero inscrito — se
   * calcula desde los marcadores, igual que la tabla de posiciones).
   *
   * Devuelve `[]` si el deporte no tiene leaderboards definidos o no
   * hay datos suficientes, así el frontend simplemente no muestra la
   * pestaña "Estadísticas".
   */
  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug/player-stats', async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: { teams: true, matches: true },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });

    const tabs: PlayerStatTab[] = [];

    const leaderboardDefs = SPORT_LEADERBOARDS[tournament.sport];
    if (leaderboardDefs?.length) {
      const enrollments = await prisma.playerEnrollment.findMany({
        where: { tournamentId: tournament.id, isActive: true },
        include: { team: true, playerProfile: { include: { user: true } }, tournamentStats: true },
      });

      for (const def of leaderboardDefs) {
        const tab = buildLeaderboardTab(enrollments, def);
        if (tab) tabs.push(tab);
      }
    }

    if (tournament.sport === 'football') {
      const cleanSheets = computeCleanSheets(tournament.teams, tournament.matches)
        .filter(row => row.played > 0)
        .map((row, i): PlayerStatRow => ({
          position: i + 1,
          playerName: row.team.name,
          playerShortName: row.team.shortName,
          team: { id: row.team.id, name: row.team.name, shortName: row.team.shortName },
          statValue: row.cleanSheets,
          statLabel: `${row.goalsAgainst} gol${row.goalsAgainst === 1 ? '' : 'es'} en contra`,
        }));

      if (cleanSheets.length > 0) {
        tabs.push({ id: 'cleansheets', tabLabel: 'Valla menos vencida', colHeader: 'Vallas', rows: cleanSheets });
      }
    }

    return reply.send(tabs);
  });

  /**
   * POST /api/tournaments/:idOrSlug/fixture/generate
   *
   * Arma el todos-contra-todos (liga o por grupo) como Match SCHEDULED
   * con stage="Jornada N". Las fechas se reparte entre startDate y
   * endDate del torneo.
   *
   * Si ya hay partidos de liga (no cruces) → 409, salvo `{ force: true }`
   * y que ninguno esté LIVE/FINISHED — en ese caso se reemplazan los
   * SCHEDULED.
   */
  app.post<{
    Params: { idOrSlug: string };
    Body: {
      doubleRound?: boolean;
      venue?: string;
      kickoff?: string;
      force?: boolean;
    };
  }>('/:idOrSlug/fixture/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const tournament = await prisma.tournament.findFirst({
      where: tournamentWhere(req.params.idOrSlug),
      include: {
        groups: { orderBy: { order: 'asc' }, include: { teams: true } },
        teams: true,
      },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

    const kickoff = req.body?.kickoff && /^\d{1,2}:\d{2}$/.test(req.body.kickoff)
      ? req.body.kickoff
      : '15:00';
    const doubleRound = !!req.body?.doubleRound;
    const venue = req.body?.venue?.trim() || undefined;

    const buckets = tournament.groups.length > 0
      ? tournament.groups.map(g => ({ teamIds: g.teams.map(t => t.id) }))
      : [{ teamIds: tournament.teams.map(t => t.id) }];

    const planned = planFixture(buckets, doubleRound);
    if (planned.length === 0) {
      return reply.status(400).send({ error: 'Need at least 2 teams (per group, if grouped) to generate a fixture' });
    }

    const played = await prisma.match.count({
      where: {
        tournamentId: tournament.id,
        status: { in: ['LIVE', 'HALFTIME', 'FINISHED'] },
        NOT: { stage: 'Cruces' },
      },
    });
    if (played > 0) {
      return reply.status(409).send({ error: 'Cannot regenerate fixture: some matches have already been played' });
    }

    const existing = await prisma.match.count({
      where: { tournamentId: tournament.id, NOT: { stage: 'Cruces' } },
    });
    if (existing > 0 && !req.body?.force) {
      return reply.status(409).send({
        error: 'Fixture already generated for this tournament. Pass { force: true } to replace scheduled matches.',
      });
    }
    if (existing > 0 && req.body?.force) {
      await prisma.match.deleteMany({
        where: { tournamentId: tournament.id, status: 'SCHEDULED', NOT: { stage: 'Cruces' } },
      });
    }

    const roundCount = planned.reduce((max, m) => Math.max(max, m.round), 1);
    await prisma.match.createMany({
      data: planned.map(m => ({
        tournamentId: tournament.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        status: 'SCHEDULED' as const,
        stage: m.stage,
        venue,
        scheduledAt: dateForRound(m.round, roundCount, tournament.startDate, tournament.endDate, kickoff),
      })),
    });

    return reply.status(201).send({
      count: planned.length,
      rounds: roundCount,
      doubleRound,
    });
  });

  /**
   * POST /api/tournaments/:idOrSlug/crossmatches/generate
   *
   * Materializa los cruces sugeridos (ver GET .../standings) como Match
   * reales con stage="Cruces". Requiere hasPlayoffs + qualifyingSpots
   * configurados y al menos 2 grupos.
   *
   * Idempotente: si ya existen cruces generados devuelve 409, salvo que
   * se envíe `{ force: true }` — en ese caso solo se reemplazan los que
   * siguen SCHEDULED (nunca se tocan cruces ya jugados/en vivo).
   */
  app.post<{ Params: { idOrSlug: string }; Body: { force?: boolean } }>(
    '/:idOrSlug/crossmatches/generate',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const tournament = await prisma.tournament.findFirst({
        where: tournamentWhere(req.params.idOrSlug),
        include: { groups: { include: { teams: true } }, matches: true },
      });
      if (!tournament) return reply.status(404).send({ error: 'Not found' });
      if (!(await requireTournamentEditor(req, reply, tournament.organizationId))) return;

      if (!tournament.hasPlayoffs || !tournament.qualifyingSpots) {
        return reply.status(400).send({
          error: 'Tournament has no playoff policy configured (hasPlayoffs / qualifyingSpots)',
        });
      }
      if (tournament.groups.length < 2) {
        return reply.status(400).send({ error: 'Crossmatches require at least 2 groups' });
      }

      const existing = await prisma.match.findMany({
        where: { tournamentId: tournament.id, stage: 'Cruces' },
      });
      if (existing.length > 0 && !req.body?.force) {
        return reply.status(409).send({
          error: 'Crossmatches already generated for this tournament. Pass { force: true } to regenerate.',
          matches: existing,
        });
      }
      if (existing.length > 0 && req.body?.force) {
        // Solo se reemplazan cruces que no han arrancado — nunca se
        // borran partidos ya jugados o en vivo.
        await prisma.match.deleteMany({
          where: { tournamentId: tournament.id, stage: 'Cruces', status: 'SCHEDULED' },
        });
      }

      const groups = tournament.groups.map(g => ({
        label: g.label,
        standings: computeStandings(g.teams, tournament.matches),
      }));
      const compiled = computeCompiledQualifiers(groups, tournament.qualifyingSpots);
      const crossmatches = computeCrossmatches(compiled);

      const pairs = crossmatches.filter(
        (cm): cm is Crossmatch & { teamB: QualifierRow } => cm.teamB !== null
      );
      const byes = crossmatches.filter(cm => cm.teamB === null);

      const created = await prisma.$transaction(
        pairs.map(cm =>
          prisma.match.create({
            data: {
              tournamentId: tournament.id,
              homeTeamId: cm.teamA.team.id,
              awayTeamId: cm.teamB.team.id,
              status: 'SCHEDULED',
              stage: 'Cruces',
              period: `${cm.seedA}° vs ${cm.seedB}°`,
            },
            include: { homeTeam: true, awayTeam: true },
          })
        )
      );

      return reply.status(201).send({
        matches: created,
        byes: byes.map(b => ({ seed: b.seedA, team: b.teamA.team })),
      });
    }
  );
};
