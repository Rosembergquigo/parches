import { prisma } from './prisma.js';
import { loginUrl, mailImageUrl, queueMail, webUrl } from './mail.js';
import { escapeHtml, renderMail, type MailBrand } from './mailLayout.js';

const SPORT_LABEL: Record<string, string> = {
  football: 'Fútbol',
  basketball: 'Basket',
  tennis: 'Tenis',
  volleyball: 'Voleibol',
  baseball: 'Béisbol',
  hockey: 'Hockey',
};

function sportLabel(sport: string): string {
  return SPORT_LABEL[sport] ?? sport;
}

export const KICKOFF_REMIND_MS = 24 * 60 * 60 * 1000;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function hello(name: string): string {
  const first = firstName(name);
  return first ? `Hola ${first},` : 'Hola,';
}

export function sameMinute(a?: Date | null, b?: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);
}

export function withinKickoffWindow(at: Date, now = new Date()): boolean {
  const delta = at.getTime() - now.getTime();
  return delta > 0 && delta <= KICKOFF_REMIND_MS;
}

export function kickoffRemindedValue(at: Date | null | undefined, now = new Date()): Date | null {
  if (!at) return null;
  return withinKickoffWindow(at, now) ? now : null;
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

const orgMailSelect = {
  name: true,
  slug: true,
  logoUrl: true,
  city: true,
  description: true,
} as const;

const tournamentMailSelect = {
  name: true,
  slug: true,
  sport: true,
  logoUrl: true,
  organization: { select: orgMailSelect },
} as const;

function clip(value: string | null | undefined, max = 160): string | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

type TournamentMailRow = {
  name: string;
  slug: string | null;
  sport: string;
  logoUrl: string | null;
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    city: string | null;
    description: string | null;
  };
};

function mailBrandFrom(tournament: TournamentMailRow): MailBrand {
  const org = tournament.organization;
  return {
    tournamentName: tournament.name,
    tournamentHref: tournament.slug ? webUrl(`/tournaments/${tournament.slug}`) : undefined,
    sportLabel: sportLabel(tournament.sport),
    crestUrl: mailImageUrl(tournament.logoUrl) ?? mailImageUrl(org.logoUrl),
    orgName: org.name,
    orgHref: webUrl(`/orgs/${org.slug}`),
    orgCity: org.city,
    orgDescription: clip(org.description),
  };
}

async function teamMailContext(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      name: true,
      tournament: { select: tournamentMailSelect },
    },
  });
  if (!team) return null;
  return {
    teamName: team.name,
    tournamentName: team.tournament.name,
    brand: mailBrandFrom(team.tournament),
  };
}

async function actorById(userId?: string | null) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
}

export type PlayerEnrolledNotice = {
  teamId: string;
  playerName: string;
  playerEmail: string;
  jerseyNumber?: number | null;
  position?: string | null;
  actorUserId?: string | null;
  reactivated?: boolean;
};

/** Inscripción o reactivación. No espera a Resend; se salta si te inscribes a ti mismo. */
export function notifyPlayerEnrolled(input: PlayerEnrolledNotice): void {
  void deliverPlayerEnrolled(input).catch((err) => {
    console.error('[mail:notify]', err);
  });
}

async function deliverPlayerEnrolled(input: PlayerEnrolledNotice): Promise<void> {
  const [ctx, actor] = await Promise.all([
    teamMailContext(input.teamId),
    actorById(input.actorUserId),
  ]);
  if (!ctx) return;
  if (actor && sameEmail(actor.email, input.playerEmail)) return;

  const subject = input.reactivated
    ? `Volviste a la plantilla de ${ctx.teamName} · ${ctx.tournamentName}`
    : `Te inscribieron en ${ctx.teamName} · ${ctx.tournamentName}`;
  const preview = actor
    ? `${actor.name} te sumó a la plantilla. Ingresa con este correo.`
    : 'Te sumaron a la plantilla. Ingresa con este correo.';

  const meta: string[] = [];
  if (input.jerseyNumber != null) meta.push(`Dorsal ${input.jerseyNumber}`);
  if (input.position?.trim()) meta.push(input.position.trim());

  const bodyHtml = [
    `<p style="margin:0 0 8px;">Te inscribieron en <strong style="color:#f4f4f8;">${escapeHtml(ctx.teamName)}</strong></p>`,
    meta.length
      ? `<p style="margin:0 0 8px;">${escapeHtml(meta.join(' · '))}</p>`
      : '',
    actor
      ? `<p style="margin:0 0 8px;color:#8b8b9a;font-size:14px;">Quién: ${escapeHtml(actor.name)}</p>`
      : '',
    `<p style="margin:16px 0 0;color:#8b8b9a;font-size:13px;">Si aún no tenías cuenta, ya está creada con este correo. No necesitas contraseña.</p>`,
  ].join('');

  const bodyText = [
    `Te inscribieron en ${ctx.teamName}`,
    meta.length ? meta.join(' · ') : '',
    actor ? `Quién: ${actor.name}` : '',
    '',
    'Si aún no tenías cuenta, ya está creada con este correo. No necesitas contraseña.',
  ].filter((line) => line !== '').join('\n');

  const { html, text } = renderMail({
    preview,
    heading: hello(input.playerName),
    bodyHtml,
    bodyText,
    brand: ctx.brand,
    cta: { label: 'Ingresar', href: loginUrl('/me/player') },
  });

  queueMail({ to: input.playerEmail, subject, html, text });
}

export type CaptainAssignedNotice = {
  teamId: string;
  captainName: string;
  captainEmail: string;
};

/** Alta o cambio de correo del capitán. */
export function notifyCaptainAssigned(input: CaptainAssignedNotice): void {
  void deliverCaptainAssigned(input).catch((err) => {
    console.error('[mail:notify]', err);
  });
}

async function deliverCaptainAssigned(input: CaptainAssignedNotice): Promise<void> {
  const ctx = await teamMailContext(input.teamId);
  if (!ctx) return;

  const subject = `Eres capitán de ${ctx.teamName} · ${ctx.tournamentName}`;
  const { html, text } = renderMail({
    preview: 'Puedes subir el escudo y sumar jugadores.',
    heading: hello(input.captainName),
    brand: ctx.brand,
    bodyHtml: [
      `<p style="margin:0 0 8px;">Quedaste como capitán de <strong style="color:#f4f4f8;">${escapeHtml(ctx.teamName)}</strong></p>`,
      `<p style="margin:0 0 8px;">Desde tu módulo puedes:</p>`,
      `<ul style="margin:0 0 8px;padding-left:18px;"><li>Subir o cambiar el escudo</li><li>Inscribir o dar de baja jugadores</li></ul>`,
      `<p style="margin:16px 0 0;color:#8b8b9a;font-size:13px;">El organizador sigue viendo todo en Equipos.</p>`,
    ].join(''),
    bodyText: [
      `Quedaste como capitán de ${ctx.teamName}`,
      '',
      'Desde tu módulo puedes:',
      '• Subir o cambiar el escudo',
      '• Inscribir o dar de baja jugadores',
      '',
      'El organizador sigue viendo todo en Equipos.',
    ].join('\n'),
    cta: { label: 'Ir a Capitán', href: loginUrl('/me/captain') },
  });

  queueMail({ to: input.captainEmail, subject, html, text });
}

const TZ = 'America/Bogota';

function capEs(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase('es-CO') + value.slice(1);
}

function formatKickoff(at: Date): { day: string; time: string } {
  const day = capEs(at.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }));
  const time = at.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
  return { day, time };
}

function bogotaDateKey(at: Date): string {
  return at.toLocaleDateString('en-CA', { timeZone: TZ });
}

export type MatchNoticeKind = 'scheduled' | 'rescheduled' | 'reminder';

function matchIntro(kind: MatchNoticeKind): string {
  if (kind === 'rescheduled') return 'El partido cambió de horario.';
  if (kind === 'reminder') return 'Recordatorio: se acerca la hora.';
  return 'Les programaron un partido.';
}

function matchSubject(
  kind: MatchNoticeKind,
  home: string,
  away: string,
  at: Date,
): string {
  const vs = `${home} vs ${away}`;
  if (kind === 'rescheduled') return `Se reprogramó · ${vs}`;
  if (kind === 'scheduled') return `Tienen partido · ${vs}`;
  const kick = bogotaDateKey(at);
  const today = bogotaDateKey(new Date());
  const tomorrow = bogotaDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  if (kick === today) return `Hoy juegan ${vs}`;
  if (kick === tomorrow) return `Mañana juegan ${vs}`;
  return `Se acerca el partido · ${vs}`;
}

type TeamMailSide = {
  name: string;
  captainName: string | null;
  captainEmail: string | null;
  enrollments: {
    playerProfile: { user: { name: string; email: string } };
  }[];
};

function collectMatchRecipients(
  home: TeamMailSide,
  away: TeamMailSide,
  referee: { name: string; email: string } | null,
): { email: string; name: string }[] {
  const byEmail = new Map<string, string>();
  const add = (email?: string | null, name?: string | null) => {
    const key = email?.trim().toLowerCase() ?? '';
    if (!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return;
    if (!byEmail.has(key)) byEmail.set(key, (name ?? '').trim() || key);
  };
  for (const side of [home, away]) {
    add(side.captainEmail, side.captainName);
    for (const row of side.enrollments) {
      add(row.playerProfile.user.email, row.playerProfile.user.name);
    }
  }
  if (referee) add(referee.email, referee.name);
  return [...byEmail.entries()].map(([email, name]) => ({ email, name }));
}

/** Partido programado, reprogramado o recordatorio de 24 h. */
export function notifyMatchKickoff(matchId: string, kind: MatchNoticeKind): void {
  void deliverMatchKickoff(matchId, kind).catch((err) => {
    console.error('[mail:notify]', err);
  });
}

async function deliverMatchKickoff(matchId: string, kind: MatchNoticeKind): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      scheduledAt: true,
      venue: true,
      stage: true,
      status: true,
      tournament: { select: tournamentMailSelect },
      homeTeam: {
        select: {
          name: true,
          captainName: true,
          captainEmail: true,
          enrollments: {
            where: { isActive: true },
            select: { playerProfile: { select: { user: { select: { name: true, email: true } } } } },
          },
        },
      },
      awayTeam: {
        select: {
          name: true,
          captainName: true,
          captainEmail: true,
          enrollments: {
            where: { isActive: true },
            select: { playerProfile: { select: { user: { select: { name: true, email: true } } } } },
          },
        },
      },
      referee: { select: { name: true, email: true } },
    },
  });
  if (!match?.scheduledAt) return;
  if (match.status !== 'SCHEDULED') return;
  if (match.scheduledAt.getTime() <= Date.now() - 60_000) return;

  const people = collectMatchRecipients(match.homeTeam, match.awayTeam, match.referee);
  if (!people.length) return;

  const brand = mailBrandFrom(match.tournament);
  const vs = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const { day, time } = formatKickoff(match.scheduledAt);
  const when = `${day}, ${time}`;
  const extras = [match.stage, match.venue].filter((v): v is string => !!v?.trim());
  const intro = matchIntro(kind);
  const subject = matchSubject(kind, match.homeTeam.name, match.awayTeam.name, match.scheduledAt);
  const href = webUrl(`/matches/${match.id}`);

  const extraHtml = extras.length
    ? `<p style="margin:0 0 8px;color:#8b8b9a;font-size:14px;">${escapeHtml(extras.join(' · '))}</p>`
    : '';
  const extraText = extras.length ? extras.join(' · ') : '';

  for (const person of people) {
    const { html, text } = renderMail({
      preview: `${vs} · ${when}`,
      heading: hello(person.name),
      brand,
      bodyHtml: [
        `<p style="margin:0 0 8px;">${escapeHtml(intro)}</p>`,
        `<p style="margin:0 0 8px;"><strong style="color:#f4f4f8;">${escapeHtml(vs)}</strong></p>`,
        `<p style="margin:0 0 8px;">${escapeHtml(when)}</p>`,
        extraHtml,
      ].join(''),
      bodyText: [intro, vs, when, extraText].filter(Boolean).join('\n'),
      cta: { label: 'Ver partido', href },
    });
    queueMail({ to: person.email, subject, html, text });
  }
}
