import test from 'node:test';
import reset from '../data/avatarAssetReset.json' with {type:'json'};
export function retiredAvatarAssetTest(name,callback){
  return test(name,{skip:!reset.legacyAssetsAvailable?'Owner deleted the legacy avatar binary fixtures during the all-45 fresh start':false},callback);
}
