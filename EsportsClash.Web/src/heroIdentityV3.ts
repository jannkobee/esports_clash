import identities from './data/heroIdentityV3.json' with {type:'json'};
export type HeroIdentityV3 = typeof identities.heroes[number];
export const HERO_IDENTITIES_V3: readonly HeroIdentityV3[] = identities.heroes;
const aliases=new Map<string,HeroIdentityV3>();
for(const hero of HERO_IDENTITIES_V3)for(const alias of [hero.key,hero.internalName,hero.legacyId,hero.canonicalId,hero.displayName]){
  const prior=aliases.get(alias);if(prior&&prior.key!==hero.key)throw Error(`Ambiguous V3 alias: ${alias}`);
  aliases.set(alias,hero);
}
/** The persisted c_* key and internal name never change. Canonical identity is separate. */
export const resolveHeroIdentityV3=(alias:string)=>aliases.get(alias);
export const V3_RULESET='original-v3-preview-2' as const;
