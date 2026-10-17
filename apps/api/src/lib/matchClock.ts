/**
 * Reloj del partido. Postgres es la verdad; Redis solo avisa el cambio de estado.
 */
import {
  clockDisplay,
  defaultFootballFormat,
  footballNextStep,
  formatMatchClock,
  isFootballPenalties,
  maxPeriodIndex,
  parseFootballFormat,
  resolvedClockSeconds,
  sportHasTickClock,
  type FootballMatchFormat,
} from '@parches/utils';
import { badRequest } from './matchScore.js';

export type ClockFormatOpts = {
  format?: FootballMatchFormat | null;
  stage?: string | null;
};

export function formatFromTournament(tournament: {
  sport: string;
  periodMinutes?: unknown;
  extraTimeMinutes?: unknown;
  extraTimeStages?: unknown;
  penaltyStages?: unknown;
}): FootballMatchFormat | null {
  if (tournament.sport !== 'football') return null;
  return parseFootballFormat(tournament);
}

export type ClockAction = 'start' | 'pause' | 'next';

export type ClockRow = {
  status: string;
  clockElapsed: number;
  clockRunning: boolean;
  clockEpoch: Date | null;
  periodIndex: number;
  clock: string | null;
  period: string | null;
};

export function resolveClock(
  sport: string,
  row: ClockRow,
  now = Date.now(),
  fmt?: ClockFormatOpts,
) {
  const periodIndex = Math.max(1, row.periodIndex || 1);
  const format = fmt?.format ?? (sport === 'football' ? defaultFootballFormat() : null);
  const stage = fmt?.stage;
  if (sport === 'football' && isFootballPenalties(periodIndex)) {
    const clockSeconds = Math.max(0, row.clockElapsed);
    return {
      clockSeconds,
      clockElapsed: clockSeconds,
      clockRunning: false,
      clockEpoch: null as Date | null,
      periodIndex,
      clock: formatMatchClock('football', clockSeconds),
      period: 'Penales',
    };
  }
  if (!sportHasTickClock(sport)) {
    const display = clockDisplay(sport, 0, periodIndex, format, stage);
    return {
      clockSeconds: 0,
      clockElapsed: 0,
      clockRunning: false,
      clockEpoch: null as Date | null,
      periodIndex,
      clock: display.clock,
      period: display.period,
    };
  }
  const clockSeconds = resolvedClockSeconds({
    elapsed: row.clockElapsed,
    running: row.clockRunning,
    epoch: row.clockEpoch,
    now,
  });
  const display = clockDisplay(sport, clockSeconds, periodIndex, format, stage);
  return {
    clockSeconds,
    clockElapsed: row.clockElapsed,
    clockRunning: row.clockRunning,
    clockEpoch: row.clockRunning ? row.clockEpoch : null,
    periodIndex,
    clock: display.clock,
    period: display.period,
  };
}

export function freezeClock(sport: string, row: ClockRow, now = new Date(), fmt?: ClockFormatOpts) {
  const resolved = resolveClock(sport, row, now.getTime(), fmt);
  return {
    clockElapsed: resolved.clockSeconds,
    clockRunning: false,
    clockEpoch: null as Date | null,
    periodIndex: resolved.periodIndex,
    clock: resolved.clock,
    period: resolved.period,
  };
}

export function applyClockAction(opts: {
  sport: string;
  action: ClockAction;
  row: ClockRow;
  now?: Date;
  format?: FootballMatchFormat | null;
  stage?: string | null;
  homeScore?: number;
  awayScore?: number;
}): {
  data: {
    clockElapsed: number;
    clockRunning: boolean;
    clockEpoch: Date | null;
    periodIndex: number;
    clock: string;
    period: string;
  };
  periodEnd?: boolean;
  periodStart?: boolean;
} {
  const now = opts.now ?? new Date();
  const sport = opts.sport;
  const row = opts.row;
  if (row.status !== 'LIVE' && row.status !== 'HALFTIME') {
    badRequest('El partido no está en juego');
  }

  const fmt: ClockFormatOpts = { format: opts.format, stage: opts.stage };

  if (opts.action === 'next') {
    const current = resolveClock(sport, row, now.getTime(), fmt);
    if (sport === 'football') {
      const step = footballNextStep({
        format: opts.format ?? defaultFootballFormat(),
        stage: opts.stage,
        periodIndex: current.periodIndex,
        homeScore: opts.homeScore ?? 0,
        awayScore: opts.awayScore ?? 0,
      });
      if (step.kind === 'done') {
        if (step.label === 'Hay ganador') {
          badRequest('El partido ya tiene ganador; finalízalo');
        }
        if (step.label === 'Empate final') {
          badRequest('Este empate no va a prórroga ni a penales; finalízalo');
        }
        badRequest('Ya es el último período');
      }
      const elapsed = current.clockSeconds;
      if (step.kind === 'penalties') {
        return {
          data: {
            clockElapsed: elapsed,
            clockRunning: false,
            clockEpoch: null,
            periodIndex: step.periodIndex,
            clock: formatMatchClock('football', elapsed),
            period: step.label,
          },
          periodEnd: true,
          periodStart: true,
        };
      }
      const display = clockDisplay(sport, elapsed, step.periodIndex, opts.format, opts.stage);
      return {
        data: {
          clockElapsed: elapsed,
          clockRunning: false,
          clockEpoch: null,
          periodIndex: step.periodIndex,
          clock: display.clock,
          period: display.period,
        },
        periodEnd: true,
        periodStart: true,
      };
    }
    const nextIndex = current.periodIndex + 1;
    if (nextIndex > maxPeriodIndex(sport, opts.format, opts.stage)) {
      badRequest('Ya es el último período');
    }
    const elapsed = 0;
    const display = clockDisplay(sport, elapsed, nextIndex, opts.format, opts.stage);
    return {
      data: {
        clockElapsed: elapsed,
        clockRunning: false,
        clockEpoch: null,
        periodIndex: nextIndex,
        clock: display.clock,
        period: display.period,
      },
      periodEnd: true,
      periodStart: true,
    };
  }

  if (!sportHasTickClock(sport)) {
    badRequest('El reloj no aplica en este deporte');
  }

  if (opts.action === 'pause') {
    const frozen = freezeClock(sport, row, now, fmt);
    return {
      data: {
        clockElapsed: frozen.clockElapsed,
        clockRunning: false,
        clockEpoch: null,
        periodIndex: frozen.periodIndex,
        clock: frozen.clock,
        period: frozen.period,
      },
    };
  }

  // start
  if (row.status !== 'LIVE') {
    badRequest('Pon el partido en vivo para iniciar el reloj');
  }
  if (sport === 'football' && isFootballPenalties(row.periodIndex)) {
    badRequest('En penales el reloj no corre');
  }
  const current = resolveClock(sport, row, now.getTime(), fmt);
  if (current.clockRunning) {
    return {
      data: {
        clockElapsed: row.clockElapsed,
        clockRunning: true,
        clockEpoch: row.clockEpoch,
        periodIndex: current.periodIndex,
        clock: current.clock,
        period: current.period,
      },
    };
  }
  const display = clockDisplay(sport, current.clockSeconds, current.periodIndex, opts.format, opts.stage);
  return {
    data: {
      clockElapsed: current.clockSeconds,
      clockRunning: true,
      clockEpoch: now,
      periodIndex: current.periodIndex,
      clock: display.clock,
      period: display.period,
    },
  };
}

export function withDisplayClock<T extends ClockRow>(
  sport: string,
  match: T,
  fmt?: ClockFormatOpts,
): T & { clockSeconds: number } {
  if (match.status !== 'LIVE' && match.status !== 'HALFTIME') {
    return { ...match, clockSeconds: match.clockElapsed };
  }
  const clock = resolveClock(sport, match, Date.now(), fmt);
  return {
    ...match,
    clock: clock.clock,
    period: clock.period,
    clockElapsed: clock.clockElapsed,
    clockRunning: clock.clockRunning,
    clockEpoch: clock.clockEpoch,
    periodIndex: clock.periodIndex,
    clockSeconds: clock.clockSeconds,
  };
}

export function clockLivePayload(sport: string, row: ClockRow, extra?: {
  homeScore?: number;
  awayScore?: number;
  status?: string;
}, fmt?: ClockFormatOpts) {
  const resolved = resolveClock(sport, row, Date.now(), fmt);
  return {
    ...(extra?.homeScore !== undefined ? { homeScore: extra.homeScore } : {}),
    ...(extra?.awayScore !== undefined ? { awayScore: extra.awayScore } : {}),
    ...(extra?.status ? { status: extra.status } : {}),
    clock: resolved.clock,
    period: resolved.period,
    clockSeconds: resolved.clockSeconds,
    clockRunning: resolved.clockRunning,
    clockEpoch: resolved.clockEpoch ? resolved.clockEpoch.toISOString() : null,
    periodIndex: resolved.periodIndex,
  };
}
