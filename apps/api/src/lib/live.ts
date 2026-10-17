/**
 * Fan-out en vivo: Postgres ya guardó. Aquí solo se avisa por Redis
 * para que streaming-data reenvíe a los WebSockets del partido.
 * Si Redis no está, el 201 del API no falla — la ficha sigue recargando.
 */
import Redis from 'ioredis';
import { matchLiveChannel } from '@parches/config';
import type { WSMessage, WSMessageType } from '@parches/types';

const pub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
pub.on('error', err => {
  console.error('live redis', err.message);
});

export async function publishScoreboard(matchId: string, data: unknown): Promise<void> {
  await publish(matchId, 'score_update', data);
}

export async function publishMatchStatus(matchId: string, data: unknown): Promise<void> {
  await publish(matchId, 'match_status', data);
}

async function publish(matchId: string, type: WSMessageType, data: unknown): Promise<void> {
  const msg: WSMessage = {
    type,
    matchId,
    data,
    timestamp: new Date().toISOString(),
  };
  try {
    await pub.publish(matchLiveChannel(matchId), JSON.stringify(msg));
  } catch (err) {
    console.error('live publish failed', err instanceof Error ? err.message : err);
  }
}

export async function publishMatchLive(opts: {
  matchId: string;
  event: {
    id: string;
    type: string;
    clock: string;
    teamId?: string | null;
    playerName?: string | null;
    description?: string | null;
    createdAt: Date | string;
  };
  score?: { homeScore: number; awayScore: number } | null;
  clock?: string | null;
  period?: string | null;
  clockSeconds?: number;
  clockRunning?: boolean;
  clockEpoch?: string | null;
  periodIndex?: number;
}): Promise<void> {
  const timestamp = typeof opts.event.createdAt === 'string'
    ? opts.event.createdAt
    : opts.event.createdAt.toISOString();

  const jobs: Promise<void>[] = [];
  if (opts.score) {
    jobs.push(publish(opts.matchId, 'score_update', {
      homeScore: opts.score.homeScore,
      awayScore: opts.score.awayScore,
      ...(opts.clock ? { clock: opts.clock } : {}),
      ...(opts.period ? { period: opts.period } : {}),
      ...(opts.clockSeconds !== undefined ? { clockSeconds: opts.clockSeconds } : {}),
      ...(opts.clockRunning !== undefined ? { clockRunning: opts.clockRunning } : {}),
      ...(opts.clockEpoch !== undefined ? { clockEpoch: opts.clockEpoch } : {}),
      ...(opts.periodIndex !== undefined ? { periodIndex: opts.periodIndex } : {}),
    }));
  }
  jobs.push(publish(opts.matchId, 'event', {
    id: opts.event.id,
    type: opts.event.type,
    clock: opts.event.clock,
    teamId: opts.event.teamId ?? undefined,
    playerName: opts.event.playerName ?? undefined,
    description: opts.event.description ?? undefined,
    timestamp,
  }));
  await Promise.all(jobs);
}
