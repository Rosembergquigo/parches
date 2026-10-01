/**
 * Typed fetch helper para el servidor @parches/api.
 *
 * Uso en el frontmatter de páginas Astro (server-side):
 *   const tournaments = await apiGet<Tournament[]>('/tournaments', Astro.request);
 *
 * El segundo argumento `request` es opcional — se usa para pasar
 * el header Authorization con el JWT de la cookie del usuario actual.
 * Si no se pasa, la petición se hace sin autenticación (para rutas públicas).
 */

import { ENDPOINTS } from '@parches/config';
import type {
  TournamentWithMatches,
  TournamentDetail,
  TeamDetail,
  MatchDetail,
  UserProfile,
  PlayerProfileDetail,
  ScheduledMatchItem,
  HistoryMatchItem,
  OrganizationSummary,
  OrganizationDetail,
  TournamentNewsPost,
  TournamentNewsCategory,
} from '../data/mock';
import {
  mapTournamentListItem,
  mapTournamentDetail,
  mapTeamDetail,
  mapMatchDetail,
  mapUserProfile,
  mapPlayerProfile,
  mapRefereeSchedule,
  mapRefereeHistory,
  mapOrganizationSummary,
  mapOrganizationDetail,
  type RawTournament,
  type RawStandingsResponse,
  type RawPlayerStatConfig,
  type RawTeamDetail,
  type RawMatchDetail,
  type RawUser,
  type RawRefereeMatches,
  type RawOrganization,
} from './adapters';

// ── Core fetch helper ────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  request?: Request
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  // Propagar el JWT de la cookie al api server
  if (request) {
    const cookie = request.headers.get('cookie') ?? '';
    const match = cookie.match(/token=([^;]+)/);
    if (match) headers['Authorization'] = `Bearer ${match[1]}`;
  }

  const res = await fetch(`${ENDPOINTS.API_HTTP}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch { /* ignore parse errors */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Typed API methods ────────────────────────────────────────

export const api = {
  /** GET genérico tipado */
  get<T>(path: string, request?: Request): Promise<T> {
    return apiFetch<T>(path, { method: 'GET' }, request);
  },

  /** POST genérico tipado */
  post<T>(path: string, body: unknown, request?: Request): Promise<T> {
    return apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }, request);
  },

  /** PATCH genérico tipado */
  patch<T>(path: string, body: unknown, request?: Request): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, request);
  },

  /** DELETE genérico tipado — 204 sin body. */
  delete<T>(path: string, request?: Request): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE' }, request);
  },
};

// ── Domain helpers (DRY para páginas) ───────────────────────
//
// Devuelven datos ya adaptados al shape de data/mock.ts (ver lib/adapters.ts),
// así las páginas y componentes Astro no necesitan saber nada del shape
// crudo de Prisma/Fastify.

/** Torneos con su strip de partidos recientes — para pages/index.astro. */
export async function getTournamentsWithMatches(request?: Request): Promise<TournamentWithMatches[]> {
  const raw = await api.get<RawTournament[]>('/tournaments', request);
  return raw.map(mapTournamentListItem);
}

/**
 * Torneo completo (detalle + tabla de posiciones) por id o slug —
 * para pages/tournaments/[slug].astro. Devuelve null si no existe (404).
 */
export async function getTournamentDetail(idOrSlug: string, request?: Request): Promise<TournamentDetail | null> {
  let raw: RawTournament;
  try {
    raw = await api.get<RawTournament>(`/tournaments/${idOrSlug}`, request);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }

  let standings: RawStandingsResponse | undefined;
  try {
    standings = await api.get<RawStandingsResponse>(`/tournaments/${idOrSlug}/standings`, request);
  } catch {
    standings = undefined; // la tabla es un nice-to-have; si falla, la página igual renderiza sin tabla
  }

  let playerStats: RawPlayerStatConfig[] | undefined;
  try {
    playerStats = await api.get<RawPlayerStatConfig[]>(`/tournaments/${idOrSlug}/player-stats`, request);
  } catch {
    playerStats = undefined; // idem: goleadores/valla son nice-to-have
  }

  return mapTournamentDetail(raw, standings, playerStats);
}

/** Equipo con su tabla y sus partidos — para pages/teams/[id].astro. Null si no existe (404). */
export async function getTeamDetail(id: string, request?: Request): Promise<TeamDetail | null> {
  try {
    const raw = await api.get<RawTeamDetail>(`/teams/${id}`, request);
    return mapTeamDetail(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Partido con su cronología de eventos — para pages/matches/[id]/index.astro. Null si no existe (404). */
export async function getMatchDetail(id: string, request?: Request): Promise<MatchDetail | null> {
  try {
    const raw = await api.get<RawMatchDetail>(`/matches/${id}`, request);
    return mapMatchDetail(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Perfil de usuario por id — para pages/users/[id].astro (público) y
 * pages/profile.astro (cuenta visualizador) y pages/users/[id].astro.
 * Null si no existe (404). Para el módulo jugador usar `getPlayerProfile`.
 */
export async function getUserProfile(id: string, request?: Request): Promise<UserProfile | null> {
  try {
    const raw = await api.get<RawUser>(`/users/${id}`, request);
    return mapUserProfile(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Perfil de jugador (con inscripciones y stats) — para /me/player. */
export async function getPlayerProfile(id: string, request?: Request): Promise<PlayerProfileDetail | null> {
  try {
    const raw = await api.get<RawUser>(`/users/${id}`, request);
    return mapPlayerProfile(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Próximos partidos asignados + historial arbitrado — para /me/referee. */
export async function getRefereeMatches(
  id: string,
  request?: Request
): Promise<{ schedule: ScheduledMatchItem[]; history: HistoryMatchItem[] }> {
  const raw = await api.get<RawRefereeMatches>(`/users/${id}/referee-matches`, request);
  return {
    schedule: mapRefereeSchedule(raw.scheduled),
    history: mapRefereeHistory(raw.finished),
  };
}

/**
 * Perfil público por id — para pages/users/[id].astro. Un solo fetch que
 * se auto-discrimina según el rol real (no se sabe de antemano si el id
 * corresponde a un jugador o no). Null si no existe (404).
 */
export type PublicProfile =
  | { role: 'PLAYER'; player: PlayerProfileDetail }
  | { role: 'VIEWER' | 'REFEREE' | 'ORGANIZER' | 'ADMIN'; user: UserProfile };

export async function getPublicProfile(id: string, request?: Request): Promise<PublicProfile | null> {
  let raw: RawUser;
  try {
    raw = await api.get<RawUser>(`/users/${id}`, request);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
  if (raw.role === 'PLAYER') return { role: 'PLAYER', player: mapPlayerProfile(raw) };
  return { role: raw.role, user: mapUserProfile(raw) };
}

/** Empresas del usuario autenticado — sesión y cuenta visualizador. */
export async function getMyOrganizations(request: Request): Promise<OrganizationSummary[]> {
  try {
    const raw = await api.get<RawOrganization[]>('/organizations/me', request);
    return raw.map(mapOrganizationSummary);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return [];
    throw err;
  }
}

export type RawTournamentPost = {
  id: string;
  category: 'COMUNICADO' | 'NOTICIA' | 'ANUNCIO';
  title: string;
  body: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
};

const POST_CATEGORY_LABEL: Record<RawTournamentPost['category'], TournamentNewsCategory> = {
  COMUNICADO: 'Comunicado',
  NOTICIA: 'Noticia',
  ANUNCIO: 'Anuncio',
};

export function mapTournamentPost(raw: RawTournamentPost): TournamentNewsPost {
  return {
    id: raw.id,
    category: POST_CATEGORY_LABEL[raw.category] ?? 'Noticia',
    title: raw.title,
    excerpt: raw.excerpt ?? raw.body.slice(0, 180),
    body: raw.body,
    author: raw.author?.name ?? 'Organización',
    publishedAt: raw.createdAt,
    pinned: raw.pinned,
    coverImageUrl: raw.coverImageUrl ?? undefined,
    imageUrls: raw.imageUrls ?? [],
  };
}

/** Posts del foro / blog de un torneo. */
export async function getTournamentPosts(
  tournamentIdOrSlug: string,
  request?: Request
): Promise<TournamentNewsPost[]> {
  try {
    const raw = await api.get<RawTournamentPost[]>(`/tournaments/${tournamentIdOrSlug}/posts`, request);
    return raw.map(mapTournamentPost);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

export async function getTournamentPost(
  tournamentIdOrSlug: string,
  postId: string,
  request?: Request
): Promise<TournamentNewsPost | null> {
  try {
    const raw = await api.get<RawTournamentPost>(
      `/tournaments/${tournamentIdOrSlug}/posts/${postId}`,
      request
    );
    return mapTournamentPost(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function uploadImage(
  file: File,
  request: Request,
  kind: 'posts' | 'teams' | 'tournaments' | 'orgs' | 'users' = 'posts'
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await api.post<{ url: string }>('/uploads', {
    filename: file.name,
    mime: file.type,
    data: buffer.toString('base64'),
    kind,
  }, request);
  return url;
}

export async function uploadPostImage(
  file: File,
  request: Request
): Promise<string> {
  return uploadImage(file, request, 'posts');
}

export async function uploadTeamLogo(
  file: File,
  request: Request
): Promise<string> {
  return uploadImage(file, request, 'teams');
}

export async function uploadTournamentLogo(
  file: File,
  request: Request
): Promise<string> {
  return uploadImage(file, request, 'tournaments');
}

export async function uploadUserAvatar(
  file: File,
  request: Request
): Promise<string> {
  return uploadImage(file, request, 'users');
}

export type RefereeOption = { id: string; name: string };

export type TeamEnrollment = {
  id: string;
  jerseyNumber: number | null;
  position: string | null;
  isActive: boolean;
  joinedAt: string;
  player: {
    id: string;
    playerProfileId: string;
    email: string;
    name: string;
    phone: string | null;
  };
};

export type AddTeamPlayerInput = {
  email: string;
  name?: string;
  phone?: string;
  jerseyNumber?: number | null;
  position?: string;
};

export type UpdateTeamEnrollmentInput = {
  jerseyNumber?: number | null;
  position?: string | null;
  isActive?: boolean;
  name?: string;
  phone?: string | null;
};

export type CaptainedTeam = {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string | null;
  color?: string | null;
  captainName?: string | null;
  tournament: {
    id: string;
    name: string;
    slug: string;
    sport: string;
    organization: { name: string; slug: string };
  };
};

export function listCaptainedTeams(request: Request): Promise<CaptainedTeam[]> {
  return api.get<CaptainedTeam[]>('/teams/captained', request);
}

export type TournamentEntry = {
  teamId: string;
  teamName: string;
  shortName: string;
  enrollmentId: string;
};

export async function getMyTournamentEntry(
  tournamentIdOrSlug: string,
  request: Request
): Promise<TournamentEntry | null> {
  try {
    return await api.get<TournamentEntry>(`/tournaments/${tournamentIdOrSlug}/entries/me`, request);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 401)) return null;
    throw err;
  }
}

export function enrollInTournament(
  tournamentIdOrSlug: string,
  request: Request
): Promise<TournamentEntry> {
  return api.post<TournamentEntry>(`/tournaments/${tournamentIdOrSlug}/entries`, {}, request);
}

/** Plantilla del equipo (activos e inactivos). Requiere editor o capitán. */
export function listTeamEnrollments(teamId: string, request: Request): Promise<TeamEnrollment[]> {
  return api.get<TeamEnrollment[]>(`/teams/${teamId}/enrollments`, request);
}

/** Inscribe un jugador por correo (crea el usuario si no existe). */
export function addTeamPlayer(
  teamId: string,
  body: AddTeamPlayerInput,
  request: Request
): Promise<TeamEnrollment> {
  return api.post<TeamEnrollment>(`/teams/${teamId}/enrollments`, body, request);
}

/** Edita dorsal, posición, estado o datos de contacto del inscrito. */
export function updateTeamEnrollment(
  teamId: string,
  enrollmentId: string,
  body: UpdateTeamEnrollmentInput,
  request: Request
): Promise<TeamEnrollment> {
  return api.patch<TeamEnrollment>(`/teams/${teamId}/enrollments/${enrollmentId}`, body, request);
}

/** Da de baja al jugador del equipo (conserva historial). */
export function removeTeamPlayer(
  teamId: string,
  enrollmentId: string,
  request: Request
): Promise<void> {
  return api.delete(`/teams/${teamId}/enrollments/${enrollmentId}`, request);
}

/** Árbitros disponibles para asignar a un partido. */
export async function getReferees(request: Request): Promise<RefereeOption[]> {
  try {
    return await api.get<RefereeOption[]>('/users/referees', request);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return [];
    throw err;
  }
}

/** Ficha pública de empresa — para pages/orgs/[slug].astro. Null si no existe (404). */
export async function getOrganization(idOrSlug: string, request?: Request): Promise<OrganizationDetail | null> {
  try {
    const raw = await api.get<RawOrganization>(`/organizations/${idOrSlug}`, request);
    return mapOrganizationDetail(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
