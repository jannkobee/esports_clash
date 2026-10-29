import {useEffect,useState} from 'react';
import {GAME_CONTENT_API} from '../GameContentContext';
import {validateAvatarComponents,type AvatarComponentSummary} from '../avatarComponents';

export function AvatarComponentInventory({avatarId}:{avatarId:string}){
  const [data,setData]=useState<AvatarComponentSummary>();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let disposed=false,busy=false;let controller:AbortController|undefined;
    setData(undefined);setFailed(false);
    async function refresh(){
      if(busy||document.visibilityState==='hidden')return;
      busy=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),5000);
      try{
        const response=await fetch(`${GAME_CONTENT_API}/avatars/${encodeURIComponent(avatarId)}/components`,{cache:'no-store',signal:controller.signal});
        const next=response.ok?validateAvatarComponents(await response.json(),avatarId):undefined;
        if(!next)throw Error('Inventory unavailable');
        if(!disposed){setData(next);setFailed(false);}
      }catch{if(!disposed)setFailed(true);}finally{clearTimeout(timeout);busy=false;}
    }
    void refresh();const timer=setInterval(()=>void refresh(),15000);window.addEventListener('focus',refresh);
    return()=>{disposed=true;controller?.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[avatarId]);
  const current=data?.avatar_id===avatarId?data:undefined;
  return <details data-avatar-inventory={avatarId} data-inventory-hash={current?.hash} className="rounded-lg border border-slate-700 p-3 text-xs text-slate-300">
    <summary className="cursor-pointer">Character asset inventory</summary>
    {failed?<p role="status">Backoffice unavailable. {current?'Showing the last received inventory.':'Inventory could not be loaded.'}</p>:!current?<p role="status">Loading inventory…</p>:null}
    {current?<><p className="my-2 text-slate-400">Backoffice revision {current.version}. References and unqualified models are not live releases.</p>
      <ul className="space-y-1">{current.components.map(item=><li key={item.id}>{item.label} · {current.categories[item.category]} · {item.status.replaceAll('_',' ')}{item.reference_purpose==='design'?' · design context only':''}</li>)}</ul>
    </>:null}
  </details>;
}
