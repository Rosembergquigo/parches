import { api, uploadTeamLogo, uploadUserAvatar } from './api';

export function lookColorFromForm(form: FormData): string | undefined {
  const swatch = String(form.get('color') ?? '').trim();
  const custom = String(form.get('colorCustom') ?? '').trim();
  const raw = swatch || custom;
  if (!raw) return undefined;
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return undefined;
  return hex.toLowerCase();
}

/** `null` quita la foto, `undefined` no la toca. */
export async function lookPhotoFromForm(
  form: FormData,
  request: Request
): Promise<string | null | undefined> {
  if (String(form.get('clearPhoto') ?? '') === '1') return null;
  const file = form.get('photo');
  if (file instanceof File && file.size > 0) {
    return uploadTeamLogo(file, request);
  }
  return undefined;
}

/** Foto del perfil de usuario (`/uploads/users/...`). */
export async function avatarFromForm(
  form: FormData,
  request: Request
): Promise<string | null | undefined> {
  if (String(form.get('clearAvatar') ?? '') === '1' || String(form.get('clearPhoto') ?? '') === '1') {
    return null;
  }
  const file = form.get('avatar') ?? form.get('photo');
  if (file instanceof File && file.size > 0) {
    return uploadUserAvatar(file, request);
  }
  return undefined;
}

export async function applyAvatarIntent(form: FormData, request: Request): Promise<boolean> {
  if (String(form.get('intent') ?? '') !== 'avatar' && String(form.get('intent') ?? '') !== 'look') {
    return false;
  }
  const color = lookColorFromForm(form);
  const avatarUrl = await avatarFromForm(form, request);
  const data: { avatarUrl?: string | null; color?: string } = {};
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
  if (color) data.color = color;
  if (Object.keys(data).length === 0) {
    throw new Error('Elige una foto o un color');
  }
  await api.patch('/auth/me', data, request);
  return true;
}
