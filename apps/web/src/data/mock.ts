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
