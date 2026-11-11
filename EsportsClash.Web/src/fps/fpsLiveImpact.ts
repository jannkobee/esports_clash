/** Measured actions only. These counters never alter skill, prices, damage or decisions. */
export interface LiveImpact {
  shots:number;hits:number;headshots:number;damage:number;firstShots:number;firstShotHits:number;
  openingAttempts:number;openingKills:number;tradeKills:number;tradedDeaths:number;
  flashAssists:number;unusedUtilityOnDeath:number;roundsCompleted:number;roundsSurvived:number;
  plants:number;defuses:number;timeToDamageSamples:number;timeToDamageMs:number;
}
export function emptyLiveImpact():LiveImpact {
  return {shots:0,hits:0,headshots:0,damage:0,firstShots:0,firstShotHits:0,openingAttempts:0,openingKills:0,
    tradeKills:0,tradedDeaths:0,flashAssists:0,unusedUtilityOnDeath:0,roundsCompleted:0,roundsSurvived:0,
    plants:0,defuses:0,timeToDamageSamples:0,timeToDamageMs:0};
}
export function liveImpactRate(numerator:number,denominator:number):string {
  return denominator>0?`${Math.round(numerator/denominator*100)}%`:'—';
}
