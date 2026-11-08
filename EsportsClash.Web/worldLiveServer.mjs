import {WebSocketServer,WebSocket} from 'ws';

/** Public invalidations only. Match frames and private club data use their existing channels. */
export function attachWorldLive(server,{revisionUrl=process.env.WORLD_REVISION_URL??'http://api:8000/api/v1/world/revision'}={}){
 const wss=new WebSocketServer({noServer:true,perMessageDeflate:false,maxPayload:1024});let latest=null,pending=false;
 server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/world-live'){socket.destroy();return;}
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 const poll=async()=>{if(pending||!wss.clients.size)return;pending=true;try{
  const r=await fetch(revisionUrl,{signal:AbortSignal.timeout(4000),headers:{Accept:'application/json'}});if(!r.ok)return;const {data}=await r.json();
  if(!data||typeof data.revision!=='string'||!/^[a-f0-9]{64}$/.test(data.revision))return;
  if(data.revision!==latest?.revision){const topics=Object.keys(data.revisions??{}).filter(key=>latest?.revisions?.[key]!==data.revisions[key]);latest={type:'world.revision',revision:data.revision,revisions:data.revisions,topics};const bytes=JSON.stringify(latest);for(const ws of wss.clients){if(ws.bufferedAmount>65536){ws.close(1013,'Slow consumer');continue;}if(ws.readyState===WebSocket.OPEN)ws.send(bytes);}}
 }catch{/* Existing UI data remains visible during a reconnect. */}finally{pending=false;}};
 wss.on('connection',ws=>{ws.alive=true;ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});ws.on('message',()=>ws.close(1008,'Read-only channel'));if(latest)ws.send(JSON.stringify(latest));void poll();});
 const polling=setInterval(()=>void poll(),3000);polling.unref();const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},25000);heartbeat.unref();
 server.on('close',()=>{clearInterval(polling);clearInterval(heartbeat);wss.close();});return wss;
}
