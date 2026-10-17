import {readFile,writeFile} from 'node:fs/promises';
const prefix=process.env.OUTPUT_PREFIX??'avatar-combat';
if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid output prefix');
const port=process.env.CDP_PORT??'9238';
const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(done=>ws.addEventListener('open',done,{once:true}));
let id=0;const pending=new Map();ws.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});
try{
 // Load exact saved bytes without relying on Vite's parent-directory file-serving policy.
 const source='data:video/webm;base64,'+(await readFile('../docs/'+prefix+'-preview.webm')).toString('base64');
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const video=document.createElement('video');video.muted=true;video.src=${JSON.stringify(source)};document.body.append(video);
  const wait=event=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video '+event+' timed out')),10000);video.addEventListener(event,()=>{clearTimeout(timer);resolve();},{once:true});video.addEventListener('error',()=>reject(Error('Video failed to decode')),{once:true});});
  const loaded=wait('loadeddata');video.load();await loaded;
  const seek=wait('seeked');video.currentTime=2;await seek;
  await video.play();await new Promise(done=>setTimeout(done,150));video.pause();
  const result={width:video.videoWidth,height:video.videoHeight,currentTime:video.currentTime,duration:Number.isFinite(video.duration)?video.duration:null,decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames};
  if(result.width!==1500||result.height!==1080||result.currentTime<2||result.decodedFrames<1)throw Error('Video dimensions, seek or decode failed');
  const frames=[];
  for(const fraction of [.35,.55,.92]){
   const sought=wait('seeked');video.currentTime=video.duration*fraction;await sought;
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
   frames.push({second:video.currentTime,png:canvas.toDataURL('image/png')});
  }
  result.frames=frames;
  video.removeAttribute('src');video.load();video.remove();return result;
 })()`});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);
 const data=result.result.value;
 for(const [i,frame] of data.frames.entries()){
  frame.file=prefix+'-video-frame-'+(i+1)+'.png';await writeFile('../docs/'+frame.file,Buffer.from(frame.png.split(',')[1],'base64'));delete frame.png;
 }
 await writeFile('../docs/'+prefix+'-video-verification.json',JSON.stringify(data,null,2)+'\n');console.log('Combat motion video decodes, plays and seeks; three review frames saved.');
}finally{ws.close();}
