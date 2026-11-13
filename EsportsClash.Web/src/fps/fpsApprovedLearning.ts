import {loadFpsLearningModel} from './fpsLiveLearning.ts';
import {loadFpsMechanicsModel} from './fpsLiveMechanicsLearning.ts';
const key='hexatrick:approved-fps-bundle:v1';
export function compatibleApproved(raw:unknown){
  if(!raw||typeof raw!=='object')return;
  const value=raw as {version?:number;navigation?:unknown;combat?:unknown};
  if(value.version!==1)return;
  const navigation=loadFpsLearningModel(value.navigation),combat=loadFpsMechanicsModel(value.combat);
  if(navigation&&combat)return {navigation,combat};
}
export async function fetchApprovedLearning(){
  let cached:unknown;
  try{cached=JSON.parse(localStorage.getItem(key)??'null');}catch{/* Optional storage. */}
  try{
    const base=(import.meta.env?.VITE_API_URL??'/backend/api/v1').replace(/\/$/,'');
    const response=await fetch(base+'/automatic-learning/approved',{signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(!response.ok)throw Error('Model unavailable');
    const value=await response.json();
    if(value.bundle===null){try{localStorage.removeItem(key);}catch{}return undefined;}
    const bundle=compatibleApproved(value.bundle);if(!bundle)throw Error('Incompatible model');
    try{localStorage.setItem(key,JSON.stringify(value.bundle));}catch{}
    return bundle;
  }catch{return compatibleApproved(cached);}
}
