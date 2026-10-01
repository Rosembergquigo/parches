import type { MatchScore, Sport, RefereeEvent } from '@parches/types';

export function formatScore(score: MatchScore): string {
  return `${score.home} - ${score.away}`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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
