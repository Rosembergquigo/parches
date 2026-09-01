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
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { generateUniqueOrganizationSlug, organizationWhere } from '../lib/slug.js';
import { ORG_ADMIN_ROLES, requireOrgRole, userIdFrom } from '../lib/authz.js';

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

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description: req.body.description,
        city: req.body.city,
        brandColor: req.body.brandColor,
        logoUrl: req.body.logoUrl,
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

    return reply.send({ ...organization, myRole });
  });

  app.patch<{
    Params: { idOrSlug: string };
    Body: Partial<{
      name: string;
      description: string;
      city: string;
      brandColor: string;
      logoUrl: string;
    }>;
  }>('/:idOrSlug', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await prisma.organization.findFirst({
      where: organizationWhere(req.params.idOrSlug),
    });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!(await requireOrgRole(req, reply, existing.id, ORG_ADMIN_ROLES))) return;

    const organization = await prisma.organization.update({
      where: { id: existing.id },
      data: req.body,
      include: { _count: { select: { members: true, tournaments: true } } },
    });
    return reply.send(organization);
  });
};
