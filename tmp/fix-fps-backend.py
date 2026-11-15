from pathlib import Path
import json,re
b=Path('EsportsClash.Api')
p=b/'app/Services/AuctionDirectory.php';s=p.read_text(encoding='utf-8').replace("'fpsIdentity'=>$p['fpsIdentity']??null,\n  return", "'fpsIdentity'=>$p['fpsIdentity']??null];});\n  return").replace("')/7.0)'","')/6.0)'");p.write_text(s,encoding='utf-8')
p=b/'app/Services/AvatarpediaService.php';s=p.read_text(encoding='utf-8');s=re.sub(r'^\s*,\s*\n','',s,flags=re.M);p.write_text(s,encoding='utf-8')
p=b/'app/Services/WorldPlayerProfiles.php';s=p.read_text(encoding='utf-8').replace('        $out = $template;','        $out = $template;\n        unset($out[\'primaryPersonality\'],$out[\'secondaryPersonality\']);');p.write_text(s,encoding='utf-8')
p=b/'resources/game/catalog.json';catalog=json.loads(p.read_text(encoding='utf-8'))
def convert(s):
 if 'rifling' in s:return {k:s[k] for k in ['rifling','sniping','entry','utility','positioning','shotcalling']}
 bound=lambda x:max(1,min(99,int(x+.5)))
 return dict(rifling=bound(s.get('lan',50)),sniping=bound(s.get('lan',50)*.55+s.get('clu',50)*.35+s.get('iq',50)*.1),entry=bound(s.get('lan',50)*.6+s.get('tf',50)*.4),utility=bound((s.get('tf',50)+s.get('flx',50))/2),positioning=bound(s.get('iq',50)),shotcalling=bound(s.get('ldr',s.get('iq',50))))
for card in catalog['cards']:
 card['stats']=convert(card['stats']);card.pop('primaryPersonality',None);card.pop('secondaryPersonality',None)
p.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
p=b/'app/Services/FpsIdentityEngine.php';s=p.read_text(encoding='utf-8').replace("return $this->ready() && (bool) DB::table('fps_identity_settings')->where('id',1)->value('enabled');","return $this->ready();").replace('without changing personality or specialty','without changing permanent personality')
s=re.sub(r"^\s*\$dna\['adaptability'\]\+=.*?\n",'\n',s,flags=re.M)
needle="            $club=OnlineClub::where('user_id',$user)->firstOrFail();"
s=s.replace(needle,"""            if($user===null){
                $assignments=app(FpsPlayerArchitecture::class)->assignments(array_column($slots,'instance_id'));
                $teams[$side]=['coach'=>['tempo'=>.5,'rigidity'=>.5,'aggression'=>.5,'preparation'=>.5,'freedom'=>.5,'economy'=>.5,'communication'=>.5,'leadership'=>.5,'adaptability'=>.5,'development'=>.5],'plan'=>self::PLAN,'chemistry'=>self::CHEMISTRY];
                foreach($slots as $slot){$id=$slot['instance_id'];$players[$id]=['id'=>$id,'personality'=>app(FpsPlayerArchitecture::class)->generate($id),'assignments'=>$assignments[$id],'dna'=>$profiles->dna($id),'intensity'=>.5,'roleSuitability'=>.5,'familiarity'=>0];}
                continue;
            }
"""+needle)
p.write_text(s,encoding='utf-8')
p=b/'app/Services/OnlineService.php';s=p.read_text(encoding='utf-8').replace("'simulation_version' => 2","'simulation_version' => 4").replace("if ($blueUser !== null && $redUser !== null && app(FpsIdentityEngine::class)->enabled())", "if (app(FpsIdentityEngine::class)->enabled())")
s=s.replace("        return OnlineMatch::create", "        return OnlineMatch::create")
# Validate observation semantics before allowing persisted progression.
s=s.replace("            $checkPrivate($report);", """            $checkPrivate($report);
            foreach($report['events'] as $event)if(($event['type']??null)==='behavior_observation'){
                $o=$event['observation']??[];
                if(!isset($match->plan['fps_identity']['players'][$event['actorId']??''])||!in_array($o['metric']??null,['engagement','firstContact','coordination','rotation','improvisation','failedExecuteAdjustment','opponentAdjustment','sacrifice','retake','utilitySupport','lurkTiming','risk','strategyCompliance'],true)||!is_bool($o['attempted']??null))$this->invalid('Invalid behavioral observation.');
            }
""")
p.write_text(s,encoding='utf-8')
p=Path('infrastructure/online/fps-match-worker.mjs');s=p.read_text(encoding='utf-8').replace("plan.fps.simulation_version !== undefined && ![4].includes(plan.fps.simulation_version)","plan.fps.simulation_version!==4").replace(',\n        primaryPersonality: definition.primaryPersonality,\n        secondaryPersonality: definition.secondaryPersonality','');p.write_text(s,encoding='utf-8')
p=Path('EsportsClash.Web/src/fps/fpsMatchViewModel.ts');s=p.read_text(encoding='utf-8').replace('report.simulationVersion !== 2 && report.simulationVersion !== 3','report.simulationVersion !== 2 && report.simulationVersion !== 3 && report.simulationVersion !== 4').replace('(report.simulationVersion === 2 || report.simulationVersion === 3)','(report.simulationVersion === 2 || report.simulationVersion === 3 || report.simulationVersion === 4)');p.write_text(s,encoding='utf-8')
# Contextual recruitment fit complements ability without personality pairing bonuses.
p=b/'app/Services/FpsPlayerArchitecture.php';s=p.read_text(encoding='utf-8');i=s.index('    /** Only the migration')
s=s[:i]+'''    public function recruitmentFit(array $definition,array $plan): float
    {
        $p=$definition['fpsIdentity']['personality']??null;if(!$p)return .5;
        $initiative=match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5};
        $preparation=match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5};
        return (2-abs($initiative-($plan['aggression']??.5))-abs($preparation-($plan['preparation']??.5)))/2;
    }
'''+s[i:];p.write_text(s,encoding='utf-8')
p=b/'app/Services/BotClubManager.php';s=p.read_text(encoding='utf-8').replace("        $byId = $owned->keyBy('id');", "        $byId = $owned->keyBy('id');\n        $tacticalPlan=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('gameplan')??'{}',true);")
s=s.replace("$improvement = ($player['ovr'] ?? 0) - ($definitions[$starter?->id]['ovr'] ?? 0);", "$improvement = ($player['ovr'] ?? 0) - ($definitions[$starter?->id]['ovr'] ?? 0)+12*(app(FpsPlayerArchitecture::class)->recruitmentFit($player,$tacticalPlan)-app(FpsPlayerArchitecture::class)->recruitmentFit($definitions[$starter?->id]??[],$tacticalPlan));")
p.write_text(s,encoding='utf-8')
p=b/'app/Services/ClubDevelopmentService.php';s=p.read_text(encoding='utf-8');needle="        $candidates = $owned->reject";i=s.index(needle);s=s[:i]+"        $tacticalPlan=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('gameplan')??'{}',true);\n        $lineupScore=fn($id)=>($definitions[$id]['ovr']??0)+12*(app(FpsPlayerArchitecture::class)->recruitmentFit($definitions[$id]??[],$tacticalPlan)-.5);\n"+s[i:];s=s.replace("sortByDesc(fn ($card) => $definitions[$card->id]['ovr'] ?? 0)","sortByDesc(fn ($card) => $lineupScore($card->id))").replace("$rating = $definitions[$starter?->id]['ovr'] ?? 0;","$rating = $lineupScore($starter?->id);").replace("if (($definitions[$candidate->id]['ovr'] ?? 0) <= $rating)","if ($lineupScore($candidate->id) <= $rating)");p.write_text(s,encoding='utf-8')
