/**
 * Datos mockeados que replican exactamente el shape del @parches/api.
 *
 * Para conectar datos reales, reemplaza las importaciones en index.astro:
 *   import { getTournaments } from '../lib/api';
 *   const tournaments = await getTournaments();
 *
 * La estructura de TournamentWithMatches refleja el include de Prisma:
 *   prisma.tournament.findMany({ include: { matches: { include: { homeTeam, awayTeam } } } })
 */

export type Sport = 'football' | 'basketball' | 'tennis' | 'volleyball' | 'baseball' | 'hockey';
export type MatchStatus = 'LIVE' | 'SCHEDULED' | 'FINISHED';
export type TournamentStatus = 'LIVE' | 'UPCOMING' | 'FINISHED';

export interface TeamSnippet {
  id: string;
  name: string;
  shortName: string;       // 3 letras para el logo placeholder
  logoUrl?: string;
}

export interface MatchSnippet {
  id: string;
  homeTeam: TeamSnippet;
  awayTeam: TeamSnippet;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  clock?: string;          // "67'" / "Q3 08:22" / "Set 3" / "FT"
  period?: string;         // "2do Tiempo" / "Q3" / "Set 3 en curso"
  venue?: string;
  scheduledAt?: string;    // ISO string para partidos SCHEDULED
  viewerCount?: number;
  streamKey?: string;      // presente si hay stream activo
}

export interface TournamentWithMatches {
  id: string;
  slug: string;
  name: string;
  sport: Sport;
  status: TournamentStatus;
  stage?: string;          // "Jornada 18" / "Semifinales" / "Cuartos de final"
  teamCount?: number;
  matches: MatchSnippet[];
}

// ── Mock data ────────────────────────────────────────────────

export const MOCK_TOURNAMENTS: TournamentWithMatches[] = [
  {
    id: 't1',
    slug: 'liga-betplay-2025',
    name: 'Liga BetPlay Dimayor',
    sport: 'football',
    status: 'LIVE',
    stage: 'Jornada 18',
    teamCount: 20,
    matches: [
      {
        id: 'm1',
        homeTeam: { id: 'med', name: 'Independiente Medellín', shortName: 'MED' },
        awayTeam: { id: 'mil', name: 'Millonarios FC', shortName: 'MIL' },
        homeScore: 2, awayScore: 1,
        status: 'LIVE',
        clock: "67'", period: '2do Tiempo',
        venue: 'Est. El Campín',
        viewerCount: 4200, streamKey: 'live-m1',
      },
      {
        id: 'm2',
        homeTeam: { id: 'ame', name: 'América de Cali', shortName: 'AME' },
        awayTeam: { id: 'jun', name: 'Junior FC', shortName: 'JUN' },
        homeScore: 0, awayScore: 0,
        status: 'LIVE',
        clock: "34'", period: '1er Tiempo',
        venue: 'Est. Metropolitano',
        viewerCount: 2100, streamKey: 'live-m2',
      },
      {
        id: 'm3',
        homeTeam: { id: 'nal', name: 'Atlético Nacional', shortName: 'NAL' },
        awayTeam: { id: 'cal', name: 'Deportivo Cali', shortName: 'CAL' },
        homeScore: 0, awayScore: 0,
        status: 'SCHEDULED',
        clock: '−', period: 'Clásico del Valle',
        scheduledAt: new Date(Date.now() + 3.33 * 60 * 60 * 1000).toISOString(),
        venue: 'Est. Atanasio Girardot',
      },
      {
        id: 'm4',
        homeTeam: { id: 'san', name: 'Santa Fe', shortName: 'SAN' },
        awayTeam: { id: 'pas', name: 'Deportivo Pasto', shortName: 'PAS' },
        homeScore: 3, awayScore: 1,
        status: 'FINISHED',
        clock: 'FT', period: 'Resultado final',
      },
    ],
  },
  {
    id: 't2',
    slug: 'lnb-2025',
    name: 'Liga Nacional de Baloncesto',
    sport: 'basketball',
    status: 'LIVE',
    stage: 'Semifinales',
    teamCount: 10,
    matches: [
      {
        id: 'm5',
        homeTeam: { id: 'buc', name: 'Búcaros de Bucaramanga', shortName: 'BUC' },
        awayTeam: { id: 'pir', name: 'Piratas de Bogotá', shortName: 'PIR' },
        homeScore: 58, awayScore: 61,
        status: 'LIVE',
        clock: 'Q3 · 08:22', period: 'Juego 3 de 5',
        viewerCount: 1800, streamKey: 'live-m5',
      },
      {
        id: 'm6',
        homeTeam: { id: 'coc', name: 'Cocodrilos del Chocó', shortName: 'COC' },
        awayTeam: { id: 'vaq', name: 'Vaqueros de Montería', shortName: 'VAQ' },
        homeScore: 0, awayScore: 0,
        status: 'SCHEDULED',
        clock: '−', period: 'Juego 4',
        scheduledAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 't3',
    slug: 'copa-davis-col-2025',
    name: 'Copa Davis Colombia',
    sport: 'tennis',
    status: 'LIVE',
    stage: 'Cuartos de final',
    matches: [
      {
        id: 'm7',
        homeTeam: { id: 'cab', name: 'Cabal', shortName: 'CAB' },
        awayTeam: { id: 'gar', name: 'García', shortName: 'GAR' },
        homeScore: 1, awayScore: 1,
        status: 'LIVE',
        clock: 'Set 3', period: 'Set 3 en curso',
        viewerCount: 920, streamKey: 'live-m7',
      },
    ],
  },
  {
    id: 't4',
    slug: 'sudamericano-voleibol-2025',
    name: 'Sudamericano Voleibol',
    sport: 'volleyball',
    status: 'UPCOMING',
    stage: 'Fase de grupos',
    teamCount: 12,
    matches: [
      {
        id: 'm8',
        homeTeam: { id: 'col', name: 'Colombia', shortName: 'COL' },
        awayTeam: { id: 'bra', name: 'Brasil', shortName: 'BRA' },
        homeScore: 0, awayScore: 0,
        status: 'SCHEDULED',
        clock: '−',
        scheduledAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 't5',
    slug: 'lpb-playoffs-2025',
    name: 'LPB Playoffs',
    sport: 'baseball',
    status: 'LIVE',
    stage: 'Playoffs',
    matches: [
      {
        id: 'm9',
        homeTeam: { id: 'cai', name: 'Caimanes de Barranquilla', shortName: 'CAI' },
        awayTeam: { id: 'tor', name: 'Toros de Sincelejo', shortName: 'TOR' },
        homeScore: 4, awayScore: 3,
        status: 'LIVE',
        clock: '7° Inn', period: '7° Inning',
        viewerCount: 650, streamKey: 'live-m9',
      },
    ],
  },
];

// Partidos en vivo planos para el live strip
export const MOCK_LIVE_MATCHES: MatchSnippet[] = MOCK_TOURNAMENTS
  .flatMap(t => t.matches.filter(m => m.status === 'LIVE')
    .map(m => ({ ...m, _tournament: t.name, _sport: t.sport }))
  ) as (MatchSnippet & { _tournament: string; _sport: Sport })[];

// Partido más importante para el hero (primero en vivo con más viewers)
export const MOCK_HERO_MATCHES: (MatchSnippet & { tournamentName: string; sport: Sport })[] =
  MOCK_TOURNAMENTS
    .flatMap(t => t.matches
      .filter(m => m.status === 'LIVE')
      .map(m => ({ ...m, tournamentName: t.name, sport: t.sport, stage: t.stage }))
    )
    .sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0))
    .slice(0, 3) as (MatchSnippet & { tournamentName: string; sport: Sport })[];

// ── Tournament detail helpers ─────────────────────────────

export interface StandingsRow {
  position: number;
  team: TeamSnippet;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface MatchGroup {
  label: string;          // "Jornada 18" / "Semifinales" / "Cuartos de final"
  matches: MatchSnippet[];
}

/**
 * Una fila de estadística de jugador.
 * `statValue`  → el número principal del ranking (goles, puntos, etc.)
 * `statLabel`  → texto auxiliar opcional ("4 partidos" / "87% efectividad")
 */
export interface PlayerStat {
  position: number;
  playerName: string;
  playerShortName: string;   // iniciales para el avatar placeholder
  team: TeamSnippet;
  statValue: number;
  statLabel?: string;        // texto auxiliar debajo del valor
}

/**
 * Configuración de una tab de estadísticas.
 * Genérica — cada deporte define sus propias tabs.
 *
 * Ejemplos:
 *   Fútbol:      { id: 'scorers',  tabLabel: 'Goleadores',          colHeader: 'Goles' }
 *                { id: 'cleansh',  tabLabel: 'Valla menos vencida',  colHeader: 'Vallas' }
 *   Baloncesto:  { id: 'points',   tabLabel: 'Anotadores',           colHeader: 'Pts' }
 *                { id: 'rebounds', tabLabel: 'Reboteadores',          colHeader: 'Reb' }
 *   Tenis:       { id: 'aces',     tabLabel: 'Aces',                  colHeader: 'Aces' }
 */
export interface StatConfig {
  id: string;            // identificador único del tab (usado como aria-controls)
  tabLabel: string;      // texto del tab
  colHeader: string;     // encabezado de la columna principal (corto: "Goles", "Pts")
  rows: PlayerStat[];
}

export interface TournamentDetail extends TournamentWithMatches {
  description?: string;
  standings?: StandingsRow[];
  groups?: MatchGroup[];
  /**
   * Estadísticas de jugadores organizadas por tab.
   * El orden del array define el orden de los tabs.
   * Si está vacío o undefined, la sección no se renderiza.
   */
  playerStats?: StatConfig[];
  brandColor?: string;
  logoUrl?: string;
}

// Detailed mock for Liga BetPlay
export const MOCK_TOURNAMENT_BETPLAY: TournamentDetail = {
  ...MOCK_TOURNAMENTS[0]!,
  brandColor: '#f5a623',
  logoUrl: undefined,
  description: 'La primera división del fútbol profesional colombiano. 20 equipos compiten en dos fases: todos contra todos y cuadrangulares finales.',
  playerStats: [
    {
      id: 'scorers',
      tabLabel: 'Goleadores',
      colHeader: 'Goles',
      rows: [
        { position: 1, playerName: 'Adrián Ramos',     playerShortName: 'AR', team: { id: 'ame', name: 'América de Cali',          shortName: 'AME' }, statValue: 12, statLabel: '17 partidos' },
        { position: 2, playerName: 'Dayro Moreno',     playerShortName: 'DM', team: { id: 'nal', name: 'Atlético Nacional',          shortName: 'NAL' }, statValue: 11, statLabel: '16 partidos' },
        { position: 3, playerName: 'Leonardo Castro',  playerShortName: 'LC', team: { id: 'mil', name: 'Millonarios FC',             shortName: 'MIL' }, statValue: 9,  statLabel: '17 partidos' },
        { position: 4, playerName: 'Rodrigo Ureña',    playerShortName: 'RU', team: { id: 'med', name: 'Independiente Medellín',     shortName: 'MED' }, statValue: 8,  statLabel: '15 partidos' },
        { position: 5, playerName: 'Wilson Morelo',    playerShortName: 'WM', team: { id: 'san', name: 'Santa Fe',                  shortName: 'SAN' }, statValue: 7,  statLabel: '17 partidos' },
        { position: 6, playerName: 'Jhon Córdoba',     playerShortName: 'JC', team: { id: 'jun', name: 'Junior FC',                 shortName: 'JUN' }, statValue: 6,  statLabel: '14 partidos' },
        { position: 7, playerName: 'Marco Pérez',      playerShortName: 'MP', team: { id: 'cal', name: 'Deportivo Cali',            shortName: 'CAL' }, statValue: 5,  statLabel: '17 partidos' },
        { position: 8, playerName: 'Carlos Bacca',     playerShortName: 'CB', team: { id: 'jun', name: 'Junior FC',                 shortName: 'JUN' }, statValue: 5,  statLabel: '16 partidos' },
      ],
    },
    {
      id: 'cleansheets',
      tabLabel: 'Valla menos vencida',
      colHeader: 'Vallas',
      rows: [
        { position: 1, playerName: 'Aldair Quintana',  playerShortName: 'AQ', team: { id: 'nal', name: 'Atlético Nacional',          shortName: 'NAL' }, statValue: 9,  statLabel: '3 goles en contra' },
        { position: 2, playerName: 'Álvaro Montero',   playerShortName: 'AM', team: { id: 'mil', name: 'Millonarios FC',             shortName: 'MIL' }, statValue: 8,  statLabel: '5 goles en contra' },
        { position: 3, playerName: 'David González',   playerShortName: 'DG', team: { id: 'med', name: 'Independiente Medellín',     shortName: 'MED' }, statValue: 8,  statLabel: '6 goles en contra' },
        { position: 4, playerName: 'Joel Graterol',    playerShortName: 'JG', team: { id: 'san', name: 'Santa Fe',                  shortName: 'SAN' }, statValue: 7,  statLabel: '7 goles en contra' },
        { position: 5, playerName: 'Sebastián Viera',  playerShortName: 'SV', team: { id: 'jun', name: 'Junior FC',                 shortName: 'JUN' }, statValue: 6,  statLabel: '9 goles en contra' },
        { position: 6, playerName: 'Neto Volpi',       playerShortName: 'NV', team: { id: 'ame', name: 'América de Cali',          shortName: 'AME' }, statValue: 5,  statLabel: '11 goles en contra' },
      ],
    },
  ],
  standings: [
    { position: 1, team: { id: 'nal', name: 'Atlético Nacional', shortName: 'NAL' }, played: 17, won: 11, drawn: 3, lost: 3, goalsFor: 32, goalsAgainst: 14, points: 36 },
    { position: 2, team: { id: 'mil', name: 'Millonarios FC', shortName: 'MIL' }, played: 17, won: 10, drawn: 4, lost: 3, goalsFor: 28, goalsAgainst: 16, points: 34 },
    { position: 3, team: { id: 'med', name: 'Independiente Medellín', shortName: 'MED' }, played: 17, won: 9, drawn: 5, lost: 3, goalsFor: 25, goalsAgainst: 13, points: 32 },
    { position: 4, team: { id: 'san', name: 'Santa Fe', shortName: 'SAN' }, played: 17, won: 9, drawn: 3, lost: 5, goalsFor: 22, goalsAgainst: 18, points: 30 },
    { position: 5, team: { id: 'ame', name: 'América de Cali', shortName: 'AME' }, played: 17, won: 8, drawn: 4, lost: 5, goalsFor: 24, goalsAgainst: 20, points: 28 },
    { position: 6, team: { id: 'jun', name: 'Junior FC', shortName: 'JUN' }, played: 17, won: 7, drawn: 5, lost: 5, goalsFor: 21, goalsAgainst: 19, points: 26 },
    { position: 7, team: { id: 'cal', name: 'Deportivo Cali', shortName: 'CAL' }, played: 17, won: 6, drawn: 4, lost: 7, goalsFor: 18, goalsAgainst: 22, points: 22 },
    { position: 8, team: { id: 'pas', name: 'Deportivo Pasto', shortName: 'PAS' }, played: 17, won: 4, drawn: 3, lost: 10, goalsFor: 14, goalsAgainst: 28, points: 15 },
  ],
  groups: [
    {
      label: 'Jornada 18 — En curso',
      matches: MOCK_TOURNAMENTS[0]!.matches.filter(m => m.status === 'LIVE' || m.status === 'SCHEDULED'),
    },
    {
      label: 'Jornada 17 — Finalizada',
      matches: MOCK_TOURNAMENTS[0]!.matches.filter(m => m.status === 'FINISHED'),
    },
  ],
};

export function getMockTournamentBySlug(slug: string): TournamentDetail | null {
  if (slug === 'liga-betplay-2025') return MOCK_TOURNAMENT_BETPLAY;
  const found = MOCK_TOURNAMENTS.find(t => t.slug === slug);
  if (!found) return null;
  return { ...found, groups: [{ label: 'Partidos', matches: found.matches }] };
}

// ── Match detail ──────────────────────────────────────────

export type EventType =
  | 'goal' | 'yellow_card' | 'red_card' | 'foul'
  | 'substitution' | 'period_start' | 'period_end'
  | 'timeout' | 'score_update' | 'custom';

export interface MatchEvent {
  id: string;
  type: EventType;
  clock: string;
  teamId?: string;
  playerName?: string;
  description?: string;
  timestamp: string;
}

export interface MatchDetail {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  sport: Sport;
  homeTeam: TeamSnippet;
  awayTeam: TeamSnippet;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  clock?: string;
  period?: string;
  venue?: string;
  scheduledAt?: string;
  streamKey?: string;
  hlsUrl?: string;
  viewerCount?: number;
  events: MatchEvent[];
  stats?: MatchStatRow[];   // se agrega después del type MatchStatRow
}

export const MOCK_MATCH_DETAIL: MatchDetail = {
  id: 'm1',
  tournamentId: 't1',
  tournamentName: 'Liga BetPlay Dimayor',
  tournamentSlug: 'liga-betplay-2025',
  sport: 'football',
  homeTeam: { id: 'med', name: 'Independiente Medellín', shortName: 'MED' },
  awayTeam: { id: 'mil', name: 'Millonarios FC',          shortName: 'MIL' },
  homeScore: 2, awayScore: 1,
  status: 'LIVE',
  clock: "67'",
  period: '2do Tiempo',
  venue: 'Estadio El Campín, Bogotá',
  streamKey: 'live-m1',
  hlsUrl: undefined,   // sin stream real por ahora
  viewerCount: 4200,
  events: [
    { id: 'e1', type: 'period_start', clock: "0'",  description: 'Inicio del partido', timestamp: new Date(Date.now() - 67*60000).toISOString() },
    { id: 'e2', type: 'goal',         clock: "12'", teamId: 'med', playerName: 'Rodrigo Ureña',   description: 'Gol — cabezazo al segundo palo', timestamp: new Date(Date.now() - 55*60000).toISOString() },
    { id: 'e3', type: 'yellow_card',  clock: "28'", teamId: 'mil', playerName: 'David Mackalister', description: 'Tarjeta amarilla', timestamp: new Date(Date.now() - 39*60000).toISOString() },
    { id: 'e4', type: 'period_end',   clock: "45'", description: 'Fin del 1er Tiempo',  timestamp: new Date(Date.now() - 30*60000).toISOString() },
    { id: 'e5', type: 'period_start', clock: "45'", description: 'Inicio 2do Tiempo',   timestamp: new Date(Date.now() - 22*60000).toISOString() },
    { id: 'e6', type: 'goal',         clock: "52'", teamId: 'mil', playerName: 'Leonardo Castro', description: 'Gol — tiro libre al ángulo', timestamp: new Date(Date.now() - 15*60000).toISOString() },
    { id: 'e7', type: 'substitution', clock: "58'", teamId: 'med', playerName: 'Ureña → Palacios', description: 'Cambio Medellín', timestamp: new Date(Date.now() - 9*60000).toISOString() },
    { id: 'e8', type: 'goal',         clock: "63'", teamId: 'med', playerName: 'Javier Reina',    description: 'Gol — derechazo cruzado', timestamp: new Date(Date.now() - 4*60000).toISOString() },
    { id: 'e9', type: 'foul',         clock: "66'", teamId: 'mil', playerName: 'Ruiz',            description: 'Falta peligrosa', timestamp: new Date(Date.now() - 60000).toISOString() },
  ],
};

export function getMockMatchById(id: string): MatchDetail | null {
  if (id === 'm1') return MOCK_MATCH_DETAIL;
  // Buscar en torneos para partidos sin detalle completo
  const allMatches = MOCK_TOURNAMENTS.flatMap(t =>
    t.matches.map(m => ({
      ...m,
      tournamentId: t.id,
      tournamentName: t.name,
      tournamentSlug: t.slug,
      sport: t.sport,
      events: [] as MatchEvent[],
    } as MatchDetail))
  );
  return allMatches.find(m => m.id === id) ?? null;
}

// ── Match stats (por partido, no por torneo) ──────────────

export interface MatchStatRow {
  label: string;          // "Remates", "Posesión", "Aces"
  home: number;
  away: number;
  isPercentage?: boolean; // true → muestra "73%" en vez de "73"
  higherIsBetter?: boolean; // false para faltas, tarjetas
}

export interface MatchStatsConfig {
  sport: Sport;
  rows: MatchStatRow[];
}

// Stats por deporte — genérico, extensible
export const MATCH_STATS_BY_SPORT: Record<Sport, (home: string, away: string) => MatchStatRow[]> = {
  football: () => [
    { label: 'Remates',                home: 15, away: 5,   higherIsBetter: true  },
    { label: 'Remates al arco',        home: 7,  away: 4,   higherIsBetter: true  },
    { label: 'Posesión',               home: 73, away: 27,  isPercentage: true, higherIsBetter: true },
    { label: 'Pases',                  home: 450,away: 179, higherIsBetter: true  },
    { label: 'Precisión de pases',     home: 87, away: 60,  isPercentage: true, higherIsBetter: true },
    { label: 'Faltas',                 home: 9,  away: 13,  higherIsBetter: false },
    { label: 'Tarjetas amarillas',     home: 3,  away: 5,   higherIsBetter: false },
    { label: 'Tarjetas rojas',         home: 0,  away: 0,   higherIsBetter: false },
    { label: 'Posición adelantada',    home: 2,  away: 1,   higherIsBetter: false },
    { label: 'Tiros de esquina',       home: 7,  away: 4,   higherIsBetter: true  },
  ],
  basketball: () => [
    { label: 'Puntos en pintura',      home: 34, away: 22,  higherIsBetter: true  },
    { label: 'Rebotes totales',        home: 42, away: 35,  higherIsBetter: true  },
    { label: 'Rebotes ofensivos',      home: 12, away: 8,   higherIsBetter: true  },
    { label: 'Asistencias',            home: 18, away: 14,  higherIsBetter: true  },
    { label: 'Robos',                  home: 7,  away: 5,   higherIsBetter: true  },
    { label: 'Bloqueos',               home: 4,  away: 3,   higherIsBetter: true  },
    { label: 'Pérdidas de balón',      home: 11, away: 14,  higherIsBetter: false },
    { label: 'Tiros de campo %',       home: 48, away: 42,  isPercentage: true, higherIsBetter: true },
    { label: 'Triples %',              home: 36, away: 31,  isPercentage: true, higherIsBetter: true },
    { label: 'Tiros libres %',         home: 78, away: 72,  isPercentage: true, higherIsBetter: true },
  ],
  tennis: () => [
    { label: 'Aces',                   home: 8,  away: 4,   higherIsBetter: true  },
    { label: 'Dobles faltas',          home: 2,  away: 5,   higherIsBetter: false },
    { label: '1er servicio %',         home: 68, away: 61,  isPercentage: true, higherIsBetter: true },
    { label: 'Puntos con 1er servicio',home: 74, away: 65,  isPercentage: true, higherIsBetter: true },
    { label: 'Puntos con 2do servicio',home: 52, away: 44,  isPercentage: true, higherIsBetter: true },
    { label: 'Puntos de quiebre ganados', home: 4, away: 2, higherIsBetter: true  },
    { label: 'Winners',                home: 32, away: 24,  higherIsBetter: true  },
    { label: 'Errores no forzados',    home: 18, away: 26,  higherIsBetter: false },
  ],
  volleyball: () => [
    { label: 'Aces de servicio',       home: 6,  away: 3,   higherIsBetter: true  },
    { label: 'Errores de servicio',    home: 4,  away: 7,   higherIsBetter: false },
    { label: 'Bloqueos',               home: 9,  away: 6,   higherIsBetter: true  },
    { label: 'Ataques exitosos',       home: 42, away: 35,  higherIsBetter: true  },
    { label: 'Eficiencia de ataque',   home: 58, away: 47,  isPercentage: true, higherIsBetter: true },
    { label: 'Errores de recepción',   home: 5,  away: 8,   higherIsBetter: false },
  ],
  baseball: () => [
    { label: 'Hits',                   home: 9,  away: 7,   higherIsBetter: true  },
    { label: 'Carreras',               home: 4,  away: 3,   higherIsBetter: true  },
    { label: 'Errores',                home: 1,  away: 2,   higherIsBetter: false },
    { label: 'Ponches lanzador',       home: 8,  away: 6,   higherIsBetter: true  },
    { label: 'Bases por bolas',        home: 3,  away: 4,   higherIsBetter: false },
    { label: 'Promedio de bateo',      home: 28, away: 24,  isPercentage: true, higherIsBetter: true },
  ],
  hockey: () => [
    { label: 'Tiros al arco',          home: 32, away: 24,  higherIsBetter: true  },
    { label: 'Bloqueos',               home: 14, away: 18,  higherIsBetter: true  },
    { label: 'Golpes',                 home: 22, away: 28,  higherIsBetter: false },
    { label: 'Power plays',            home: 3,  away: 2,   higherIsBetter: true  },
    { label: 'Goles en power play',    home: 1,  away: 0,   higherIsBetter: true  },
    { label: '% paradas portero',      home: 92, away: 87,  isPercentage: true, higherIsBetter: true },
  ],
};

// Agregar stats al mock del partido m1
MOCK_MATCH_DETAIL.stats = MATCH_STATS_BY_SPORT.football();

// ── User profile mock data ────────────────────────────────

export type UserRole = 'VIEWER' | 'REFEREE' | 'ORGANIZER' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  avatarUrl?: string;
  bio?: string;
  // VIEWER stats
  tournamentsFollowed?: number;
  matchesWatched?: number;
  // REFEREE stats
  matchesRefereed?: number;
  eventsLogged?: number;
}

export interface ScheduledMatchItem {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  tournamentName: string;
  sport: Sport;
  scheduledAt: string;
  status: MatchStatus;
  role: 'viewer' | 'referee';  // qué hace el usuario en este partido
}

export interface HistoryMatchItem {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  tournamentName: string;
  sport: Sport;
  playedAt: string;
  role: 'viewer' | 'referee';
}

// Mock viewer profile
export const MOCK_USER_VIEWER: UserProfile = {
  id: 'u1',
  name: 'Carlos Mendoza',
  email: 'carlos@example.com',
  role: 'VIEWER',
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  tournamentsFollowed: 4,
  matchesWatched: 23,
};

// Mock referee profile
export const MOCK_USER_REFEREE: UserProfile = {
  id: 'u2',
  name: 'Jorge Ospina',
  email: 'jorge@parches.app',
  role: 'REFEREE',
  createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  bio: 'Árbitro FIFA desde 2018. Liga BetPlay y Copa Colombia.',
  matchesRefereed: 47,
  eventsLogged: 312,
};

// Mock schedule — próximos partidos
export const MOCK_USER_SCHEDULE: ScheduledMatchItem[] = [
  {
    matchId: 'm3',
    homeTeam: 'Atlético Nacional',
    awayTeam: 'Deportivo Cali',
    tournamentName: 'Liga BetPlay Dimayor',
    sport: 'football',
    scheduledAt: new Date(Date.now() + 3.3 * 60 * 60 * 1000).toISOString(),
    status: 'SCHEDULED',
    role: 'viewer',
  },
  {
    matchId: 'm6',
    homeTeam: 'Cocodrilos del Chocó',
    awayTeam: 'Vaqueros de Montería',
    tournamentName: 'Liga Nacional de Baloncesto',
    sport: 'basketball',
    scheduledAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    status: 'SCHEDULED',
    role: 'viewer',
  },
  {
    matchId: 'm8',
    homeTeam: 'Colombia',
    awayTeam: 'Brasil',
    tournamentName: 'Sudamericano Voleibol',
    sport: 'volleyball',
    scheduledAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'SCHEDULED',
    role: 'viewer',
  },
];

// Mock history — partidos vistos
export const MOCK_USER_HISTORY: HistoryMatchItem[] = [
  { matchId: 'm4', homeTeam: 'Santa Fe', awayTeam: 'Deportivo Pasto', homeScore: 3, awayScore: 1, tournamentName: 'Liga BetPlay', sport: 'football', playedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), role: 'viewer' },
  { matchId: 'mh2', homeTeam: 'Búcaros', awayTeam: 'Piratas', homeScore: 72, awayScore: 68, tournamentName: 'LNB', sport: 'basketball', playedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), role: 'viewer' },
  { matchId: 'mh3', homeTeam: 'América', awayTeam: 'Junior', homeScore: 1, awayScore: 1, tournamentName: 'Liga BetPlay', sport: 'football', playedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), role: 'viewer' },
  { matchId: 'mh4', homeTeam: 'Cabal', awayTeam: 'García', homeScore: 2, awayScore: 1, tournamentName: 'Copa Davis', sport: 'tennis', playedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), role: 'viewer' },
];

export function getMockUserById(id: string): UserProfile | null {
  if (id === 'u1') return MOCK_USER_VIEWER;
  if (id === 'u2') return MOCK_USER_REFEREE;
  return null;
}

// ── Player profile mock data ──────────────────────────────

export interface PlayerEnrollment {
  id: string;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  sport: Sport;
  teamId: string;
  teamName: string;
  teamShortName: string;
  jerseyNumber?: number;
  position?: string;
  isActive: boolean;
  // Stats acumuladas en este torneo (shape depende del deporte)
  tournamentStats?: Record<string, number>;
  matchesPlayed: number;
}

// Stats por deporte — qué métricas muestra el perfil del jugador
export interface PlayerStatDef {
  key: string;       // key en tournamentStats
  label: string;     // "Goles", "Puntos", "Aces"
  shortLabel: string;// "G", "Pts", "A"
}

export const PLAYER_STAT_DEFS: Record<Sport, PlayerStatDef[]> = {
  football: [
    { key: 'goals',        label: 'Goles',        shortLabel: 'G'  },
    { key: 'assists',      label: 'Asistencias',  shortLabel: 'A'  },
    { key: 'yellowCards',  label: 'T. Amarillas', shortLabel: 'TA' },
    { key: 'redCards',     label: 'T. Rojas',     shortLabel: 'TR' },
    { key: 'minutesPlayed',label: 'Minutos',      shortLabel: 'Min'},
  ],
  basketball: [
    { key: 'points',       label: 'Puntos',       shortLabel: 'Pts'},
    { key: 'rebounds',     label: 'Rebotes',      shortLabel: 'Reb'},
    { key: 'assists',      label: 'Asistencias',  shortLabel: 'Ast'},
    { key: 'steals',       label: 'Robos',        shortLabel: 'Rob'},
    { key: 'blocks',       label: 'Bloqueos',     shortLabel: 'Blq'},
  ],
  tennis: [
    { key: 'aces',         label: 'Aces',         shortLabel: 'Ac' },
    { key: 'doubleFaults', label: 'Dobles faltas',shortLabel: 'DF' },
    { key: 'winners',      label: 'Winners',      shortLabel: 'W'  },
    { key: 'firstServePct',label: '1er Servicio', shortLabel: '1S' },
  ],
  volleyball: [
    { key: 'points',       label: 'Puntos',       shortLabel: 'Pts'},
    { key: 'aces',         label: 'Aces',         shortLabel: 'Ac' },
    { key: 'blocks',       label: 'Bloqueos',     shortLabel: 'Blq'},
    { key: 'attacks',      label: 'Ataques',      shortLabel: 'Atq'},
  ],
  baseball: [
    { key: 'hits',         label: 'Hits',         shortLabel: 'H'  },
    { key: 'runs',         label: 'Carreras',     shortLabel: 'R'  },
    { key: 'rbi',          label: 'Carreras imp.',shortLabel: 'RBI'},
    { key: 'strikeouts',   label: 'Ponches',      shortLabel: 'K'  },
  ],
  hockey: [
    { key: 'goals',        label: 'Goles',        shortLabel: 'G'  },
    { key: 'assists',      label: 'Asistencias',  shortLabel: 'A'  },
    { key: 'shots',        label: 'Tiros',        shortLabel: 'T'  },
    { key: 'penaltyMin',   label: 'Min. penalti', shortLabel: 'PIM'},
  ],
};

export interface PlayerProfileDetail {
  userId: string;
  name: string;
  email: string;
  role: 'PLAYER';
  createdAt: string;
  avatarUrl?: string;
  bio?: string;
  nationality?: string;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  dominantHand?: string;
  // Inscripciones activas e históricas
  enrollments: PlayerEnrollment[];
}

// Mock jugador multi-deporte
export const MOCK_USER_PLAYER: PlayerProfileDetail = {
  userId: 'u3',
  name: 'Sebastián Torres',
  email: 'sebas@example.com',
  role: 'PLAYER',
  createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
  bio: 'Delantero y ala en baloncesto. Juego fútbol desde los 8 años y basket desde los 15.',
  nationality: 'COL',
  dateOfBirth: '2000-03-14',
  height: 181,
  weight: 76,
  enrollments: [
    {
      id: 'enr1',
      tournamentId: 't1',
      tournamentName: 'Liga BetPlay Dimayor',
      tournamentSlug: 'liga-betplay-2025',
      sport: 'football',
      teamId: 'med',
      teamName: 'Independiente Medellín',
      teamShortName: 'MED',
      jerseyNumber: 11,
      position: 'Delantero',
      isActive: true,
      matchesPlayed: 14,
      tournamentStats: { goals: 7, assists: 3, yellowCards: 2, redCards: 0, minutesPlayed: 1180 },
    },
    {
      id: 'enr2',
      tournamentId: 't2',
      tournamentName: 'Liga Nacional de Baloncesto',
      tournamentSlug: 'lnb-2025',
      sport: 'basketball',
      teamId: 'buc',
      teamName: 'Búcaros de Bucaramanga',
      teamShortName: 'BUC',
      jerseyNumber: 23,
      position: 'Alero',
      isActive: true,
      matchesPlayed: 8,
      tournamentStats: { points: 112, rebounds: 34, assists: 18, steals: 9, blocks: 4 },
    },
    {
      id: 'enr3',
      tournamentId: 'told1',
      tournamentName: 'Copa BetPlay 2024',
      tournamentSlug: 'copa-betplay-2024',
      sport: 'football',
      teamId: 'med',
      teamName: 'Independiente Medellín',
      teamShortName: 'MED',
      jerseyNumber: 11,
      position: 'Delantero',
      isActive: false,
      matchesPlayed: 6,
      tournamentStats: { goals: 3, assists: 1, yellowCards: 1, redCards: 0, minutesPlayed: 430 },
    },
  ],
};

export function getMockPlayerById(userId: string): PlayerProfileDetail | null {
  if (userId === 'u3') return MOCK_USER_PLAYER;
  return null;
}
