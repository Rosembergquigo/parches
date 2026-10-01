import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPLOAD_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../uploads');

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const MAX_BYTES = 4 * 1024 * 1024;

export const UPLOAD_KINDS = ['posts', 'teams', 'tournaments', 'orgs', 'users'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export function isUploadKind(kind: string): kind is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(kind);
}

export function uploadRoot(): string {
  return UPLOAD_ROOT;
}

export async function saveImageUpload(input: {
  filename?: string;
  mime?: string;
  data: string;
  kind?: string;
}): Promise<{ url: string }> {
  const kind = input.kind && isUploadKind(input.kind) ? input.kind : 'posts';
  const mime = (input.mime ?? '').toLowerCase();
  const extFromMime = MIME_EXT[mime];
  const extFromName = extname(input.filename ?? '').toLowerCase();
  const ext = extFromMime ?? (ALLOWED_EXT.includes(extFromName)
    ? (extFromName === '.jpeg' ? '.jpg' : extFromName)
    : null);

  if (!ext) {
    throw Object.assign(new Error('Solo se aceptan imágenes JPG, PNG, WEBP, GIF o SVG'), { statusCode: 400 });
  }

  const buffer = Buffer.from(input.data, 'base64');
  if (!buffer.length) {
    throw Object.assign(new Error('La imagen está vacía'), { statusCode: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    throw Object.assign(new Error('Cada imagen puede pesar máximo 4 MB'), { statusCode: 400 });
  }
  if (ext === '.svg') {
    const markup = buffer.toString('utf8');
    if (!/<svg[\s>]/i.test(markup)) {
      throw Object.assign(new Error('El archivo SVG no es válido'), { statusCode: 400 });
    }
  }

  const dir = join(UPLOAD_ROOT, kind);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  await writeFile(join(dir, name), buffer);
  return { url: `/uploads/${kind}/${name}` };
}
