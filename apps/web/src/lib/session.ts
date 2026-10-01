/**
 * Sesión por perfiles. El dropdown lista los roles de cuenta:
 *   VIEWER     → /profile
 *   PLAYER     → /me/player
 *   CAPTAIN    → /me/captain  (escudo y plantilla de sus equipos)
 *   REFEREE    → /me/referee
 *   ORGANIZER/ADMIN → /me/organizer  (un solo panel de administración)
 *
 * No se listan empresas ni atajos a crear/operar torneos.
 * Eso vive dentro del dashboard de organizador.
 *
 * Compartido: Base, Navbar, SessionMenu, marketplace, fichas públicas, ProfileShell.
 * Específico:
 *   Visualizador → ProfileHeader, UserSchedule, UserHistory
 *   Jugador      → PlayerProfileHeader, PlayerCareerSummary, PlayerEnrollmentCard
 *   Árbitro      → ProfileHeader + UserSchedule/UserHistory (datos referee)
 *   Organizador  → OrganizationsPanel + dashboards por empresa
 */
import { getOptionalUser, type AuthUser } from './auth';
import { getMyOrganizations } from './api';
import type { OrganizationSummary, OrgRole } from '../data/mock';

export type SessionModuleKind = 'viewer' | 'player' | 'captain' | 'referee' | 'organizer';

export interface SessionModule {
  id: string;
  kind: SessionModuleKind;
  label: string;
  href: string;
  hint?: string;
}

export interface SessionContext {
  user: AuthUser | null;
  organizations: OrganizationSummary[];
  modules: SessionModule[];
}

export function canOrganize(
  user: AuthUser,
  organizations: OrganizationSummary[]
): boolean {
  return (
    organizations.length > 0 ||
    user.role === 'ORGANIZER' ||
    user.role === 'ADMIN'
  );
}

export function canAdminOrg(role?: OrgRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function buildSessionModules(
  user: AuthUser,
  organizations: OrganizationSummary[]
): SessionModule[] {
  const modules: SessionModule[] = [
    {
      id: 'viewer',
      kind: 'viewer',
      label: 'Visualizador',
      href: '/profile',
      hint: 'Torneos seguidos',
    },
  ];

  if (user.role === 'PLAYER') {
    modules.push({
      id: 'player',
      kind: 'player',
      label: 'Jugador',
      href: '/me/player',
      hint: 'Carrera e inscripciones',
    });
  }

  if (user.isCaptain) {
    modules.push({
      id: 'captain',
      kind: 'captain',
      label: 'Capitán',
      href: '/me/captain',
      hint: 'Escudo y plantilla',
    });
  }

  if (user.role === 'REFEREE') {
    modules.push({
      id: 'referee',
      kind: 'referee',
      label: 'Árbitro',
      href: '/me/referee',
      hint: 'Partidos arbitrados',
    });
  }

  if (canOrganize(user, organizations)) {
    const isAdmin =
      user.role === 'ADMIN' || organizations.some(o => o.myRole === 'ADMIN' || o.myRole === 'OWNER');
    modules.push({
      id: 'organizer',
      kind: 'organizer',
      label: isAdmin && user.role === 'ADMIN' ? 'Admin' : 'Organizador',
      href: '/me/organizer',
      hint: 'Administración',
    });
  }

  return modules;
}

export function activeModuleId(path: string): string {
  if (path.startsWith('/me/player')) return 'player';
  if (path.startsWith('/me/captain')) return 'captain';
  if (path.startsWith('/me/referee')) return 'referee';
  if (path.startsWith('/me/organizer') || path === '/orgs/new') return 'organizer';
  if (/^\/orgs\/[^/]+\/(dashboard|tournaments|settings)/.test(path)) return 'organizer';
  if (path.startsWith('/settings')) return 'viewer';
  return 'viewer';
}

export async function getSessionContext(request: Request): Promise<SessionContext> {
  const user = await getOptionalUser(request).catch(() => null);
  if (!user) {
    return { user: null, organizations: [], modules: [] };
  }

  const organizations = await getMyOrganizations(request).catch(() => []);
  return {
    user,
    organizations,
    modules: buildSessionModules(user, organizations),
  };
}
