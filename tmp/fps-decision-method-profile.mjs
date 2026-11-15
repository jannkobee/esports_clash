import {performance} from 'node:perf_hooks';
import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
for(const method of ['decide','callFromInformation','useInformationUtility','usePostPlantUtility','selectTacticalApproach','executeGoal','openingUtility','postPlantAssignment']){
  const original=FpsLiveSimulation.prototype[method];
  FpsLiveSimulation.prototype[method]=function(p,...args){
    if(this.time<499||this.time>500.1||p?.id!=='perf-4')return original.call(this,p,...args);
    const at=performance.now(),value=original.call(this,p,...args),ms=performance.now()-at;
    console.error(JSON.stringify({method,ms,time:this.time,role:p.role,weapon:p.weapon,utility:[p.smoke,p.flash,p.he,p.incendiary],contacts:p.intel.contacts.length,bomb:this.bomb.status,order:this.informationOrders[p.team].mode,goal:p.goal,action:p.action}));
    return value;
  };
}
await import('../EsportsClash.Web/scripts/benchmark-live-fps.mjs');
