import {Anchor,Castle,CloudRain,Compass,Crown,Dices,Eye,Flag,Flame,FlaskConical,Focus,Handshake,HeartPulse,Layers,Link,MessageCircle,Mountain,RadioTower,RotateCcw,ScanEye,Shield,Snowflake,Sparkles,Swords,Timer,TreePine,TrendingUp,Undo2,UserRound,VolumeX,Zap,type LucideIcon} from 'lucide-react';
import {PERSONALITIES,type PersonalityId} from '../playerPersonality';
const icons:Record<PersonalityId,LucideIcon>={igl:RadioTower,captain:Crown,challenger:MessageCircle,loyalist:Handshake,glue_guy:Link,silent_operator:VolumeX,untiltable:Anchor,cold_as_ice:Snowflake,short_fuse:Flame,fragile_mental:CloudRain,iron_will:Mountain,clutch_performer:Timer,overconfident:TrendingUp,egoistic:UserRound,momentum_junkie:Zap,revenge_driven:RotateCcw,showman:Sparkles,perfectionist:ScanEye,first_blood_hunter:Swords,counterpuncher:Undo2,limit_tester:FlaskConical,bodyguard:Shield,patient_predator:Eye,tunnel_vision:Focus,objective_zealot:Flag,steal_gambler:Dices,siege_closer:Castle,wave_architect:Layers,bush_stalker:TreePine,survivalist:HeartPulse};
export function PersonalityMark({id,compact=false}:{id?:string|null;compact?:boolean}){
 if(!id||!(id in PERSONALITIES))return null;const trait=PERSONALITIES[id as PersonalityId],Icon=icons[id as PersonalityId]??Compass;
 return <span className={'personality-mark'+(compact?' is-compact':'')} title={trait.name+': '+trait.description} aria-label={trait.name+': '+trait.description}><Icon size={compact?14:16} aria-hidden="true"/>{!compact&&<span>{trait.name}</span>}</span>;
}
export function PersonalityMarks({primary,secondary,compact=false}:{primary?:string|null;secondary?:string|null;compact?:boolean}){
 return <div className="personality-marks"><PersonalityMark id={primary} compact={compact}/>{secondary!==primary&&<PersonalityMark id={secondary} compact={compact}/>}</div>;
}
