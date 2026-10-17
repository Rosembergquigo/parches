import type { MatchScore, Sport, RefereeEvent } from '@parches/types';

export function formatScore(score: MatchScore): string {
  return `${score.home} - ${score.away}`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Fútbol y basket tienen reloj que cuenta. Vóley solo cambia de set. Tenis queda fuera. */
export function sportHasTickClock(sport: string): boolean {
  return sport === 'football' || sport === 'basketball';
}

export const FOOTBALL_PERIOD_MINUTES = [20, 30, 45] as const;
export const FOOTBALL_EXTRA_MINUTES = [5, 10, 15] as const;
export type FootballPeriodMinutes = (typeof FOOTBALL_PERIOD_MINUTES)[number];
export type FootballExtraMinutes = (typeof FOOTBALL_EXTRA_MINUTES)[number];

/** Config de fútbol: 2 tiempos de N min; prórroga y penales por fase si hay empate. */
export type FootballMatchFormat = {
  periodMinutes: FootballPeriodMinutes;
  extraTimeMinutes: FootballExtraMinutes;
  extraTimeStages: string[];
  penaltyStages: string[];
};

export const FOOTBALL_PENALTY_PERIOD = 5;

export type PeriodPlanItem = {
  index: number;
  label: string;
  durationMin: number;
  kind: 'regulation' | 'extra';
};

export type FootballNextStep =
  | { kind: 'period'; periodIndex: number; label: string }
  | { kind: 'penalties'; periodIndex: number; label: string }
  | { kind: 'done'; label: string };

export type PeriodMark = {
  at: number;
  label: string;
};

export function defaultFootballFormat(): FootballMatchFormat {
  return { periodMinutes: 45, extraTimeMinutes: 15, extraTimeStages: [], penaltyStages: [] };
}

function parseStageList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string').map(s => s.trim());
}

export function parseFootballFormat(raw: {
  periodMinutes?: unknown;
  extraTimeMinutes?: unknown;
  extraTimeStages?: unknown;
  penaltyStages?: unknown;
} | null | undefined): FootballMatchFormat {
  const fallback = defaultFootballFormat();
  const period = Number(raw?.periodMinutes);
  const extra = Number(raw?.extraTimeMinutes);
  return {
    periodMinutes: (FOOTBALL_PERIOD_MINUTES as readonly number[]).includes(period)
      ? period as FootballPeriodMinutes
      : fallback.periodMinutes,
    extraTimeMinutes: (FOOTBALL_EXTRA_MINUTES as readonly number[]).includes(extra)
      ? extra as FootballExtraMinutes
      : fallback.extraTimeMinutes,
    extraTimeStages: parseStageList(raw?.extraTimeStages),
    penaltyStages: parseStageList(raw?.penaltyStages),
  };
}

function stageListHas(list: string[], stage?: string | null): boolean {
  if (list.includes('*')) return true;
  const key = (stage ?? '').trim();
  return list.some(s => s.trim() === key);
}

export function stageHasExtraTime(format: FootballMatchFormat, stage?: string | null): boolean {
  return stageListHas(format.extraTimeStages, stage);
}

export function stageHasPenalties(format: FootballMatchFormat, stage?: string | null): boolean {
  return stageListHas(format.penaltyStages, stage);
}

export function isFootballPenalties(periodIndex: number): boolean {
  return periodIndex >= FOOTBALL_PENALTY_PERIOD;
}

/**
 * Qué sigue al cerrar el período actual.
 * Prórroga y penales solo si van empatados; el segundo tiempo extra sí se juega entero.
 */
export function footballNextStep(opts: {
  format: FootballMatchFormat;
  stage?: string | null;
  periodIndex: number;
  homeScore: number;
  awayScore: number;
}): FootballNextStep {
  const index = Math.max(1, opts.periodIndex || 1);
  if (isFootballPenalties(index)) {
    return { kind: 'done', label: 'Penales en curso' };
  }
  const plan = footballPeriodPlan(opts.format, opts.stage);
  const tied = opts.homeScore === opts.awayScore;
  const extra = stageHasExtraTime(opts.format, opts.stage);
  const pens = stageHasPenalties(opts.format, opts.stage);

  if (index === 1) {
    return { kind: 'period', periodIndex: 2, label: plan[1]?.label ?? '2do Tiempo' };
  }
  if (index === 2) {
    if (!tied) return { kind: 'done', label: 'Hay ganador' };
    if (extra) return { kind: 'period', periodIndex: 3, label: plan[2]?.label ?? '1er Prórroga' };
    if (pens) {
      return { kind: 'penalties', periodIndex: FOOTBALL_PENALTY_PERIOD, label: 'Penales' };
    }
    return { kind: 'done', label: 'Empate final' };
  }
  if (extra && index === 3) {
    return { kind: 'period', periodIndex: 4, label: plan[3]?.label ?? '2do Prórroga' };
  }
  if (extra && index === 4) {
    if (!tied) return { kind: 'done', label: 'Hay ganador' };
    if (pens) {
      return { kind: 'penalties', periodIndex: FOOTBALL_PENALTY_PERIOD, label: 'Penales' };
    }
    return { kind: 'done', label: 'Empate final' };
  }
  return { kind: 'done', label: 'Último tiempo' };
}

export function footballPeriodPlan(
  format: FootballMatchFormat = defaultFootballFormat(),
  stage?: string | null,
): PeriodPlanItem[] {
  const n = format.periodMinutes;
  const plan: PeriodPlanItem[] = [
    { index: 1, label: '1er Tiempo', durationMin: n, kind: 'regulation' },
    { index: 2, label: '2do Tiempo', durationMin: n, kind: 'regulation' },
  ];
  if (stageHasExtraTime(format, stage)) {
    const extra = format.extraTimeMinutes;
    plan.push({ index: 3, label: '1er Prórroga', durationMin: extra, kind: 'extra' });
    plan.push({ index: 4, label: '2do Prórroga', durationMin: extra, kind: 'extra' });
  }
  return plan;
}

export function footballTimelineMinutes(
  format: FootballMatchFormat = defaultFootballFormat(),
  stage?: string | null,
): number {
  return footballPeriodPlan(format, stage).reduce((sum, item) => sum + item.durationMin, 0);
}

export function footballPeriodMarks(
  format: FootballMatchFormat = defaultFootballFormat(),
  stage?: string | null,
): PeriodMark[] {
  let at = 0;
  return footballPeriodPlan(format, stage).map(item => {
    at += item.durationMin;
    return { at, label: item.label };
  });
}

export function maxPeriodIndex(
  sport: string,
  format?: FootballMatchFormat | null,
  stage?: string | null,
): number {
  if (sport === 'football') {
    return footballPeriodPlan(format ?? defaultFootballFormat(), stage).length;
  }
  if (sport === 'basketball') return 5;
  if (sport === 'volleyball') return 5;
  return 1;
}

export function periodLabelEs(
  sport: string,
  periodIndex: number,
  format?: FootballMatchFormat | null,
  stage?: string | null,
): string {
  if (sport === 'football') {
    if (isFootballPenalties(periodIndex)) return 'Penales';
    const plan = footballPeriodPlan(format ?? defaultFootballFormat(), stage);
    return plan[periodIndex - 1]?.label
      ?? ['1er Tiempo', '2do Tiempo', '1er Prórroga', '2do Prórroga'][periodIndex - 1]
      ?? `Periodo ${periodIndex}`;
  }
  const basketball = ['1er Cuarto', '2do Cuarto', '3er Cuarto', '4to Cuarto', 'Extra'];
  const volleyball = ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'];
  const labels = sport === 'basketball' ? basketball : sport === 'volleyball' ? volleyball : [];
  return labels[periodIndex - 1] ?? `Periodo ${periodIndex}`;
}

export function resolvedClockSeconds(opts: {
  elapsed: number;
  running: boolean;
  epoch?: Date | string | null;
  now?: number;
}): number {
  const elapsed = Math.max(0, Math.floor(Number(opts.elapsed) || 0));
  if (!opts.running || !opts.epoch) return elapsed;
  const t = typeof opts.epoch === 'string' ? Date.parse(opts.epoch) : opts.epoch.getTime();
  if (!Number.isFinite(t)) return elapsed;
  const now = opts.now ?? Date.now();
  return elapsed + Math.max(0, Math.floor((now - t) / 1000));
}

export function formatMatchClock(sport: string, seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (sport === 'football') return `${Math.floor(s / 60)}'`;
  if (sport === 'basketball') return formatClock(s);
  return '—';
}

export function clockDisplay(
  sport: string,
  seconds: number,
  periodIndex: number,
  format?: FootballMatchFormat | null,
  stage?: string | null,
): {
  clock: string;
  period: string;
} {
  return {
    clock: formatMatchClock(sport, seconds),
    period: periodLabelEs(sport, Math.max(1, periodIndex), format, stage),
  };
}

export function getPeriodLabel(sport: Sport, period: number): string {
  const labels: Record<Sport, string[]> = {
    football: ['1st Half', '2nd Half', 'Extra Time'],
    basketball: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    tennis: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
    volleyball: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
    baseball: Array.from({ length: 9 }, (_, i) => `${i + 1}th Inning`),
    hockey: ['1st Period', '2nd Period', '3rd Period', 'OT'],
  };
  return labels[sport]?.[period - 1] ?? `Period ${period}`;
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isScoreEvent(event: RefereeEvent): boolean {
  return ['goal', 'score_update'].includes(event.type);
}

/** Palabras que no llevan mayúscula salvo al inicio (nombres de equipos). */
const TITLE_SMALL = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
  'a', 'al', 'en', 'da', 'do', 'das', 'dos',
]);
const TITLE_ABBR = new Set(['fc', 'sc', 'cf', 'cd', 'ud', 'afc']);

/**
 * Title case para nombres: "águilas de cali" → "Águilas de Cali".
 * Las siglas cortas (FC, CD) se dejan en mayúsculas.
 */
export function toTitleCase(value: string): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return '';

  return text.split(/(\s+|-)/).map((token, index, parts) => {
    if (!token || /^[\s-]+$/.test(token)) return token;
    const lower = token.toLocaleLowerCase('es-CO');
    if (TITLE_ABBR.has(lower)) return lower.toLocaleUpperCase('es-CO');
    const isFirst = !parts.slice(0, index).some(part => /[^\s-]/.test(part));
    if (!isFirst && TITLE_SMALL.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase('es-CO') + lower.slice(1);
  }).join('');
}
