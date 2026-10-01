import { ENDPOINTS } from '@parches/config';

/** Convierte una ruta relativa del API (`/uploads/...`) en URL absoluta. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${ENDPOINTS.API_HTTP}${path}`;
}
