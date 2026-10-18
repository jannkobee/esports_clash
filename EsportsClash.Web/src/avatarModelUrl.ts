/** Keep URLs available to the download link without eagerly importing Three. */
import { AVATAR_DESIGNS } from './avatarDesigns.ts';
export type AvatarModelVariant='current'|'claude';
const ARSENALDO_VARIANT_KEY='esports-clash-arsenaldo-model';
export function getArsenaldoModelVariant():AvatarModelVariant{
  try{return typeof localStorage!=='undefined'&&localStorage.getItem(ARSENALDO_VARIANT_KEY)==='current'?'current':'claude';}
  catch{return 'claude';}
}
export function saveArsenaldoModelVariant(variant:AvatarModelVariant){
  try{localStorage.setItem(ARSENALDO_VARIANT_KEY,variant);}catch{/* The current studio selection still works without storage. */}
}
export function avatarModelUrl(id: string,variant:AvatarModelVariant='current') {
  if(id==='c_invoker'&&variant==='claude')return `${import.meta.env?.BASE_URL??'/'}models/imports/arsenaldo-claude.glb?rev=f26c855f`;
  const current = Object.hasOwn(AVATAR_DESIGNS, id);
  return `${import.meta.env?.BASE_URL ?? '/'}models/${current ? 'avatars-v9' : 'avatars-v2'}/${encodeURIComponent(id)}.glb${current ? '?art=9' : ''}`;
}
