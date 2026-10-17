/**
 * Un evento de gol mueve el marcador. Dorsales se resuelven contra la plantilla.
 * El catálogo por deporte vive en @parches/config.
 */
import type { Prisma } from '@prisma/client';
import {
  isEventAllowedForSport,
  isKnownMatchEventType,
  MATCH_EVENT_LABELS,
  SPORT_LABELS,
} from '@parches/config';
import { prisma } from './prisma.js';
import { parseJersey } from './enrollments.js';

const IN_PLAY = new Set(['LIVE', 'HALFTIME']);

export function badRequest(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

export function assertEventTypeForSport(sport: string, type: string): void {
  if (isEventAllowedForSport(sport, type)) return;
  if (!isKnownMatchEventType(type)) {
    badRequest('El tipo de evento no es válido');
  }
  const eventLabel = MATCH_EVENT_LABELS[type];
  const sportLabel = SPORT_LABELS[sport] ?? sport;
  badRequest(`${eventLabel} no se puede registrar en ${sportLabel}`);
}

type Db = Prisma.TransactionClient | typeof prisma;

function sideDelta(
  teamId: string,
  homeTeamId: string,
  awayTeamId: string,
  amount: number
): { home: number; away: number } {
  const isHome = teamId === homeTeamId;
  const isAway = teamId === awayTeamId;
  if (!isHome && !isAway) badRequest('El equipo no juega este partido');
  return isHome ? { home: amount, away: 0 } : { home: 0, away: amount };
}

export function readPoints(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1) badRequest('Los puntos deben ser un entero positivo');
  return n;
}

export function pointsDescription(opts: {
  sport: string;
  points: number;
  jersey?: number;
}): string {
  const n = opts.jersey != null ? ` #${opts.jersey}` : '';
  if (opts.sport === 'volleyball') return `Punto${n}`;
  if (opts.points === 1) return `Libre${n}`;
  if (opts.points === 2) return `Doble${n}`;
  if (opts.points === 3) return `Triple${n}`;
  return `+${opts.points}${n}`;
}

export function scoreDeltaForEvent(opts: {
  type: string;
  sport: string;
  teamId?: string | null;
  ownGoal?: boolean;
  points?: number;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
}): { home: number; away: number } | null {
  if (opts.type !== 'goal' && opts.type !== 'score_update') return null;

  if (!IN_PLAY.has(opts.status)) {
    badRequest('El partido no está en juego');
  }
  const teamId = opts.teamId?.trim();
  if (!teamId) {
    badRequest(opts.type === 'goal' ? 'El gol necesita un equipo' : 'Los puntos necesitan un equipo');
  }

  if (opts.type === 'score_update') {
    const points = opts.points;
    if (opts.sport === 'basketball' && (points !== 1 && points !== 2 && points !== 3)) {
      badRequest('En baloncesto suma 1, 2 o 3');
    }
    if (opts.sport === 'volleyball' && points !== 1) {
      badRequest('En vóleibol suma de a 1');
    }
    if (opts.sport !== 'basketball' && opts.sport !== 'volleyball') {
      badRequest(`Los puntos no se pueden registrar en ${SPORT_LABELS[opts.sport] ?? opts.sport}`);
    }
    return sideDelta(teamId, opts.homeTeamId, opts.awayTeamId, points!);
  }

  const isHome = teamId === opts.homeTeamId;
  const isAway = teamId === opts.awayTeamId;
  if (!isHome && !isAway) badRequest('El equipo no juega este partido');

  // En contra: suma el rival. Anotador: suma este equipo.
  if (opts.ownGoal) {
    return isHome ? { home: 0, away: 1 } : { home: 1, away: 0 };
  }
  return isHome ? { home: 1, away: 0 } : { home: 0, away: 1 };
}

export async function assertEligibleToScore(
  db: Db,
  opts: { matchId: string; playerProfileId: string; name?: string },
): Promise<void> {
  const [red, yellows] = await Promise.all([
    db.matchEvent.findFirst({
      where: { matchId: opts.matchId, playerId: opts.playerProfileId, type: 'red_card' },
      select: { id: true },
    }),
    db.matchEvent.count({
      where: { matchId: opts.matchId, playerId: opts.playerProfileId, type: 'yellow_card' },
    }),
  ]);
  if (red || yellows >= 2) {
    const who = opts.name?.trim() || 'Ese jugador';
    badRequest(`${who} está expulsado`);
  }
}

export async function playerByJersey(
  db: Db,
  opts: { teamId: string; tournamentId: string; jersey: number; teamLabel?: string }
) {
  const row = await db.playerEnrollment.findFirst({
    where: {
      teamId: opts.teamId,
      tournamentId: opts.tournamentId,
      jerseyNumber: opts.jersey,
      isActive: true,
    },
    include: { playerProfile: { include: { user: { select: { name: true } } } } },
  });
  if (!row) {
    const where = opts.teamLabel ? ` en ${opts.teamLabel}` : ' en ese equipo';
    badRequest(`No hay dorsal #${opts.jersey}${where}`);
  }
  return {
    playerProfileId: row.playerProfileId,
    name: row.playerProfile.user.name,
    jersey: opts.jersey,
  };
}

export function cardDescription(type: string, jersey?: number): string {
  const n = jersey != null ? ` #${jersey}` : '';
  if (type === 'yellow_card') return `Amarilla${n}`;
  if (type === 'red_card') return `Roja${n}`;
  if (type === 'foul') return `Falta${n}`;
  if (type === 'substitution') return `Cambio${n}`;
  return MATCH_EVENT_LABELS[type as keyof typeof MATCH_EVENT_LABELS] ?? type;
}

export function isCardEvent(type: string): boolean {
  return type === 'yellow_card' || type === 'red_card';
}

export function isJerseyNote(type: string): boolean {
  return isCardEvent(type) || type === 'foul' || type === 'substitution';
}

function assistPlayerIdFrom(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const id = (payload as { assistPlayerId?: unknown }).assistPlayerId;
  return typeof id === 'string' && id ? id : undefined;
}

export async function withPlayerNames<T extends { playerId?: string | null; payload?: unknown }>(
  events: T[]
): Promise<Array<T & { playerName: string | null; assistPlayerName: string | null }>> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.playerId) ids.add(event.playerId);
    const assistId = assistPlayerIdFrom(event.payload);
    if (assistId) ids.add(assistId);
  }
  if (ids.size === 0) {
    return events.map(event => ({ ...event, playerName: null, assistPlayerName: null }));
  }
  const rows = await prisma.playerProfile.findMany({
    where: { id: { in: [...ids] } },
    include: { user: { select: { name: true } } },
  });
  const names = new Map(rows.map(row => [row.id, row.user.name]));
  return events.map(event => ({
    ...event,
    playerName: event.playerId ? names.get(event.playerId) ?? null : null,
    assistPlayerName: assistPlayerIdFrom(event.payload)
      ? names.get(assistPlayerIdFrom(event.payload)!) ?? null
      : null,
  }));
}

export function goalDescription(opts: {
  ownGoal: boolean;
  scorerJersey?: number;
  assistJersey?: number;
}): string {
  if (opts.ownGoal) {
    return opts.scorerJersey != null ? `Gol en contra #${opts.scorerJersey}` : 'Gol en contra';
  }
  const scorer = opts.scorerJersey != null ? `#${opts.scorerJersey}` : null;
  const assist = opts.assistJersey != null ? `asistencia #${opts.assistJersey}` : null;
  if (scorer && assist) return `Gol ${scorer}, ${assist}`;
  if (scorer) return `Gol ${scorer}`;
  return 'Gol';
}

export function readOwnGoal(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === '1' || raw === 'on';
}

export function readOptionalJersey(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = parseJersey(raw);
  return n === null || n === undefined ? undefined : n;
}
