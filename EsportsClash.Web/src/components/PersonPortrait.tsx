import {WorldPlayerPortrait} from './WorldPlayerPortrait';
/** Shared face identity for staff and media, with professional clothing. */
export function PersonPortrait({id,name,role='staff',size=56}:{id:string|number;name:string;role?:string;size?:number}){
 return <span className={'person-portrait person-portrait--'+role}><WorldPlayerPortrait id={String(id)} name={name} size={size} appearance={{headset:role==='caster'||role==='observer',jersey:'#343440',accent:role==='referee'?'#c9ccd2':role==='caster'?'#e5b967':'#bf768b'}}/></span>;
}
