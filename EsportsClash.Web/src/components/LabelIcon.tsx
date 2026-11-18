import {Archive,ArrowLeftRight,BookOpen,Brain,Building2,CalendarDays,ChartNoAxesCombined,CheckCheck,ClipboardList,Clock,Coins,Crosshair,FileText,Flag,GraduationCap,Handshake,Hash,HeartPulse,House,Inbox,Layers,MapPin,Newspaper,Radio,Search,Settings,Shield,Swords,Trophy,UserRound,Users,Zap} from 'lucide-react';
import {ICONS,type IconKey} from './ui/icons';

/** Section ids and exact labels that have a registered destination icon (see ui/icons.ts). */
const EXACT:Record<string,IconKey>={home:'home',squad:'squad',play:'play',market:'market',finances:'finances',history:'history',hexapedia:'hexapedia',supporter:'supporter',settings:'settings',scouting:'scouting','match history':'history','calendar':'fixtures'};

/**
 * One restrained leading-icon language across headings, form labels and navigation.
 * Registered destinations resolve exactly; free-text labels fall back to a keyword match, and to no icon at all
 * rather than a generic one that would repeat across unrelated headings.
 */
export function LabelIcon({name,size=15}:{name:string;size?:number}) {
  const key=name.toLowerCase();
  const exact=EXACT[key];
  if(exact){const Registered=ICONS[exact];return <Registered size={size} strokeWidth={1.7} aria-hidden="true" className="label-icon"/>;}
  const Icon=/aim|mechanic/.test(key)?Crosshair:/trading|execution/.test(key)?Swords:/game sense|analysis|analyst|personality/.test(key)?Brain:/leadership|shotcall/.test(key)?Users:/clutch|burst/.test(key)?Zap:/stamina|conditioning/.test(key)?HeartPulse:/flexibility|adaptability|pool/.test(key)?Layers:/inbox|correspondence|invitation|reply/.test(key)?Inbox:/report|regulation|rules|biograph/.test(key)?FileText:/training|develop|academy|coach|staff/.test(key)?GraduationCap:/transfer|auction|bid/.test(key)?ArrowLeftRight:/money|prize|reward|fee|wage|salary|budget|fund/.test(key)?Coins:/calendar|date|schedule|opens|closes|deadline|kickoff/.test(key)?CalendarDays:/broadcast|hexacast|live/.test(key)?Radio:/news|wire|narrative/.test(key)?Newspaper:/supporter|laurel|award|tournament|competition|champion|honor|achievement|format|bracket|qualification/.test(key)?Trophy:/sponsor|partner/.test(key)?Handshake:/organizer|venue/.test(key)?Building2:/national|country|region|location|geograph/.test(key)?MapPin:/team|club|identity|crest|jersey/.test(key)?Shield:/role|position/.test(key)?UserRound:/player|squad|roster|participant|starter/.test(key)?Users:/career|contract|manager/.test(key)?UserRound:/statistic|rating|overall|rank/.test(key)?ChartNoAxesCombined:/avatar|match|play|scrimmage/.test(key)?Swords:/record|archive|history|release/.test(key)?Archive:/reference|pedia|encyclop|guide|handbook/.test(key)?BookOpen:/home|office|overview/.test(key)?House:/search/.test(key)?Search:/setting|tool/.test(key)?Settings:/read/.test(key)?CheckCheck:/time|duration/.test(key)?Clock:/slot|number|capacity|seed/.test(key)?Hash:/order|action|decision/.test(key)?ClipboardList:/season|stage/.test(key)?Flag:null;
  if(!Icon)return null;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" className="label-icon"/>;
}
