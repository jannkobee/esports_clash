import {liveNavigationChoices} from '../EsportsClash.Web/src/fps/fpsLiveLearning.ts';
const actor={id:'anonymous',team:'red',attacking:true,x:-19,z:0,hp:100,yaw:0,role:'trade',bomb:false,ammo:20,reload:0};
for(const [x,z,gx,gz] of [[-23,15,-23,24],[-19,10,-23,21],[-30,23,-23,18.1]]){
 const context={actor:{...actor,x,z},goal:{x:gx,z:gz},remaining:80,planted:false,time:20,beliefs:[],allies:[],caution:0,evidence:''};
 console.log(JSON.stringify({x,z,goal:context.goal,choices:liveNavigationChoices(context).map(c=>c.point)}));
}
