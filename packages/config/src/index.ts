export const PORTS = {
  WEB: 4321,
  API: 3000,
  STREAMING_DATA: 3001,
  STREAMING_VIDEO: 3002,
} as const;

export const ENDPOINTS = {
  API_HTTP: process.env.API_URL ?? `http://localhost:${PORTS.API}`,
  WEB_HTTP: process.env.WEB_URL ?? `http://localhost:${PORTS.WEB}`,
  STREAMING_DATA_WS: process.env.STREAMING_DATA_WS_URL ?? `ws://localhost:${PORTS.STREAMING_DATA}`,
  STREAMING_DATA_HTTP: process.env.STREAMING_DATA_URL ?? `http://localhost:${PORTS.STREAMING_DATA}`,
  STREAMING_VIDEO_HTTP: process.env.STREAMING_VIDEO_URL ?? `http://localhost:${PORTS.STREAMING_VIDEO}`,
} as const;

/** Canal Redis y ruta WS de un partido. Un solo contrato para api, streaming-data y clientes. */
export function matchLiveChannel(matchId: string): string {
  return `match:${matchId}`;
}

export function matchWsPath(matchId: string): string {
  return `/matches/${matchId}/ws`;
}

export function matchWsUrl(base: string, matchId: string): string {
  return `${base.replace(/\/$/, '')}${matchWsPath(matchId)}`;
}

export const SPORTS_CONFIG = {
  PERIODS: {
    football:   { count: 2, label: 'Half' },
    basketball: { count: 4, label: 'Quarter' },
    tennis:     { count: 5, label: 'Set' },
    volleyball: { count: 5, label: 'Set' },
    baseball:   { count: 9, label: 'Inning' },
    hockey:     { count: 3, label: 'Period' },
  },
} as const;

/** Singles: cada inscripción es un Team de una persona. Padel y similares se suman aquí. */
export const INDIVIDUAL_SPORTS = ['tennis'] as const;

export function isIndividualSport(sport: string): boolean {
  return (INDIVIDUAL_SPORTS as readonly string[]).includes(sport);
}

/** Tipos de bitácora que POST /matches/:id/events acepta. */
export const MATCH_EVENT_TYPES = [
  'goal',
  'yellow_card',
  'red_card',
  'foul',
  'substitution',
  'period_start',
  'period_end',
  'timeout',
  'score_update',
  'custom',
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

const COMMON_EVENTS = ['substitution', 'period_start', 'period_end', 'custom'] as const satisfies readonly MatchEventType[];

/**
 * Qué se puede registrar según el deporte del torneo.
 * El gol de fútbol suma marcador; basket/vóley usan `score_update` (puntos en 2.5).
 * Tenis queda fuera del bloque de scoring.
 */
export const MATCH_EVENTS_BY_SPORT: Record<string, readonly MatchEventType[]> = {
  football: ['goal', 'yellow_card', 'red_card', 'foul', ...COMMON_EVENTS],
  basketball: ['score_update', 'foul', 'timeout', ...COMMON_EVENTS],
  volleyball: ['score_update', 'timeout', ...COMMON_EVENTS],
  tennis: ['period_start', 'period_end', 'custom'],
};

export const MATCH_EVENT_LABELS: Record<MatchEventType, string> = {
  goal: 'Gol',
  yellow_card: 'Tarjeta amarilla',
  red_card: 'Tarjeta roja',
  foul: 'Falta',
  substitution: 'Cambio',
  period_start: 'Inicio de período',
  period_end: 'Fin de período',
  timeout: 'Tiempo muerto',
  score_update: 'Puntos',
  custom: 'Novedad',
};

export const SPORT_LABELS: Record<string, string> = {
  football: 'fútbol',
  basketball: 'baloncesto',
  tennis: 'tenis',
  volleyball: 'vóleibol',
  baseball: 'béisbol',
  hockey: 'hockey',
};

export function eventsForSport(sport: string): readonly MatchEventType[] {
  return MATCH_EVENTS_BY_SPORT[sport] ?? ['custom'];
}

export function isEventAllowedForSport(sport: string, type: string): boolean {
  return (eventsForSport(sport) as readonly string[]).includes(type);
}

export function isKnownMatchEventType(type: string): type is MatchEventType {
  return (MATCH_EVENT_TYPES as readonly string[]).includes(type);
}
