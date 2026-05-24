/**
 * Gestión de autenticación para páginas Astro SSR.
 *
 * Usa una cookie httpOnly llamada `token` que contiene el JWT
 * emitido por @parches/api en /auth/login.
 *
 * Patrón de uso en páginas protegidas:
 *
 *   ---
 *   import { requireAuth } from '../lib/auth';
 *   const user = await requireAuth(Astro);
 *   // Si no está autenticado, requireAuth ya hizo redirect a /login
 *   ---
 */

import { jwtVerify } from 'jose';
import type { AstroGlobal } from 'astro';
import { api, ApiError } from './api';

// ── Tipos ────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'VIEWER' | 'REFEREE' | 'ORGANIZER' | 'ADMIN';
}

export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

// ── Cookie helpers ───────────────────────────────────────────

const COOKIE_NAME = 'token';
const JWT_SECRET = new TextEncoder().encode(
  import.meta.env.JWT_SECRET ?? 'dev-secret-change-in-prod'
);

/**
 * Lee y verifica el JWT de la cookie.
 * Retorna el payload si es válido, null si no existe o expiró.
 */
export async function getJwtPayload(request: Request): Promise<JwtPayload | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;  // expirado o inválido
  }
}

/**
 * Auth guard para páginas protegidas.
 * Si no hay sesión válida → redirect a /login con `next` param.
 * Si la hay → retorna el usuario desde la API.
 */
export async function requireAuth(astro: AstroGlobal): Promise<AuthUser> {
  const payload = await getJwtPayload(astro.request);

  if (!payload) {
    const next = encodeURIComponent(astro.url.pathname);
    return astro.redirect(`/login?next=${next}`) as never;
  }

  try {
    const user = await api.get<AuthUser>('/auth/me', astro.request);
    return user;
  } catch (err) {
    // Token válido pero el usuario no existe en el api → limpiar cookie
    if (err instanceof ApiError && err.status === 401) {
      return astro.redirect('/login') as never;
    }
    throw err;
  }
}

/**
 * Verifica si el request tiene sesión activa (sin redirigir).
 * Útil para mostrar UI condicional en páginas públicas (nav login/logout).
 */
export async function getOptionalUser(request: Request): Promise<AuthUser | null> {
  const payload = await getJwtPayload(request);
  if (!payload) return null;

  try {
    return await api.get<AuthUser>('/auth/me', request);
  } catch {
    return null;
  }
}

/**
 * Genera el header Set-Cookie para el token JWT.
 * Llamado desde el endpoint de login.
 */
export function buildTokenCookie(token: string, maxAgeDays = 7): string {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    import.meta.env.PROD ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

/**
 * Cookie vacía para logout — sobreescribe el token con expiración inmediata.
 */
export function buildLogoutCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}
