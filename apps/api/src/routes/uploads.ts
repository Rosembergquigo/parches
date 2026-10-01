import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { isUploadKind, saveImageUpload, uploadRoot } from '../lib/uploads.js';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { filename?: string; mime?: string; data: string; kind?: string };
  }>('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!req.body?.data) {
      return reply.status(400).send({ error: 'data is required' });
    }
    try {
      const saved = await saveImageUpload(req.body);
      return reply.status(201).send(saved);
    } catch (err) {
      const status = err instanceof Error && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 400;
      return reply.status(status).send({
        error: err instanceof Error ? err.message : 'No se pudo guardar la imagen',
      });
    }
  });
};

export const uploadStaticRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { dir: string; file: string } }>('/uploads/:dir/:file', async (req, reply) => {
    if (!isUploadKind(req.params.dir)) {
      return reply.status(404).send({ error: 'Not found' });
    }
    const file = basename(req.params.file);
    const path = join(uploadRoot(), req.params.dir, file);
    if (!existsSync(path)) return reply.status(404).send({ error: 'Not found' });
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    return reply.type(MIME[ext] ?? 'application/octet-stream').send(createReadStream(path));
  });
};
