/** Keep URLs available to the download link without eagerly importing Three. */
import { AVATAR_DESIGNS } from './avatarDesigns.ts';
export function avatarModelUrl(id: string) {
  const current = Object.hasOwn(AVATAR_DESIGNS, id);
  return `${import.meta.env?.BASE_URL ?? '/'}models/${current ? 'avatars-v8' : 'avatars-v2'}/${encodeURIComponent(id)}.glb${current ? '?art=8' : ''}`;
}
