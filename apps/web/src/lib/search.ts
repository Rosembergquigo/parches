/** Búsqueda insensible a mayúsculas y tildes (Medellín ≈ medellin). */
export function foldQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function readSearchQuery(url: URL): string {
  return (url.searchParams.get('q') ?? '').trim();
}

export function queryMatches(q: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = foldQuery(q);
  if (!needle) return true;
  return fields.some(field => !!field && foldQuery(field).includes(needle));
}

export const SPORT_SEARCH_LABEL: Record<string, string> = {
  football: 'Fútbol',
  basketball: 'Baloncesto',
  tennis: 'Tenis',
  volleyball: 'Voleibol',
  baseball: 'Béisbol',
  hockey: 'Hockey',
  motor: 'Motor',
  padel: 'Pádel',
  eSports: 'eSports',
  boxeo: 'Boxeo',
};
