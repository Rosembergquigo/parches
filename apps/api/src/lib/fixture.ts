/**
 * fixture.ts — todos-contra-todos (método del círculo).
 *
 * Una vuelta: cada pareja se enfrenta una vez.
 * Ida y vuelta: la segunda mitad invierte local/visita.
 * Número impar de equipos: hay un bye por jornada (no se crea partido).
 *
 * El `stage` queda "Jornada N" para que el strip del fixture agrupe
 * por fecha, también cuando hay grupos (todos juegan la misma jornada).
 */
export interface PlannedMatch {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  stage: string;
}

const BYE = '__BYE__';

/** Parejas de una liga / un grupo. `round` es 1-based. */
export function circleRoundRobin(
  teamIds: string[],
  double = false
): { round: number; homeTeamId: string; awayTeamId: string }[] {
  const unique = [...new Set(teamIds.filter(Boolean))];
  if (unique.length < 2) return [];

  const teams = [...unique];
  if (teams.length % 2 === 1) teams.push(BYE);

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = [...teams];
  const pairs: { round: number; homeTeamId: string; awayTeamId: string }[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a === BYE || b === BYE) continue;
      const homeFirst = (r + i) % 2 === 0;
      pairs.push({
        round: r + 1,
        homeTeamId: homeFirst ? a : b,
        awayTeamId: homeFirst ? b : a,
      });
    }
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }

  if (double) {
    for (const p of [...pairs]) {
      pairs.push({
        round: p.round + rounds,
        homeTeamId: p.awayTeamId,
        awayTeamId: p.homeTeamId,
      });
    }
  }

  return pairs;
}

export function roundRobinMatchCount(teamCount: number, double = false): number {
  if (teamCount < 2) return 0;
  const single = (teamCount * (teamCount - 1)) / 2;
  return double ? single * 2 : single;
}

/** Varios grupos (o uno solo = liga). Las jornadas se alinean por número. */
export function planFixture(
  buckets: { teamIds: string[] }[],
  double = false
): PlannedMatch[] {
  const planned: PlannedMatch[] = [];
  for (const bucket of buckets) {
    for (const pair of circleRoundRobin(bucket.teamIds, double)) {
      planned.push({
        ...pair,
        stage: `Jornada ${pair.round}`,
      });
    }
  }
  return planned.sort((a, b) => a.round - b.round || a.homeTeamId.localeCompare(b.homeTeamId));
}

/** Reparte las jornadas entre start y end, a la hora `kickoff` (HH:MM, UTC). */
export function dateForRound(
  round: number,
  roundCount: number,
  start: Date,
  end: Date,
  kickoff = '15:00'
): Date {
  const [hh, mm] = kickoff.split(':').map(Number);
  const hours = Number.isFinite(hh) ? hh! : 15;
  const minutes = Number.isFinite(mm) ? mm! : 0;
  const startMs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    hours,
    minutes
  );
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
    hours,
    minutes
  );
  if (roundCount <= 1) return new Date(startMs);
  const span = endMs - startMs;
  const week = 7 * 24 * 60 * 60 * 1000;
  const step = span > 0 ? span / (roundCount - 1) : week;
  return new Date(startMs + step * (round - 1));
}
