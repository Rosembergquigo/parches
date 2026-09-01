/**
 * adapters.ts — convierte el JSON crudo de @parches/api (shape de Prisma)
 * a los tipos que ya consumen los componentes Astro (definidos en data/mock.ts).
 *
 * Por qué existe esta capa: así los componentes (TournamentRow, StandingsTable,
 * TeamsGrid, MatchFixture, TeamHero, ...) no necesitan cambiar una sola línea
 * al pasar de datos mockeados a datos reales — solo cambia de dónde viene el
 * objeto que reciben. Si el día de mañana el shape de la API cambia, el único
 * lugar que hay que tocar es este archivo.
 */
import type {
  Sport,
  MatchStatus,
  TeamSnippet,
  MatchSnippet,
  StandingsRow,
  StandingsGroup,
  MatchGroup,
  TournamentWithMatches,
  TournamentDetail,
  TeamDetail,
  TeamMatchItem,
  TeamPlayer,
  MatchDetail,
  MatchEvent as MockMatchEvent,
  EventType,
  UserProfile,
  UserRole,
  PlayerProfileDetail,
  PlayerEnrollment,
  ScheduledMatchItem,
  HistoryMatchItem,
  MatchStatRow,
  StatConfig,
  PlayerStat,
  OrgRole,
  OrganizationSummary,
  OrganizationDetail,
} from '../data/mock';

// ── Shapes crudos que devuelve @parches/api (ver apps/api/prisma/schema.prisma) ──

export interface RawTeam {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string | null;
  color?: string | null;
  tournamentId?: string;
  groupId?: string | null;
  group?: RawGroup | null;
}

export interface RawGroup {
  id: string;
  label: string;
  order: number;
}

export interface RawMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  homeScore: number;
  awayScore: number;
  status: 'SCHEDULED' | 'LIVE' | 'HALFTIME' | 'FINISHED';
  clock?: string | null;
  period?: string | null;
  stage?: string | null;
  venue?: string | null;
  streamKey?: string | null;
  hlsUrl?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  createdAt: string;
  tournament?: RawTournament;
  stats?: MatchStatRow[] | null;
}

export interface RawTournament {
  id: string;
  slug?: string | null;
  name: string;
  sport: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  startDate: string;
  endDate: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  description?: string | null;
  hasPlayoffs: boolean;
  qualifyingSpots?: number | null;
  organizationId?: string;
  teams: RawTeam[];
  groups?: RawGroup[];
  matches: RawMatch[];
}

export interface RawStandingsRow {
  position: number;
  team: RawTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  groupLabel?: string;
}

export interface RawStandingsResponse {
  groups: { id: string; label: string; standings: RawStandingsRow[] }[];
}

export interface RawPlayerStatRow {
  position: number;
  playerName: string;
  playerShortName: string;
  userId?: string;
  team: { id: string; name: string; shortName: string };
  statValue: number;
  statLabel?: string;
}

export interface RawPlayerStatConfig {
  id: string;
  tabLabel: string;
  colHeader: string;
  rows: RawPlayerStatRow[];
}

export interface RawOrganization {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  description?: string | null;
  city?: string | null;
  createdAt: string;
  myRole?: OrgRole | null;
  _count?: { members: number; tournaments: number };
  tournaments?: RawTournament[];
}

export interface RawTeamDetail extends RawTeam {
  tournament: RawTournament;
  standing?: RawStandingsRow;
  matches: RawMatch[];
  enrollments?: RawSquadEnrollment[];
}

export interface RawSquadEnrollment {
  id: string;
  jerseyNumber?: number | null;
  position?: string | null;
  playerProfile: { user: { id: string; name: string } };
}

export interface RawMatchEvent {
  id: string;
  type: string;
  clock: string;
  teamId?: string | null;
  playerId?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface RawMatchDetail extends RawMatch {
  tournament: RawTournament;
  events: RawMatchEvent[];
}

export interface RawPlayerTournamentStat {
  matchesPlayed: number;
  stats: Record<string, number>;
}

export interface RawPlayerEnrollment {
  id: string;
  teamId: string;
  team: RawTeam;
  tournamentId: string;
  tournament: RawTournament;
  jerseyNumber?: number | null;
  position?: string | null;
  isActive: boolean;
  tournamentStats?: RawPlayerTournamentStat | null;
}

export interface RawPlayerProfile {
  nationality?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  dominantHand?: string | null;
  enrollments: RawPlayerEnrollment[];
}

/** GET /api/users/:id — shape crudo (User + extensión según rol). */
export interface RawUser {
  id: string;
  email: string;
  name: string;
  role: 'VIEWER' | 'PLAYER' | 'REFEREE' | 'ORGANIZER' | 'ADMIN';
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  matchesRefereed?: number;
  eventsLogged?: number;
  playerProfile?: RawPlayerProfile | null;
}

/** GET /api/users/:id/referee-matches */
export interface RawRefereeMatches {
  scheduled: RawMatch[];
  finished: RawMatch[];
}

// ── Mappers de bajo nivel ──────────────────────────────────────

export function toTeamSnippet(team: RawTeam): TeamSnippet {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl ?? undefined,
    color: team.color ?? undefined,
  };
}

export function toMatchStatus(status: RawMatch['status']): MatchStatus {
  // El mock no distingue HALFTIME de LIVE — a nivel UI ambos son "en curso".
  return status === 'HALFTIME' ? 'LIVE' : status;
}

export function toMatchSnippet(match: RawMatch): MatchSnippet {
  return {
    id: match.id,
    homeTeam: toTeamSnippet(match.homeTeam),
    awayTeam: toTeamSnippet(match.awayTeam),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: toMatchStatus(match.status),
    clock: match.clock ?? undefined,
    period: match.period ?? undefined,
    venue: match.venue ?? undefined,
    scheduledAt: match.scheduledAt ?? undefined,
    streamKey: match.streamKey ?? undefined,
    // viewerCount vive en streaming-data (Redis), no en Postgres — sin dato por ahora.
    viewerCount: undefined,
  };
}

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set([
  'goal', 'yellow_card', 'red_card', 'foul', 'substitution',
  'period_start', 'period_end', 'timeout', 'score_update', 'custom',
]);

function toEventType(type: string): EventType {
  return (KNOWN_EVENT_TYPES.has(type) ? type : 'custom') as EventType;
}

/**
 * MatchEvent.playerId referencia un PlayerProfile — todavía no resolvemos
 * el nombre del jugador aquí (requeriría otro include/join). Por ahora el
 * feed muestra el evento sin nombre de jugador cuando falta ese dato.
 */
export function toMatchEvent(event: RawMatchEvent): MockMatchEvent {
  return {
    id: event.id,
    type: toEventType(event.type),
    clock: event.clock,
    teamId: event.teamId ?? undefined,
    description: event.description ?? undefined,
    timestamp: event.createdAt,
  };
}

export function toStandingsRow(row: RawStandingsRow): StandingsRow {
  return {
    position: row.position,
    team: toTeamSnippet(row.team),
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
  };
}

/** Agrupa partidos por su `stage` ("Jornada 18", "Grupo A", ...) para el fixture. */
function groupMatchesByStage(matches: RawMatch[], fallbackLabel: string): MatchGroup[] {
  const buckets = new Map<string, MatchSnippet[]>();
  for (const m of matches) {
    const label = m.stage ?? fallbackLabel;
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(toMatchSnippet(m));
  }
  return [...buckets.entries()].map(([label, snippets]) => ({ label, matches: snippets }));
}

// ── Mappers de alto nivel (uno por página) ─────────────────────

/** Para pages/index.astro — fila de torneo con su strip de partidos recientes. */
export function mapTournamentListItem(raw: RawTournament): TournamentWithMatches {
  const stages = new Set(raw.matches.map(m => m.stage).filter(Boolean));
  return {
    id: raw.id,
    slug: raw.slug ?? raw.id,
    name: raw.name,
    sport: raw.sport as Sport,
    status: raw.status,
    stage: stages.size === 1 ? [...stages][0]! : undefined,
    teamCount: raw.teams.length,
    matches: raw.matches.map(toMatchSnippet),
  };
}

/**
 * Para pages/tournaments/[slug].astro — combina el detalle del torneo con
 * su tabla de posiciones (endpoint separado /standings, porque se calcula
 * al vuelo desde los Match FINISHED).
 */
export function mapTournamentDetail(
  raw: RawTournament,
  rawStandings?: RawStandingsResponse,
  rawPlayerStats?: RawPlayerStatConfig[]
): TournamentDetail {
  const stages = new Set(raw.matches.map(m => m.stage).filter(Boolean));

  // Los cruces ya generados (stage="Cruces") van al bracket de playoffs;
  // el resto del fixture ("Grupo A", "Jornada 18", null...) es todos-contra-todos.
  const playoffMatches = raw.matches.filter(m => m.stage === 'Cruces');
  const regularMatches = raw.matches.filter(m => m.stage !== 'Cruces');

  const detail: TournamentDetail = {
    id: raw.id,
    slug: raw.slug ?? raw.id,
    name: raw.name,
    sport: raw.sport as Sport,
    status: raw.status,
    stage: stages.size === 1 ? [...stages][0]! : undefined,
    teamCount: raw.teams.length,
    matches: raw.matches.map(toMatchSnippet),
    description: raw.description ?? undefined,
    brandColor: raw.brandColor ?? undefined,
    logoUrl: raw.logoUrl ?? undefined,
    backgroundImageUrl: raw.backgroundImageUrl ?? undefined,
    qualifyingSpots: raw.qualifyingSpots ?? 4,
    policies: { playoffs: raw.hasPlayoffs },
    groups: regularMatches.length > 0 ? groupMatchesByStage(regularMatches, 'Partidos') : undefined,
    playoffGroups: playoffMatches.length > 0 ? [{ label: 'Cruces', matches: playoffMatches.map(toMatchSnippet) }] : undefined,
  };

  if (rawStandings?.groups.length) {
    if (rawStandings.groups.length === 1) {
      detail.standings = rawStandings.groups[0]!.standings.map(toStandingsRow);
    } else {
      detail.standingsGroups = rawStandings.groups.map((g): StandingsGroup => ({
        label: g.label,
        standings: g.standings.map(toStandingsRow),
      }));
    }
  }

  if (rawPlayerStats?.length) {
    detail.playerStats = rawPlayerStats.map((cfg): StatConfig => ({
      id: cfg.id,
      tabLabel: cfg.tabLabel,
      colHeader: cfg.colHeader,
      rows: cfg.rows.map((row): PlayerStat => ({
        position: row.position,
        playerName: row.playerName,
        playerShortName: row.playerShortName,
        userId: row.userId,
        team: { id: row.team.id, name: row.team.name, shortName: row.team.shortName },
        statValue: row.statValue,
        statLabel: row.statLabel,
      })),
    }));
  }

  return detail;
}

/** Para pages/teams/[id].astro. */
export function mapTeamDetail(raw: RawTeamDetail): TeamDetail {
  const recentMatches: TeamMatchItem[] = raw.matches.map(m => ({
    matchId: m.id,
    homeTeam: toTeamSnippet(m.homeTeam),
    awayTeam: toTeamSnippet(m.awayTeam),
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: toMatchStatus(m.status),
    clock: m.clock ?? undefined,
    period: m.period ?? undefined,
    venue: m.venue ?? undefined,
    scheduledAt: m.scheduledAt ?? undefined,
    tournamentName: raw.tournament.name,
    tournamentSlug: raw.tournament.slug ?? raw.tournament.id,
    roundLabel: m.stage ?? undefined,
  }));

  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName,
    logoUrl: raw.logoUrl ?? undefined,
    tournamentId: raw.tournament.id,
    tournamentName: raw.tournament.name,
    tournamentSlug: raw.tournament.slug ?? raw.tournament.id,
    sport: raw.tournament.sport as Sport,
    brandColor: raw.tournament.brandColor ?? undefined,
    standing: raw.standing
      ? {
          position: raw.standing.position,
          played: raw.standing.played,
          won: raw.standing.won,
          drawn: raw.standing.drawn,
          lost: raw.standing.lost,
          goalsFor: raw.standing.goalsFor,
          goalsAgainst: raw.standing.goalsAgainst,
          points: raw.standing.points,
        }
      : undefined,
    squad: toTeamSquad(raw.enrollments),
    recentMatches,
  };
}

/** Plantilla del equipo — una fila por inscripción activa. */
function toTeamSquad(enrollments?: RawSquadEnrollment[]): TeamPlayer[] {
  if (!enrollments) return [];
  return enrollments.map(e => ({
    id: e.id,
    userId: e.playerProfile.user.id,
    name: e.playerProfile.user.name,
    shortName: e.playerProfile.user.name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]!.toUpperCase())
      .join(''),
    jerseyNumber: e.jerseyNumber ?? undefined,
    position: e.position ?? undefined,
  }));
}

/**
 * Para pages/matches/[id]/index.astro.
 *
 * `viewerCount` (streaming-data/Redis) todavía no existe en la API real —
 * queda undefined y el panel que depende de él simplemente no se renderiza,
 * igual que squad/playerStats en las otras páginas ya conectadas. `stats`
 * sí existe (Match.stats, Json?) pero es opcional: si el partido no tiene
 * estadísticas cargadas, la pestaña Estadísticas tampoco se muestra.
 */
export function mapMatchDetail(raw: RawMatchDetail): MatchDetail {
  return {
    id: raw.id,
    tournamentId: raw.tournament.id,
    tournamentName: raw.tournament.name,
    tournamentSlug: raw.tournament.slug ?? raw.tournament.id,
    sport: raw.tournament.sport as Sport,
    homeTeam: toTeamSnippet(raw.homeTeam),
    awayTeam: toTeamSnippet(raw.awayTeam),
    homeScore: raw.homeScore,
    awayScore: raw.awayScore,
    status: toMatchStatus(raw.status),
    clock: raw.clock ?? undefined,
    period: raw.period ?? undefined,
    venue: raw.venue ?? undefined,
    scheduledAt: raw.scheduledAt ?? undefined,
    streamKey: raw.streamKey ?? undefined,
    hlsUrl: raw.hlsUrl ?? undefined,
    viewerCount: undefined,
    events: raw.events.map(toMatchEvent),
    stats: raw.stats ?? undefined,
  };
}

/** Para pages/users/[id].astro y el bloque VIEWER/REFEREE de pages/profile.astro. */
export function mapUserProfile(raw: RawUser): UserProfile {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role as UserRole,
    createdAt: raw.createdAt,
    avatarUrl: raw.avatarUrl ?? undefined,
    bio: raw.bio ?? undefined,
    matchesRefereed: raw.matchesRefereed,
    eventsLogged: raw.eventsLogged,
  };
}

function toPlayerEnrollment(e: RawPlayerEnrollment): PlayerEnrollment {
  return {
    id: e.id,
    tournamentId: e.tournamentId,
    tournamentName: e.tournament.name,
    tournamentSlug: e.tournament.slug ?? e.tournament.id,
    sport: e.tournament.sport as Sport,
    teamId: e.teamId,
    teamName: e.team.name,
    teamShortName: e.team.shortName,
    jerseyNumber: e.jerseyNumber ?? undefined,
    position: e.position ?? undefined,
    isActive: e.isActive,
    tournamentStats: e.tournamentStats?.stats,
    matchesPlayed: e.tournamentStats?.matchesPlayed ?? 0,
  };
}

/** Para el bloque PLAYER de pages/profile.astro — requiere raw.playerProfile presente. */
export function mapPlayerProfile(raw: RawUser): PlayerProfileDetail {
  const pp = raw.playerProfile;
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: 'PLAYER',
    createdAt: raw.createdAt,
    avatarUrl: raw.avatarUrl ?? undefined,
    bio: raw.bio ?? undefined,
    nationality: pp?.nationality ?? undefined,
    dateOfBirth: pp?.dateOfBirth ?? undefined,
    height: pp?.height ?? undefined,
    weight: pp?.weight ?? undefined,
    dominantHand: pp?.dominantHand ?? undefined,
    enrollments: (pp?.enrollments ?? []).map(toPlayerEnrollment),
  };
}

/** Fecha de referencia para ordenar/mostrar un partido de árbitro en la UI. */
function refereeMatchDate(m: RawMatch): string {
  return m.scheduledAt ?? m.startedAt ?? m.createdAt;
}

/** Para UserSchedule en pages/profile.astro (rol REFEREE) — próximos partidos asignados. */
export function mapRefereeSchedule(matches: RawMatch[]): ScheduledMatchItem[] {
  return matches.map(m => ({
    matchId: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    tournamentName: m.tournament?.name ?? '',
    sport: (m.tournament?.sport as Sport) ?? 'football',
    scheduledAt: refereeMatchDate(m),
    status: toMatchStatus(m.status),
    role: 'referee',
  }));
}

/** Para UserHistory en pages/profile.astro (rol REFEREE) — partidos arbitrados ya jugados. */
export function mapRefereeHistory(matches: RawMatch[]): HistoryMatchItem[] {
  return matches.map(m => ({
    matchId: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    tournamentName: m.tournament?.name ?? '',
    sport: (m.tournament?.sport as Sport) ?? 'football',
    playedAt: refereeMatchDate(m),
    role: 'referee',
  }));
}

export function mapOrganizationSummary(raw: RawOrganization): OrganizationSummary {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    logoUrl: raw.logoUrl ?? undefined,
    brandColor: raw.brandColor ?? undefined,
    city: raw.city ?? undefined,
    myRole: raw.myRole ?? 'EDITOR',
    memberCount: raw._count?.members ?? 0,
    tournamentCount: raw._count?.tournaments ?? 0,
  };
}

export function mapOrganizationDetail(raw: RawOrganization): OrganizationDetail {
  return {
    ...mapOrganizationSummary(raw),
    description: raw.description ?? undefined,
    createdAt: raw.createdAt,
    myRole: raw.myRole ?? undefined,
    tournaments: (raw.tournaments ?? []).map(mapTournamentListItem),
  };
}
