/** Ruta del panel de ajustes de un torneo. */
export function orgDashPath(orgSlug: string, tournamentSlug: string, op?: string): string {
  const q = new URLSearchParams({ t: tournamentSlug });
  if (op && op !== 'resumen') q.set('op', op);
  return `/orgs/${orgSlug}/dashboard?${q.toString()}`;
}
