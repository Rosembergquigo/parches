/**
 * Stats del jugador: el evento ya está en Postgres; aquí se acumulan
 * goles/puntos/tarjetas en el partido y en el torneo (el perfil lee esto).
 */
import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

function asStatMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function mergeStats(base: unknown, delta: Record<string, number>): Record<string, number> {
  const next = asStatMap(base);
  for (const [k, v] of Object.entries(delta)) {
    if (!v) continue;
    next[k] = (next[k] ?? 0) + v;
  }
  return next;
}

async function applyPlayerStatDelta(
  db: Db,
  opts: {
    playerProfileId: string;
    matchId: string;
    teamId: string;
    tournamentId: string;
    delta: Record<string, number>;
  },
): Promise<void> {
  if (!Object.values(opts.delta).some(v => v)) return;

  const matchRow = await db.playerMatchStat.findUnique({
    where: {
      playerProfileId_matchId: {
        playerProfileId: opts.playerProfileId,
        matchId: opts.matchId,
      },
    },
  });
  const matchStats = mergeStats(matchRow?.stats, opts.delta);
  if (matchRow) {
    await db.playerMatchStat.update({
      where: { id: matchRow.id },
      data: { stats: matchStats },
    });
  } else {
    await db.playerMatchStat.create({
      data: {
        playerProfileId: opts.playerProfileId,
        matchId: opts.matchId,
        teamId: opts.teamId,
        stats: matchStats,
      },
    });
  }

  const enrollment = await db.playerEnrollment.findUnique({
    where: {
      playerProfileId_tournamentId: {
        playerProfileId: opts.playerProfileId,
        tournamentId: opts.tournamentId,
      },
    },
    include: { tournamentStats: true },
  });
  if (!enrollment) return;

  const tournamentStats = mergeStats(enrollment.tournamentStats?.stats, opts.delta);
  if (enrollment.tournamentStats) {
    await db.playerTournamentStat.update({
      where: { id: enrollment.tournamentStats.id },
      data: { stats: tournamentStats },
    });
  } else {
    await db.playerTournamentStat.create({
      data: {
        enrollmentId: enrollment.id,
        stats: tournamentStats,
      },
    });
  }
}

export async function applyMatchEventStats(
  db: Db,
  opts: {
    type: string;
    matchId: string;
    tournamentId: string;
    teamId?: string | null;
    playerId?: string | null;
    assistPlayerId?: string | null;
    ownGoal?: boolean;
    points?: number;
  },
): Promise<void> {
  const teamId = opts.teamId?.trim();
  if (!teamId) return;

  if (opts.type === 'goal' && opts.playerId && !opts.ownGoal) {
    await applyPlayerStatDelta(db, {
      playerProfileId: opts.playerId,
      matchId: opts.matchId,
      teamId,
      tournamentId: opts.tournamentId,
      delta: { goals: 1 },
    });
  }
  if (opts.type === 'goal' && opts.assistPlayerId && !opts.ownGoal) {
    await applyPlayerStatDelta(db, {
      playerProfileId: opts.assistPlayerId,
      matchId: opts.matchId,
      teamId,
      tournamentId: opts.tournamentId,
      delta: { assists: 1 },
    });
  }
  if (opts.type === 'score_update' && opts.playerId && opts.points) {
    await applyPlayerStatDelta(db, {
      playerProfileId: opts.playerId,
      matchId: opts.matchId,
      teamId,
      tournamentId: opts.tournamentId,
      delta: { points: opts.points },
    });
  }
  if (opts.type === 'yellow_card' && opts.playerId) {
    await applyPlayerStatDelta(db, {
      playerProfileId: opts.playerId,
      matchId: opts.matchId,
      teamId,
      tournamentId: opts.tournamentId,
      delta: { yellowCards: 1 },
    });
  }
  if (opts.type === 'red_card' && opts.playerId) {
    await applyPlayerStatDelta(db, {
      playerProfileId: opts.playerId,
      matchId: opts.matchId,
      teamId,
      tournamentId: opts.tournamentId,
      delta: { redCards: 1 },
    });
  }
}
