import { isIndividualSport } from '@parches/config';
import { prisma } from './prisma.js';
// GET overlay: foto y color de User.color / User.avatarUrl.

export type TeamPhotoFields = {
  id: string;
  logoUrl?: string | null;
  color?: string | null;
  captainUserId?: string | null;
  captainEmail?: string | null;
};

export type PlayerLook = {
  avatarUrl: string | null;
  color: string | null;
};

/** Foto y color de perfil por team.id. */
export async function looksForTeams(teams: TeamPhotoFields[]): Promise<Map<string, PlayerLook>> {
  const unique = new Map<string, TeamPhotoFields>();
  for (const team of teams) {
    if (team?.id) unique.set(team.id, team);
  }
  const list = [...unique.values()];
  if (list.length === 0) return new Map();

  const ids = [...new Set(list.map(t => t.captainUserId).filter(Boolean))] as string[];
  const emails = [...new Set(
    list
      .filter(t => !t.captainUserId && t.captainEmail)
      .map(t => t.captainEmail!.trim().toLowerCase()),
  )];
  if (ids.length === 0 && emails.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(emails.length ? [{ email: { in: emails } }] : []),
      ],
    },
    select: { id: true, email: true, avatarUrl: true, color: true },
  });

  const byId = new Map<string, PlayerLook>();
  const byEmail = new Map<string, PlayerLook>();
  for (const user of users) {
    const look: PlayerLook = {
      avatarUrl: user.avatarUrl?.trim() || null,
      color: user.color?.trim() || null,
    };
    byId.set(user.id, look);
    byEmail.set(user.email.trim().toLowerCase(), look);
  }

  const out = new Map<string, PlayerLook>();
  for (const team of list) {
    const look =
      (team.captainUserId ? byId.get(team.captainUserId) : undefined)
      ?? (team.captainEmail ? byEmail.get(team.captainEmail.trim().toLowerCase()) : undefined);
    if (look) out.set(team.id, look);
  }
  return out;
}

export function paintTeam<T extends TeamPhotoFields>(team: T, looks: Map<string, PlayerLook>): T {
  const look = looks.get(team.id);
  return {
    ...team,
    logoUrl: look?.avatarUrl ?? null,
    color: look?.color ?? team.color ?? null,
  };
}

export async function withPlayerPhotos<T extends TeamPhotoFields>(
  sport: string,
  teams: T[],
): Promise<T[]> {
  if (!isIndividualSport(sport) || teams.length === 0) return teams;
  const looks = await looksForTeams(teams);
  return teams.map(team => paintTeam(team, looks));
}

type MatchWithTeams = {
  homeTeam?: TeamPhotoFields | null;
  awayTeam?: TeamPhotoFields | null;
};

export async function withTournamentLooks<T extends {
  sport: string;
  teams?: TeamPhotoFields[];
  matches?: MatchWithTeams[];
  groups?: { teams?: TeamPhotoFields[] }[];
}>(tournament: T): Promise<T> {
  if (!isIndividualSport(tournament.sport)) return tournament;
  const bag: TeamPhotoFields[] = [
    ...(tournament.teams ?? []),
    ...(tournament.groups ?? []).flatMap(g => g.teams ?? []),
    ...(tournament.matches ?? []).flatMap(m => [m.homeTeam, m.awayTeam].filter((x): x is TeamPhotoFields => !!x)),
  ];
  const looks = await looksForTeams(bag);
  return {
    ...tournament,
    teams: tournament.teams?.map(t => paintTeam(t, looks)),
    groups: tournament.groups?.map(g => ({
      ...g,
      teams: g.teams?.map(t => paintTeam(t, looks)),
    })),
    matches: tournament.matches?.map(m => ({
      ...m,
      homeTeam: m.homeTeam ? paintTeam(m.homeTeam, looks) : m.homeTeam,
      awayTeam: m.awayTeam ? paintTeam(m.awayTeam, looks) : m.awayTeam,
    })),
  };
}

export function parseUserAvatarUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !/^\/uploads\/users\/[A-Za-z0-9._-]+$/.test(raw.trim())) {
    throw Object.assign(new Error('La foto de perfil no es válida'), { statusCode: 400 });
  }
  return raw.trim();
}
