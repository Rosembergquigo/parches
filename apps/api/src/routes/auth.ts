import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Registro simplificado — en producción agregar hash de contraseña (bcrypt/argon2)
  app.post<{ Body: { email: string; name: string } }>(
    '/register',
    async (req, reply) => {
      const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (existing) return reply.status(409).send({ error: 'Email already registered' });
      const user = await prisma.user.create({ data: req.body });
      const token = app.jwt.sign({ sub: user.id, role: user.role });
      return reply.status(201).send({ user, token });
    }
  );

  app.post<{ Body: { email: string } }>(
    '/login',
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (!user) return reply.status(401).send({ error: 'User not found' });
      const token = app.jwt.sign({ sub: user.id, role: user.role });
      return reply.send({ user, token });
    }
  );

  app.get(
    '/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      return reply.send(user);
    }
  );
};
