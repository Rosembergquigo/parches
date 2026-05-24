import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const tournamentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const tournaments = await prisma.tournament.findMany({
      include: { teams: true },
      orderBy: { startDate: 'desc' },
    });
    return reply.send(tournaments);
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { teams: true, matches: { include: { homeTeam: true, awayTeam: true } } },
    });
    if (!tournament) return reply.status(404).send({ error: 'Not found' });
    return reply.send(tournament);
  });

  app.post<{ Body: { name: string; sport: string; startDate: string; endDate: string } }>(
    '/',
    async (req, reply) => {
      const tournament = await prisma.tournament.create({ data: req.body });
      return reply.status(201).send(tournament);
    }
  );
};
