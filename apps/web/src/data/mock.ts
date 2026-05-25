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