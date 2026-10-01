import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 32;
const MIN_LEN = 8;
const MAX_LEN = 72;

const LOGIN_FAILED = 'Email o clave incorrectos';

export function loginFailed(): Error & { statusCode: number } {
  return Object.assign(new Error(LOGIN_FAILED), { statusCode: 401 });
}

/** Valida la clave en claro. Lanza 400 si no sirve. */
export function parsePassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw Object.assign(new Error('La clave es obligatoria'), { statusCode: 400 });
  }
  if (raw.length < MIN_LEN) {
    throw Object.assign(new Error(`La clave debe tener al menos ${MIN_LEN} caracteres`), {
      statusCode: 400,
    });
  }
  if (raw.length > MAX_LEN) {
    throw Object.assign(new Error(`La clave no puede superar ${MAX_LEN} caracteres`), {
      statusCode: 400,
    });
  }
  return raw;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(plain, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !parts[1] || !parts[2]) return false;
  try {
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    if (salt.length === 0 || expected.length === 0) return false;
    const key = (await scrypt(plain, salt, expected.length)) as Buffer;
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export function withoutPasswordHash<T extends { passwordHash?: unknown }>(
  user: T
): Omit<T, 'passwordHash'> {
  const { passwordHash: _ignored, ...rest } = user;
  return rest;
}
