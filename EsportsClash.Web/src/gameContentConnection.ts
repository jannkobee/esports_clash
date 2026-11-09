import {validateGameContent,type GameContentSnapshot} from './gameContent.ts';

export type CatalogConnection={status:'loading'|'connected'|'stale'|'offline';hash?:string;lastSuccess?:number};
/** One request at a time; failures retain the last complete catalog. */
export function createCatalogConnection(url:string,publish:(snapshot:GameContentSnapshot)=>void,status:(connection:CatalogConnection)=>void,request:typeof fetch=fetch) {
  let disposed=false,inFlight=false,lastSuccess:number|undefined,hash:string|undefined,abort:AbortController|undefined;
  return {
    async refresh(){
      if(disposed||inFlight)return;
      inFlight=true;abort=new AbortController();
      const timeout=setTimeout(()=>abort?.abort(),4000);
      try {
        const response=await request(url,{signal:abort.signal,cache:'no-store'});
        if(!response.ok)throw Error('Catalog unavailable');
        const data=validateGameContent(await response.json());
        if(!data)throw Error('Invalid catalog');
        if(disposed)return;
        lastSuccess=Date.now();
        if(hash!==data.hash){publish(data);hash=data.hash;}
        status({status:'connected',hash,lastSuccess});
      }catch{
        if(!disposed)status({status:lastSuccess===undefined?'offline':'stale',hash,lastSuccess});
      }finally{clearTimeout(timeout);inFlight=false;}
    },
    dispose(){disposed=true;abort?.abort();},
  };
}
