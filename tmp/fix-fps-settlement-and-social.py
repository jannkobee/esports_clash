from pathlib import Path
import re
for name in ['OnlineTest.php','CompetitionTest.php']:
 p=Path('EsportsClash.Api/tests/Feature')/name;s=p.read_text(encoding='utf-8');s=re.sub(r"'simulationVersion'\s*=>\s*2", "'simulationVersion'=>$match->plan['fps']['simulation_version']",s);p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/tests/Feature/ClubManagementFlowsTest.php');s=p.read_text(encoding='utf-8').replace("'report' => [", "'report' => ['simulationVersion'=>$match->plan['fps']['simulation_version'],");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/tests/Feature/WorldPlayersTest.php');s=p.read_text(encoding='utf-8').replace("['stats']['lan']","['stats']['rifling']");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/app/Services/WireAccounts.php');s=p.read_text(encoding='utf-8');s=s.replace("'primary_personality'=>$template['primaryPersonality']??$template['personality']??'Not recorded',\n            'secondary_personality'=>$template['secondaryPersonality']??null,'player_id'=>$player->id,", "'personality'=>app(FpsPlayerArchitecture::class)->generate($player->id),'player_id'=>$player->id,");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/app/Services/WorldSocialMind.php');s=p.read_text(encoding='utf-8');a=s.index('        $groups=[');z=s.index("        if($actor->role==='analyst')",a);s=s[:a]+'''        $p=$profile['personality']??null;
        if($p&&$actor->role==='player'){
            $traits['expression']+=match($p['temperament']){'VOLATILE'=>.15,'ICE_COLD'=>-.15,default=>0};
            $traits['caution']+=match($p['playstyle']){'PASSIVE'=>.15,'AGGRESSIVE'=>-.15,default=>0};
            $traits['teamwork']+=$p['mindset']==='TEAM_FIRST'?.15:0;
            $traits['curiosity']+=match($p['decisionStyle']){'ADAPTIVE'=>.12,'INSTINCTIVE'=>.06,default=>0};
        }
'''+s[z:];s=s.replace("$traits=$state['traits'];$interests=", "$traits=$this->traits($actor);$interests=");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Web/src/components/WireAccounts.tsx');s=p.read_text(encoding='utf-8').replace('primary_personality?:string;secondary_personality?:string;',"personality?:import('../fps/fpsPlayerArchitecture').FpsPersonality;").replace('{profile.profile.primary_personality&&null}','');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# Add package verification to normal checks without requiring the API folder in frontend-only environments.
p=Path('EsportsClash.Web/package.json');s=p.read_text(encoding='utf-8').replace('"check:game": "node scripts/validate-design.js', '"check:game": "node scripts/sync-fps-player-architecture.mjs --check && node scripts/validate-design.js');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# Match snapshots retain all four dimensions as they were at allocation.
p=Path('EsportsClash.Web/src/fps/fpsPersonality.ts');s=p.read_text(encoding='utf-8').replace('identity?:{personality:string;natural?:string;intensity:string}','identity?:{personality:string;dimensions?:import(\'./fpsPlayerArchitecture.ts\').FpsPersonality;natural?:string}');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Web/src/fps/fpsIdentityMatch.ts');s=p.read_text(encoding='utf-8').replace("identity:{personality:identity.personality.name,natural:naturalFpsIdentity(identity.personality,position),intensity:'natural'}", "identity:{personality:identity.personality.name,dimensions:{...identity.personality},natural:naturalFpsIdentity(identity.personality,position)}");p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Web/src/components/FpsMatchView.tsx');s=p.read_text(encoding='utf-8').replace(' · {snapshot.tactics.identity.intensity} tendency','');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
