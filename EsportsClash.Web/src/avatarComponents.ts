export interface AvatarComponentSummary {
  schema: 1;
  avatar_id: string;
  version: number;
  hash: string;
  categories: Record<string,string>;
  components: Array<{id:string;label:string;category:string;binding:string;status:'missing'|'reference_uploaded'|'model_unqualified';reference_purpose?:'design'|'reconstruction'|null;reference_sha256:string|null;model_sha256:string|null}>;
}
/** Authoring state only: never supply reference images or unqualified meshes to the arena. */
export function validateAvatarComponents(value:unknown,avatarId:string):AvatarComponentSummary|undefined {
  if(!value||typeof value!=='object')return;
  const data=value as AvatarComponentSummary;
  if(data.schema!==1||data.avatar_id!==avatarId||!Number.isSafeInteger(data.version)||data.version<0||!/^[a-f0-9]{64}$/.test(data.hash)
    ||!data.categories||typeof data.categories!=='object'||Array.isArray(data.categories)||!Array.isArray(data.components)||data.components.length>1000)return;
  if(!Object.entries(data.categories).every(([key,label])=>/^[a-z_]+$/.test(key)&&typeof label==='string'&&label.length<=100))return;
  const ids=new Set<string>();
  for(const item of data.components){
    if(!item||typeof item.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(item.id)||ids.has(item.id)||typeof item.label!=='string'||item.label.length>100
      ||!Object.hasOwn(data.categories,item.category)||!['skinned','rigid','independent'].includes(item.binding)
      ||!['missing','reference_uploaded','model_unqualified'].includes(item.status)
      ||![item.reference_sha256,item.model_sha256].every(hash=>hash===null||(typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash))))return;
    if(item.status==='missing'&&(item.reference_sha256||item.model_sha256))return;
    if(item.status==='reference_uploaded'&&(!item.reference_sha256||item.model_sha256))return;
    if(item.status==='model_unqualified'&&!item.model_sha256)return;
    if(item.reference_purpose!=null&&!['design','reconstruction'].includes(item.reference_purpose))return;
    ids.add(item.id);
  }
  return structuredClone(data);
}
