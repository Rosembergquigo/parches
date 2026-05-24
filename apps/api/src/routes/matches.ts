import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const matchRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!match) return reply.status(404).send({ error: 'Not found' });
    return reply.send(match);
  });

  app.patch<{
    Params: { id: string };
    Body: { homeScore?: number; awayScore?: number; status?: string };
  }>('/:id', async (req, reply) => {
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return reply.send(match);
  });
};
