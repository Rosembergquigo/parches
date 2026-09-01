import { prisma } from './prisma.js';

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Genera un slug único para un torneo a partir de su nombre.
 * Si ya existe, agrega un sufijo numérico (-2, -3, ...).
 */
export async function generateUniqueTournamentSlug(name: string): Promise<string> {
  const base = slugify(name) || 'torneo';
  let candidate = base;
  let n = 2;
  while (await prisma.tournament.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

/** Igual que el de torneos, sobre Organization.slug. */
export async function generateUniqueOrganizationSlug(name: string): Promise<string> {
  const base = slugify(name) || 'empresa';
  let candidate = base;
  let n = 2;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resuelve un torneo por id (uuid) o por slug — usado en todas las rutas /tournaments/:idOrSlug. */
export function tournamentWhere(idOrSlug: string) {
  return UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
}

export function organizationWhere(idOrSlug: string) {
  return UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
}
