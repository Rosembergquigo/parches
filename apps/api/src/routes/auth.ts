import type { FastifyPluginAsync } from 'fastify';
import { INDIVIDUAL_SPORTS } from '@parches/config';
import { parseUserAvatarUrl } from '../lib/playerPhoto.js';
import { normalizeEmail, parseTeamColor } from '../lib/enrollments.js';
import {
  hashPassword,
  loginFailed,
  parsePassword,
  verifyPassword,
  withoutPasswordHash,
} from '../lib/password.js';
import { prisma } from '../lib/prisma.js';

function parseName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw Object.assign(new Error('El nombre es obligatorio'), { statusCode: 400 });
  }
  const name = raw.trim();
  if (!name) throw Object.assign(new Error('El nombre es obligatorio'), { statusCode: 400 });
  return name;
}

async function signIn(
  app: Parameters<FastifyPluginAsync>[0],
  user: { id: string; role: string }
) {
  const token = app.jwt.sign({ sub: user.id, role: user.role });
  return token;
}

async function linkCaptainEmail(userId: string, email: string) {
  await prisma.team.updateMany({
    where: { captainUserId: null, captainEmail: email },
    data: { captainUserId: userId },
  });
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { email?: string; name?: string; password?: string } }>(
    '/register',
    async (req, reply) => {
      try {
        const email = normalizeEmail(req.body?.email);
        if (!email) {
          return reply.status(400).send({ error: 'Email inválido' });
        }
        const name = parseName(req.body?.name);
        const password = parsePassword(req.body?.password);
        const passwordHash = await hashPassword(password);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing?.passwordHash) {
          return reply.status(409).send({ error: 'Ese email ya está registrado' });
        }

        const user = existing
          ? await prisma.user.update({
              where: { id: existing.id },
              data: { passwordHash, name: existing.name || name },
            })
          : await prisma.user.create({
              data: { email, name, passwordHash },
            });

        await linkCaptainEmail(user.id, email);
        const token = await signIn(app, user);
        return reply.status(existing ? 200 : 201).send({
          user: { ...withoutPasswordHash(user), hasPassword: true },
          token,
        });
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 400).send({ error: e.message });
      }
    }
  );

  app.post<{ Body: { email?: string; password?: string } }>(
    '/login',
    async (req, reply) => {
      try {
        const email = normalizeEmail(req.body?.email);
        const password = parsePassword(req.body?.password);
        if (!email) throw loginFailed();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw loginFailed();

        if (user.passwordHash) {
          if (!(await verifyPassword(password, user.passwordHash))) throw loginFailed();
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await hashPassword(password) },
          });
        }

        await linkCaptainEmail(user.id, email);
        const token = await signIn(app, user);
        return reply.send({
          user: { ...withoutPasswordHash(user), hasPassword: true },
          token,
        });
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 401).send({ error: e.message });
      }
    }
  );

  app.get(
    '/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.status(404).send({ error: 'Not found' });
      const email = user.email.trim().toLowerCase();
      await linkCaptainEmail(user.id, email);
      const isCaptain = (await prisma.team.count({
        where: {
          tournament: { sport: { notIn: [...INDIVIDUAL_SPORTS] } },
          OR: [{ captainUserId: user.id }, { captainEmail: email }],
        },
      })) > 0;
      return reply.send({
        ...withoutPasswordHash(user),
        isCaptain,
        hasPassword: Boolean(user.passwordHash),
      });
    }
  );

  app.patch<{
    Body: {
      avatarUrl?: string | null;
      color?: string | null;
      password?: string;
      currentPassword?: string;
    };
  }>(
    '/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const payload = req.user as { sub: string };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.status(404).send({ error: 'Not found' });

      const data: { avatarUrl?: string | null; color?: string | null; passwordHash?: string } = {};
      try {
        if (req.body?.avatarUrl !== undefined) {
          data.avatarUrl = parseUserAvatarUrl(req.body.avatarUrl) ?? null;
        }
        if (req.body?.color !== undefined) {
          const color = parseTeamColor(req.body.color);
          if (color !== undefined) data.color = color;
        }
        if (req.body?.password !== undefined) {
          const next = parsePassword(req.body.password);
          if (user.passwordHash) {
            const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
            if (!current || !(await verifyPassword(current, user.passwordHash))) {
              return reply.status(400).send({ error: 'La clave actual no es correcta' });
            }
          }
          data.passwordHash = await hashPassword(next);
        }
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        return reply.status(e.statusCode ?? 400).send({ error: e.message });
      }
      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Nada que actualizar' });
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
      });
      return reply.send({
        ...withoutPasswordHash(updated),
        hasPassword: Boolean(updated.passwordHash),
      });
    }
  );
};
