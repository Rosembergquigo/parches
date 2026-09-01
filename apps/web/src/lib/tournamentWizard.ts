/**
 * tournamentWizard.ts — parseo y publicación del wizard de torneo.
 *
 * El wizard no es un POST gigante: crea el torneo, luego grupos (si
 * aplica), equipos y opcionalmente el fixture todos-contra-todos.
 * Si falla a mitad, se intenta borrar el torneo para no dejar basura.
 */
import { api } from './api';

export const WIZARD_SPORTS = [
  { id: 'football', label: 'Fútbol' },
  { id: 'basketball', label: 'Baloncesto' },
  { id: 'volleyball', label: 'Vóleibol' },
  { id: 'tennis', label: 'Tenis' },
] as const;

export const DEFAULT_TEAM_COLORS = [
  '#00e5ff', '#f97316', '#22c55e', '#a855f7',
  '#eab308', '#ef4444', '#3b82f6', '#ec4899',
];

export interface WizardTeam {
  name: string;
  shortName: string;
  color: string;
  groupIndex: number;
}

export interface WizardInput {
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  brandColor: string;
  logoUrl: string;
  backgroundImageUrl: string;
  description: string;
  format: 'league' | 'groups';
  groupCount: number;
  hasPlayoffs: boolean;
  qualifyingSpots: number;
  teams: WizardTeam[];
  fixtureMode: 'generate' | 'skip';
  doubleRound: boolean;
  venue: string;
  kickoff: string;
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function groupLabel(index: number): string {
  return `Grupo ${String.fromCharCode(65 + index)}`;
}

export function defaultWizard(brandColor?: string): WizardInput {
  return {
    name: '',
    sport: 'football',
    startDate: isoDate(0),
    endDate: isoDate(60),
    brandColor: brandColor || '#00e5ff',
    logoUrl: '',
    backgroundImageUrl: '',
    description: '',
    format: 'league',
    groupCount: 2,
    hasPlayoffs: false,
    qualifyingSpots: 2,
    teams: [0, 1, 2, 3].map(i => ({
      name: '',
      shortName: '',
      color: DEFAULT_TEAM_COLORS[i] ?? '#00e5ff',
      groupIndex: i % 2,
    })),
    fixtureMode: 'generate',
    doubleRound: false,
    venue: '',
    kickoff: '15:00',
  };
}

export function readWizardForm(form: FormData): WizardInput {
  const names = form.getAll('teamName').map(v => String(v));
  const shorts = form.getAll('teamShort').map(v => String(v));
  const colors = form.getAll('teamColor').map(v => String(v));
  const groups = form.getAll('teamGroup').map(v => Number(v));

  const teams: WizardTeam[] = names.map((name, i) => ({
    name: name.trim(),
    shortName: String(shorts[i] ?? '').trim().toUpperCase(),
    color: String(colors[i] ?? '').trim() || DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length]!,
    groupIndex: Number.isFinite(groups[i]) ? groups[i]! : 0,
  }));

  const format = form.get('format') === 'groups' ? 'groups' : 'league';
  const groupCount = Math.min(8, Math.max(2, Number(form.get('groupCount')) || 2));

  return {
    name: String(form.get('name') ?? '').trim(),
    sport: String(form.get('sport') ?? 'football'),
    startDate: String(form.get('startDate') ?? ''),
    endDate: String(form.get('endDate') ?? ''),
    brandColor: String(form.get('brandColor') ?? '').trim(),
    logoUrl: String(form.get('logoUrl') ?? '').trim(),
    backgroundImageUrl: String(form.get('backgroundImageUrl') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    format,
    groupCount,
    hasPlayoffs: form.get('hasPlayoffs') === 'on',
    qualifyingSpots: Math.max(1, Number(form.get('qualifyingSpots')) || 2),
    teams,
    fixtureMode: form.get('fixtureMode') === 'skip' ? 'skip' : 'generate',
    doubleRound: form.get('doubleRound') === 'on',
    venue: String(form.get('venue') ?? '').trim(),
    kickoff: String(form.get('kickoff') ?? '15:00').trim() || '15:00',
  };
}

export function validateWizard(data: WizardInput): string | null {
  if (!data.name) return 'El nombre del torneo es obligatorio';
  if (!WIZARD_SPORTS.some(s => s.id === data.sport)) return 'Elige un deporte válido';
  if (!data.startDate || !data.endDate) return 'Las fechas de inicio y fin son obligatorias';
  if (data.endDate < data.startDate) return 'La fecha de fin no puede ser anterior al inicio';
  if (data.brandColor && !/^#?[0-9A-Fa-f]{6}$/.test(data.brandColor)) {
    return 'El color de marca debe ser un hex de 6 dígitos';
  }

  const teams = data.teams.filter(t => t.name || t.shortName);
  if (teams.length < 2) return 'Agrega al menos 2 equipos';
  for (const t of teams) {
    if (!t.name || !t.shortName) return 'Cada equipo necesita nombre y abreviación';
    if (!/^[A-Z0-9]{2,4}$/.test(t.shortName)) {
      return 'La abreviación debe tener 2–4 letras o números';
    }
  }

  if (data.format === 'groups') {
    const used = new Set(teams.map(t => t.groupIndex));
    for (let i = 0; i < data.groupCount; i++) {
      if (!used.has(i)) return `${groupLabel(i)} no tiene equipos`;
    }
  }

  if (data.fixtureMode === 'generate' && data.kickoff && !/^\d{1,2}:\d{2}$/.test(data.kickoff)) {
    return 'La hora del saque debe ser HH:MM';
  }

  return null;
}

/** Equipos con datos (ignora filas vacías del formulario). */
export function filledTeams(data: WizardInput): WizardTeam[] {
  return data.teams.filter(t => t.name && t.shortName);
}

export async function publishWizard(
  organizationId: string,
  data: WizardInput,
  request: Request
): Promise<{ slug: string }> {
  const teams = filledTeams(data);
  const brandColor = data.brandColor
    ? (data.brandColor.startsWith('#') ? data.brandColor : `#${data.brandColor}`)
    : undefined;

  const tournament = await api.post<{ id: string; slug: string }>(
    '/tournaments',
    {
      organizationId,
      name: data.name,
      sport: data.sport,
      startDate: `${data.startDate}T12:00:00.000Z`,
      endDate: `${data.endDate}T12:00:00.000Z`,
      brandColor,
      logoUrl: data.logoUrl || undefined,
      backgroundImageUrl: data.backgroundImageUrl || undefined,
      description: data.description || undefined,
      hasPlayoffs: data.format === 'groups' && data.hasPlayoffs,
      qualifyingSpots: data.format === 'groups' && data.hasPlayoffs
        ? data.qualifyingSpots
        : undefined,
    },
    request
  );

  try {
    const groups: { id: string }[] = [];
    if (data.format === 'groups') {
      for (let i = 0; i < data.groupCount; i++) {
        groups.push(
          await api.post<{ id: string }>(
            `/tournaments/${tournament.id}/groups`,
            { label: groupLabel(i), order: i },
            request
          )
        );
      }
    }

    for (const team of teams) {
      await api.post(
        `/tournaments/${tournament.id}/teams`,
        {
          name: team.name,
          shortName: team.shortName,
          color: team.color || undefined,
          groupId: data.format === 'groups' ? groups[team.groupIndex]?.id : undefined,
        },
        request
      );
    }

    if (data.fixtureMode === 'generate') {
      await api.post(
        `/tournaments/${tournament.id}/fixture/generate`,
        {
          doubleRound: data.doubleRound,
          venue: data.venue || undefined,
          kickoff: data.kickoff || undefined,
        },
        request
      );
    }

    return { slug: tournament.slug };
  } catch (err) {
    try {
      await api.delete(`/tournaments/${tournament.id}`, request);
    } catch {
      // el error original importa más que un rollback fallido
    }
    throw err;
  }
}
