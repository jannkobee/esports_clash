let socket:WebSocket|null=null,retry=0,users=0,revision='',attempt=0,fallback=0;
export const WORLD_UPDATED='hexatrick-world-updated';
function publish(topics?:string[]){window.dispatchEvent(new CustomEvent(WORLD_UPDATED,{detail:{topics}}));}
function connect(){
 if(!users||document.hidden||socket)return;clearTimeout(retry);
 const url=new URL('/world-live',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
 const connection=new WebSocket(url);socket=connection;connection.onopen=()=>{if(socket!==connection)return;attempt=0;if(fallback){clearInterval(fallback);fallback=0;}};
 connection.onmessage=e=>{if(socket!==connection)return;try{const r=JSON.parse(e.data);if(r.type==='world.revision'&&typeof r.revision==='string'){if(revision&&revision!==r.revision)publish(r.topics);revision=r.revision;}}catch{}};
 connection.onclose=()=>{if(socket!==connection)return;socket=null;if(!users||document.hidden)return;retry=window.setTimeout(connect,Math.min(30000,1500*2**Math.min(attempt++,4)));if(!fallback)fallback=window.setInterval(()=>publish(),60000);};connection.onerror=()=>connection.close();
}
function visibility(){if(document.hidden){clearTimeout(retry);clearInterval(fallback);fallback=0;socket?.close();socket=null;}else if(users&&!socket){publish();connect();}}
export function startWorldLive(){users++;if(users===1){document.addEventListener('visibilitychange',visibility);connect();}return()=>{users--;if(!users){document.removeEventListener('visibilitychange',visibility);clearTimeout(retry);clearInterval(fallback);fallback=0;socket?.close();socket=null;}};}

export function onWorldUpdate(topics:string[],refresh:()=>void){const listener=(event:Event)=>{const changed=(event as CustomEvent<{topics?:string[]}>).detail?.topics;if(!changed||topics.some(t=>changed.includes(t)))refresh();};window.addEventListener(WORLD_UPDATED,listener);return()=>window.removeEventListener(WORLD_UPDATED,listener);}
