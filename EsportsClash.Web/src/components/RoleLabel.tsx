import {Shield,Swords,ScanEye,Sparkles,Crosshair,HeartHandshake,Radio,ChartNoAxesCombined,Video,Mic,Gavel,Eye,BriefcaseBusiness,GraduationCap,HeartPulse,Brain,UserRound,Flag,Trophy,Gamepad2} from 'lucide-react';
import './role-label.css';

const roles={
  tank:[Shield,'Tank'],fighter:[Swords,'Fighter'],assassin:[ScanEye,'Assassin'],mage:[Sparkles,'Mage'],marksman:[Crosshair,'Marksman'],support:[HeartHandshake,'Support'],
  caster:[Radio,'Caster'],analyst:[ChartNoAxesCombined,'Analyst'],streamer:[Video,'Streamer'],host:[Mic,'Host'],referee:[Gavel,'Referee'],observer:[Eye,'Observer'],manager:[BriefcaseBusiness,'Manager'],
  player:[UserRound,'Player'],organizer:[Flag,'Organizer'],tournament:[Trophy,'Tournament'],game:[Gamepad2,'Arena game'],
  general_manager:[BriefcaseBusiness,'General manager'],player_agent:[BriefcaseBusiness,'Player agent'],scout:[ScanEye,'Scout'],sponsor:[Flag,'Sponsor'],psychologist:[Brain,'Team psychologist'],
  head_coach:[GraduationCap,'Head coach'],assistant_coach:[GraduationCap,'Assistant coach'],meta_analyst:[ChartNoAxesCombined,'Meta analyst'],performance_coach:[HeartPulse,'Performance coach'],team_psychologist:[Brain,'Team psychologist'],
} as const;
export function RoleLabel({role,size=13}:{role?:string|null;size?:number}){
  const key=role?.trim().toLowerCase().replaceAll(' ','_') as keyof typeof roles;
  const [Icon,label]=roles[key]??[UserRound,role?.replaceAll('_',' ')||'Role unlisted'];
  return <span className="role-label"><Icon size={size} aria-hidden="true"/><span>{label}</span></span>;
}
