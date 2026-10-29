import { useEffect, useRef, useState } from 'react';
import { ViewerReplay } from './ViewerReplay';
import type { BabylonMatchViewer } from './BabylonMatchViewer';

/** Separate presentation playback; never feeds snapshots back into a live match. */
export function BabylonReplayPanel({replay,width,height,onClose}:{replay:ViewerReplay;width:number;height:number;onClose:()=>void}){
  const host=useRef<HTMLDivElement>(null),overlay=useRef<HTMLCanvasElement>(null);
  const [error,setError]=useState(''),[second,setSecond]=useState(replay.range.start),[paused,setPaused]=useState(true);
  useEffect(()=>{let closed=false,id=0,viewer:BabylonMatchViewer|undefined,previous=performance.now(),lastUi=0;
    void import('./BabylonMatchViewer').then(async ({BabylonMatchViewer})=>{
      if(closed||!host.current)return;
      viewer=await BabylonMatchViewer.create(host.current,width,height,0,width,available=>{if(!available&&!closed)setError('Graphics context unavailable');});
      if(closed){viewer.dispose();return;}
      const loop=(now:number)=>{if(closed)return;const frame=replay.advance(Math.min(.1,(now-previous)/1000));previous=now;
        if(frame){viewer!.loadSnapshot(frame);viewer!.draw(width/2,height/2,1);
          const canvas=overlay.current,ctx=canvas?.getContext('2d');
          if(canvas&&ctx){canvas.width=canvas.clientWidth;canvas.height=canvas.clientHeight;ctx.font='12px system-ui';ctx.textAlign='center';
            for(const actor of frame.actors.filter(a=>a.kind==='champion'&&a.alive)){
              const p=viewer!.project(actor.x,actor.y,50,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillText(actor.label,p.x,p.y-10);
              ctx.fillStyle='#222';ctx.fillRect(p.x-24,p.y,48,5);ctx.fillStyle=actor.team==='blue'?'#38c9ed':'#f16b84';ctx.fillRect(p.x-24,p.y,48*Math.max(0,Math.min(1,actor.hp/Math.max(1,actor.maxHp))),5);
            }}
        }if(now-lastUi>100){setSecond(replay.second);lastUi=now;}id=requestAnimationFrame(loop);};id=requestAnimationFrame(loop);
    }).catch(e=>{if(!closed)setError(String(e));});
    return()=>{closed=true;cancelAnimationFrame(id);viewer?.dispose();replay.paused=true;};
  },[replay,width,height]);
  return <div role="dialog" aria-label="Babylon recorded match" style={{position:'fixed',inset:16,zIndex:10000,background:'#071419',display:'flex',flexDirection:'column',padding:12}}>
    <div style={{display:'flex',gap:12}}><strong>Babylon presentation replay · unverified</strong><button onClick={onClose}>Close</button>
      <button onClick={()=>{const url=URL.createObjectURL(new Blob([replay.export()],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;link.download='esportsclash-viewer-recording.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Save recording</button>
      <button onClick={()=>{replay.paused=!replay.paused;setPaused(replay.paused);}}>{paused?'Play':'Pause'}</button>
      <select aria-label="Replay speed" onChange={e=>replay.setPlaybackRate(Number(e.target.value) as 1|2|4)}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select>
      <span>{second.toFixed(1)}s</span></div>
    {error&&<p role="alert">{error}</p>}
    <div style={{position:'relative',flex:1,minHeight:0}}><div ref={host} style={{position:'absolute',inset:0}}/><canvas ref={overlay} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/></div>
    <input aria-label="Seek recording" type="range" min={replay.range.start} max={replay.range.end} step={1/30} value={second} onChange={e=>{replay.seek(Number(e.target.value));setSecond(replay.second);}}/>
    <small>Recorded match snapshots with V3 geometry. Playback does not resimulate combat.</small>
  </div>;
}
