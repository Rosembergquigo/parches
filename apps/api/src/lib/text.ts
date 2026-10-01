const TITLE_SMALL = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
  'a', 'al', 'en', 'da', 'do', 'das', 'dos',
]);
const TITLE_ABBR = new Set(['fc', 'sc', 'cf', 'cd', 'ud', 'afc']);

/** "águilas de cali" → "Águilas de Cali" */
export function toTitleCase(value: string): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return '';

  return text.split(/(\s+|-)/).map((token, index, parts) => {
    if (!token || /^[\s-]+$/.test(token)) return token;
    const lower = token.toLocaleLowerCase('es-CO');
    if (TITLE_ABBR.has(lower)) return lower.toLocaleUpperCase('es-CO');
    const isFirst = !parts.slice(0, index).some(part => /[^\s-]/.test(part));
    if (!isFirst && TITLE_SMALL.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase('es-CO') + lower.slice(1);
  }).join('');
}
