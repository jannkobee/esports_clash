import { Trophy, Shield, Users, GraduationCap, Swords, Package, History, Flag, Handshake } from 'lucide-react';
import type { PediaKind } from '../avatarpedia';
import type { ClubIdentity } from './ClubIdentityEditor';
import { ClubCrest } from './ClubIdentityEditor';
import {TournamentLogo} from './TournamentLogo';

const icons = {tournaments:Trophy,teams:Shield,nations:Flag,players:Users,coaches:GraduationCap,avatars:Swords,items:Package,releases:History,organizers:Flag,sponsors:Handshake,talent:Users};
export function ReferenceIcon({kind,size=16}: {kind:PediaKind;size?:number}) {
  const Icon=icons[kind];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
export function ReferenceMark({kind,identity,id,name}: {kind:PediaKind;identity?:ClubIdentity|null;id?:string|number;name?:string}) {
  return <span className={`reference-mark reference-mark--${kind}`}>{kind==='teams'&&identity?<ClubCrest crest={identity.crest} colors={identity.colors} logo={identity.assets?.logo}/>:id!==undefined&&['tournaments','organizers','sponsors'].includes(kind)?<TournamentLogo id={id} name={name??kind} kind={kind==='organizers'?'organizer':kind==='sponsors'?'sponsor':'tournament'}/>:<ReferenceIcon kind={kind} size={22}/>}</span>;
}
