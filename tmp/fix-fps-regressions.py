from pathlib import Path
import re
b=Path('EsportsClash.Web/src')
def change(name,fn):
 p=b/name;p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
change('fpsLiveDecisionPolish.test.mjs',lambda s:s.replace("defenders.find(p=>p.slot===2),gallery=defenders.find(p=>p.slot===4)","defenders.find(p=>p.position==='CT_FLEX'),gallery=defenders.find(p=>p.position==='CT_ANCHOR_B')"))
change('fpsLiveIntel.test.mjs',lambda s:s.replace('sim.decide(responder);',"sim.time=Math.max(sim.time,order.readyAt??sim.time)+.01;sim.decide(responder);").replace("a.callFromInformation(a.actors[5],a.actors.slice(5));b.callFromInformation(b.actors[5],b.actors.slice(5));", "a.callFromInformation(a.actors[5],a.actors.slice(5));b.callFromInformation(b.actors[5],b.actors.slice(5));\n  for(const sim of [a,b]){sim.time=sim.actors[5].planAssessmentAt+.01;sim.callFromInformation(sim.actors[5],sim.actors.slice(5));}"))
change('fpsLiveTactics.test.mjs',lambda s:s.replace("assert.ok(samples.every(yaw=>yaw===0),'A stationary hold must not add an artificial scan');", "assert.ok(Math.max(...samples.slice(120))-Math.min(...samples.slice(120))<.00001,'A stationary hold must settle on one stable prepared angle');")
 .replace("const desired=Math.atan2(7,9);let previous=0;", "a.sim.preAim(a.p,true);b.sim.preAim(b.p,true);const desired=Math.atan2(7,9)+a.p.preparedError;let previous=a.p.yaw;")
 .replace("}return listener.contactAt;};", "}sim.time+=.3;for(const cue of listener.pendingCues.filter(c=>c.at<=sim.time))sim.observeIntel(listener,cue.contact);return listener.contactAt;};"))
change('fpsRoundSimulation.test.mjs',lambda s:s.replace('report.simulationVersion,2','report.simulationVersion,4').replace('roundDurationSeconds-16.66','roundDurationSeconds-16').replace("'Entry Fragger'","'Rifling execution'").replace("'Trade Fragger'","'Entry execution'").replace("'Utility Support'","'Positioning execution'").replace('FPS scouting role fits map attributes to FPS specialties','FPS execution strengths do not classify behavioral identities'))
p=b/'fpsMatchSimulation.test.mjs';s=p.read_text(encoding='utf-8');s="import {validateFpsPersonality} from './fps/fpsPlayerArchitecture.ts';\n"+s;s=s.replace('primaryPersonality: personality,\n      secondaryPersonality: personality',"fpsIdentity:{personality:validateFpsPersonality({temperament:'STEADY',playstyle:personality==='aggressive'?'AGGRESSIVE':'PASSIVE',mindset:'TEAM_FIRST',decisionStyle:'METHODICAL'})}")
s=s.replace("makeAttackers('short_fuse')","makeAttackers('aggressive')").replace("makeAttackers('captain')","makeAttackers('passive')");p.write_text(s,encoding='utf-8')
# Obsolete trait-engine tests are replaced by the four-dimension and migration coverage.
p=b/'playerTraits.test.mjs';p.write_text("import './fpsPersonality.test.mjs';\n",encoding='utf-8')
# Validate the physical roster before deriving an allocation to preserve precise error reporting.
p=b/'fps/fpsSimulationEngine.ts';s=p.read_text(encoding='utf-8');line="  if (blueRoster.length !== 5 || redRoster.length !== 5 || new Set([...blueRoster, ...redRoster].map(p => p.id)).size !== 10) throw Error('FPS requires ten distinct players, five per side.');";s=s.replace(line+'\n','');needle='  const initialIdentity=';i=s.index(needle);s=s[:i]+line+'\n'+s[i:];p.write_text(s,encoding='utf-8')
# All generated players receive a persistent personality even when world attribute generation is disabled.
p=Path('EsportsClash.Api/app/Services/WorldPlayerProfiles.php');s=p.read_text(encoding='utf-8');needle="        if (! $this->enabled() || $player->world_profile) {";s=s.replace(needle,"""        if(app(FpsIdentityEngine::class)->ready()){
            $identityTemplate=collect($catalog->payload['cards'])->firstWhere('id',$player->definition_id);
            if($identityTemplate)app(FpsIdentityProfiles::class)->initialize($player,$identityTemplate,true);
        }
"""+needle);p.write_text(s,encoding='utf-8')
# Migration also covers players who never had a legacy identity row.
p=Path('EsportsClash.Api/database/migrations/2026_11_14_000001_replace_fps_player_architecture.php');s=p.read_text(encoding='utf-8');needle="            if(Schema::hasColumn('owned_player_cards','world_profile'))";s=s.replace(needle,"""            DB::table('owned_player_cards')->whereNotIn('id',DB::table('fps_player_identities')->select('player_id'))->orderBy('id')->chunk(200,function($players)use($architecture){foreach($players as $player){
                DB::table('fps_player_identities')->insertOrIgnore(['player_id'=>$player->id,'schema_version'=>4,'dna'=>json_encode(app(\\App\\Services\\FpsIdentityProfiles::class)->dna($player->id)),'personality'=>json_encode($architecture->generate($player->id)),'behavior'=>json_encode(['version'=>4,'matches'=>0,'metrics'=>(object)[]]),'development'=>json_encode(['mapping'=>'deterministic_id_v4_no_legacy_identity','role_familiarity'=>(object)[]]),'created_at'=>now(),'updated_at'=>now()]);
            }});
"""+needle);p.write_text(s,encoding='utf-8')
for p in [b/'components/FpsMatchView.tsx',b/'fps/fpsRoundSimulation.ts']:
 s=p.read_text(encoding='utf-8');p.write_bytes(('\n'.join(line.rstrip() for line in s.splitlines())+'\n').encode('utf-8'))
