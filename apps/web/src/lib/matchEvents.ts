/**
 * matchEvents.ts — tipos y configuración visual compartida para los
 * eventos de un partido (EventFeed y EventTimeline).
 *
 * Centralizar esto evita que el mapa de íconos/colores y el tipo
 * MatchEvent se dupliquen entre los distintos islands de React.
 */

export type MatchEventType =
  | 'goal' | 'yellow_card' | 'red_card' | 'foul' | 'substitution'
  | 'period_start' | 'period_end' | 'timeout' | 'score_update' | 'custom';

export interface MatchEventItem {
  id: string;
  type: MatchEventType;
  clock: string;
  teamId?: string;
  playerName?: string;
  description?: string;
  timestamp: string;
}

export interface EventVisualConfig {
  symbol: string;
  label: string;
  color: string;
}

// Ícono (símbolo) + etiqueta + color de acento por tipo de evento
export const EVENT_CONFIG: Record<MatchEventType, EventVisualConfig> = {
  goal:         { symbol: '⚽', label: 'Gol',             color: '#00e5ff' },
  yellow_card:  { symbol: '🟨', label: 'Tarjeta amarilla', color: '#f5a623' },
  red_card:     { symbol: '🟥', label: 'Tarjeta roja',    color: '#ff3b3b' },
  foul:         { symbol: '⚠',  label: 'Falta',           color: '#8a9099' },
  substitution: { symbol: '🔄', label: 'Cambio',          color: '#8a9099' },
  period_start: { symbol: '▶',  label: 'Inicio',          color: '#454a52' },
  period_end:   { symbol: '⏸',  label: 'Fin de tiempo',   color: '#454a52' },
  timeout:      { symbol: '⏱',  label: 'Tiempo muerto',   color: '#8a9099' },
  score_update: { symbol: '📊', label: 'Actualización',   color: '#00e5ff' },
  custom:       { symbol: '📌', label: 'Evento',          color: '#8a9099' },
};

/**
 * Extrae los minutos de un string de reloj tipo "45'", "90+2'", "12'".
 * Si no se puede interpretar, devuelve 0 (se ubica al inicio de la línea).
 */
export function parseClockMinutes(clock: string): number {
  const match = clock.match(/(\d+)(?:\s*\+\s*(\d+))?/);
  if (!match) return 0;
  const base = Number(match[1]);
  const extra = match[2] ? Number(match[2]) : 0;
  return base + extra;
}
