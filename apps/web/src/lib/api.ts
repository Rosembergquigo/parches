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

import type { Tournament, Match } from '@parches/types';
import { ENDPOINTS } from '@parches/config';

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

  const res = await fetch(`${ENDPOINTS.API_HTTP}${path}`, {
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

  return res.json() as Promise<T>;
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
};

// ── Domain helpers (DRY para páginas) ───────────────────────

export async function getTournaments(request?: Request): Promise<Tournament[]> {
  return api.get<Tournament[]>('/tournaments', request);
}

export async function getTournament(slug: string, request?: Request): Promise<Tournament> {
  return api.get<Tournament>(`/tournaments/${slug}`, request);
}

export async function getMatch(id: string, request?: Request): Promise<Match> {
  return api.get<Match>(`/matches/${id}`, request);
}
