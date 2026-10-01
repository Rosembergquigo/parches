import { ENDPOINTS } from '@parches/config';
import { Resend } from 'resend';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendMailResult =
  | { ok: true; id?: string; skipped: boolean }
  | { ok: false; error: string };

const FROM_DEFAULT = 'Chapi <avisos@parches.app>';

function apiKey(): string {
  return (process.env.RESEND_API_KEY ?? '').trim();
}

export function mailFrom(): string {
  const from = (process.env.MAIL_FROM ?? '').trim();
  return from || FROM_DEFAULT;
}

export function mailMode(): 'live' | 'log' {
  return apiKey() ? 'live' : 'log';
}

/** Origen del web para CTAs (`/login?next=…`). */
export function webOrigin(): string {
  return ENDPOINTS.WEB_HTTP.replace(/\/$/, '');
}

export function webUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${webOrigin()}${p}`;
}

/** Link de ingreso. `next` debe ser un path interno (`/me/player`). */
export function loginUrl(next: string): string {
  const path = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return `${webOrigin()}/login?next=${encodeURIComponent(path)}`;
}

/** URL absoluta de un upload (`/uploads/...`) para <img> en correos. */
export function assetUrl(path?: string | null): string | null {
  if (!path) return null;
  const value = path.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const origin = ENDPOINTS.API_HTTP.replace(/\/$/, '');
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

/** Igual que assetUrl, pero omite localhost: Gmail no carga imágenes locales. */
export function mailImageUrl(path?: string | null): string | null {
  const url = assetUrl(path);
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return null;
  } catch {
    return null;
  }
  return url;
}

function recipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

/**
 * Envía un correo. Sin API key no llama a Resend: loguea y resuelve ok.
 * Nunca lanza: el alta de plantilla no debe fallar por el mailer.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const to = recipients(input.to);
  if (!to.length) return { ok: false, error: 'Sin destinatarios válidos' };

  const payload = {
    from: mailFrom(),
    to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };

  if (mailMode() === 'log') {
    console.info('[mail:log]', {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
    });
    return { ok: true, skipped: true };
  }

  try {
    const resend = new Resend(apiKey());
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      const message = 'message' in error && error.message ? String(error.message) : 'Resend rechazó el envío';
      console.error('[mail:error]', error);
      return { ok: false, error: message };
    }
    return { ok: true, id: data?.id, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al enviar correo';
    console.error('[mail:error]', message);
    return { ok: false, error: message };
  }
}

/** Fire-and-forget. El caller no espera ni ve fallos de Resend. */
export function queueMail(input: SendMailInput): void {
  void sendMail(input).then((result) => {
    if (!result.ok) console.error('[mail:queue]', result.error);
  });
}
