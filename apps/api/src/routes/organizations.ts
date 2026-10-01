/**
 * routes/organizations.ts — CRUD de empresas.
 *
 *   POST   /                 crear (auth). El creador queda OWNER.
 *   GET    /me               empresas del usuario logueado.
 *   GET    /:idOrSlug        ficha pública (+ myRole si hay sesión).
 *   PATCH  /:idOrSlug        editar (OWNER / ADMIN).
 *
 * GET /me se registra antes de /:idOrSlug para que "me" no se tome como slug.
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { generateUniqueOrganizationSlug, organizationWhere } from '../lib/slug.js';
import { ORG_ADMIN_ROLES, requireOrgRole, userIdFrom } from '../lib/authz.js';
import { parseTeamColor } from '../lib/enrollments.js';
import { withTournamentLooks } from '../lib/playerPhoto.js';

function parseOrgLogoUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw Object.assign(new Error('El logo no es válido'), { statusCode: 400 });
  }
  const value = raw.trim();
  if (/^\/uploads\/orgs\/[A-Za-z0-9._-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return value;
  } catch {
    /* fall through */
  }
  throw Object.assign(new Error('El logo no es válido'), { statusCode: 400 });
}

function sendParseError(reply: FastifyReply, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return reply.status(e.statusCode ?? 400).send({ error: e.message });
}

const orgPublicInclude = {
  tournaments: {
    include: {
      teams: true,
      matches: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ status: 'asc' as const }, { scheduledAt: 'asc' as const }, { createdAt: 'desc' as const }],
        take: 6,
      },
    },
    orderBy: { startDate: 'desc' as const },
  },
  _count: { select: { members: true, tournaments: true } },
};

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      name: string;
      description?: string;
      city?: string;
      brandColor?: string;
      logoUrl?: string;
    };
  }>('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const name = req.body?.name?.trim();
    if (!name) return reply.status(400).send({ error: 'name is required' });

    const slug = await generateUniqueOrganizationSlug(name);
    const userId = userIdFrom(req);

    let brandColor: string | null | undefined;
    let logoUrl: string | null | undefined;
    try {
      brandColor = parseTeamColor(req.body.brandColor);
      logoUrl = parseOrgLogoUrl(req.body.logoUrl);
    } catch (err) {
      return sendParseError(reply, err);
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description: req.body.description?.trim() || null,
        city: req.body.city?.trim() || null,
        brandColor: brandColor ?? null,
        logoUrl: logoUrl ?? null,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: { _count: { select: { members: true, tournaments: true } } },
    });

    return reply.status(201).send({ ...organization, myRole: 'OWNER' });
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = userIdFrom(req);
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: { _count: { select: { members: true, tournaments: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(
      memberships.map(m => ({
        ...m.organization,
        myRole: m.role,
      }))
    );
  });

  app.get<{ Params: { idOrSlug: string } }>('/:idOrSlug', async (req, reply) => {
    const organization = await prisma.organization.findFirst({
      where: organizationWhere(req.params.idOrSlug),
      include: orgPublicInclude,
    });
    if (!organization) return reply.status(404).send({ error: 'Not found' });

    let myRole: string | undefined;
    try {
      await req.jwtVerify();
      const userId = userIdFrom(req);
      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: organization.id } },
      });
      myRole = member?.role;
    } catch {
      // público — sin sesión
    }

    const tournaments = await Promise.all(
      organization.tournaments.map(t => withTournamentLooks(t)),
    );
    return reply.send({ ...organization, tournaments, myRole });
  });

  app.patch<{
    Params: { idOrSlug: string };
    Body: Partial<{
      name: string;
      description: string | null;
      city: string | null;
      brandColor: string | null;
      logoUrl: string | null;
    }>;
  }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.organization.findFirst({
      where: organizationWhere(req.params.idOrSlug),
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireOrgRole(req, reply, existing.id, ORG_ADMIN_ROLES))) return;

    const body = req.body ?? {};
    const data: {
      name?: string;
      description?: string | null;
      city?: string | null;
      brandColor?: string | null;
      logoUrl?: string | null;
    } = {};

    if (body.name !== undefined) {
      const nextName = body.name.trim();
      if (!nextName) return reply.status(400).send({ error: 'name is required' });
      data.name = nextName;
    }
    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' ? (body.description.trim() || null) : null;
    }
    if (body.city !== undefined) {
      data.city = typeof body.city === 'string' ? (body.city.trim() || null) : null;
    }
    try {
      if (body.brandColor !== undefined) {
        const color = parseTeamColor(body.brandColor);
        if (color !== undefined) data.brandColor = color;
      }
      if (body.logoUrl !== undefined) {
        const logo = parseOrgLogoUrl(body.logoUrl);
        if (logo !== undefined) data.logoUrl = logo;
      }
    } catch (err) {
      return sendParseError(reply, err);
    }

    const organization = await prisma.organization.update({
      where: { id: existing.id },
      data,
      include: { _count: { select: { members: true, tournaments: true } } },
    });
    return reply.send(organization);
  });
};
