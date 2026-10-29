/** Keep URLs available to the download link without eagerly importing Three. */
import { AVATAR_DESIGNS } from './avatarDesigns.ts';
import assetReset from './data/avatarAssetReset.json' with {type:'json'};
export const legacyAvatarAssetsAvailable=assetReset.legacyAssetsAvailable;
export type AvatarModelVariant='current'|'claude'|'submitted';
// A new preference generation makes the owner's replacement the initial choice
// without overwriting the previous preference or either original asset.
const ARSENALDO_VARIANT_KEY='esports-clash-arsenaldo-model-20261018';
export function getArsenaldoModelVariant():AvatarModelVariant{
  if(!legacyAvatarAssetsAvailable)return 'current';
  try{const value=typeof localStorage!=='undefined'?localStorage.getItem(ARSENALDO_VARIANT_KEY):null;
    return value==='current'||value==='claude'?value:'submitted';}
  catch{return 'submitted';}
}
export function saveArsenaldoModelVariant(variant:AvatarModelVariant){
  try{localStorage.setItem(ARSENALDO_VARIANT_KEY,variant);}catch{/* The current studio selection still works without storage. */}
}
export function avatarModelUrl(id: string,variant:AvatarModelVariant='current') {
  if(!legacyAvatarAssetsAvailable)return '';
  if(id==='c_invoker'&&variant==='submitted')return `${import.meta.env?.BASE_URL??'/'}models/imports/arsenaldo-submitted-20261018.glb?rev=29661d60`;
  if(id==='c_invoker'&&variant==='claude')return `${import.meta.env?.BASE_URL??'/'}models/imports/arsenaldo-claude.glb?rev=f26c855f`;
  const current = Object.hasOwn(AVATAR_DESIGNS, id);
  return `${import.meta.env?.BASE_URL ?? '/'}models/${current ? 'avatars-v9' : 'avatars-v2'}/${encodeURIComponent(id)}.glb${current ? '?art=9' : ''}`;
}
