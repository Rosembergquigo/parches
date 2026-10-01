/**
 * authz.ts — membresía de empresa y permisos de escritura.
 *
 * Organizar no vive en User.role: se infiere de OrganizationMember.
 * OWNER y ADMIN pueden editar la empresa; OWNER / ADMIN / EDITOR pueden
 * crear y editar torneos, equipos, grupos y partidos de esa empresa.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { OrgRole } from '@prisma/client';
import { prisma } from './prisma.js';

export const ORG_WRITE_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'EDITOR'];
export const ORG_ADMIN_ROLES: OrgRole[] = ['OWNER', 'ADMIN'];

export function userIdFrom(req: FastifyRequest): string {
  return (req.user as { sub: string }).sub;
}

export async function requireOrgRole(
  req: FastifyRequest,
  reply: FastifyReply,
  organizationId: string,
  allowed: OrgRole[] = ORG_WRITE_ROLES
): Promise<boolean> {
  const userId = userIdFrom(req);
  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!member || !allowed.includes(member.role)) {
    reply.status(403).send({ error: 'Not allowed to manage this organization' });
    return false;
  }
  return true;
}

/** Resuelve el torneo y exige membresía de escritura en su empresa. */
export async function requireTournamentEditor(
  req: FastifyRequest,
  reply: FastifyReply,
  organizationId: string
): Promise<boolean> {
  return requireOrgRole(req, reply, organizationId, ORG_WRITE_ROLES);
}

export type TeamRosterRole = 'editor' | 'captain';

type TeamRosterSubject = {
  id: string;
  captainUserId: string | null;
  captainEmail: string | null;
  tournament: { organizationId: string };
};

/**
 * Editor de la empresa o capitán del equipo (por userId o correo).
 * Si el correo coincide y aún no hay enlace, rellena captainUserId.
 */
export async function requireTeamRosterAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  team: TeamRosterSubject
): Promise<TeamRosterRole | null> {
  const userId = userIdFrom(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    reply.status(401).send({ error: 'Unauthorized' });
    return null;
  }

  const member = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId: team.tournament.organizationId } },
  });
  const editor = !!member && ORG_WRITE_ROLES.includes(member.role);
  const email = user.email.trim().toLowerCase();
  const captain =
    team.captainUserId === userId ||
    (!!team.captainEmail && team.captainEmail.trim().toLowerCase() === email);

  if (!editor && !captain) {
    reply.status(403).send({ error: 'Not allowed to manage this team' });
    return null;
  }

  if (captain && team.captainUserId !== userId) {
    await prisma.team.update({
      where: { id: team.id },
      data: { captainUserId: userId },
    });
  }

  return editor ? 'editor' : 'captain';
}
