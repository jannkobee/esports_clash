from pathlib import Path
import re
p=Path('EsportsClash.Api/app/Services/BotClubManager.php');s=p.read_text(encoding='utf-8');needle="                $listed = ClubAuction::where('seller_id', $clubId)";i=s.index(needle);s=s[:i]+'''                // The same persisted tactical orders used by human clubs are prepared by AI managers.
                $activeIds=array_column($club->starters??$club->lineup,'instance_id');
                $system=DB::table('fps_team_systems')->where('club_id',$club->id)->first();
                $coach=app(FpsIdentityEngine::class)->coach($club)['profile'];
                $gameplan=$system?json_decode($system->gameplan,true):['tempo'=>$coach['tempo'],'structure'=>$coach['rigidity'],'aggression'=>$coach['aggression'],'preparation'=>$coach['preparation'],'freedom'=>$coach['freedom'],'economy'=>$coach['economy']];
                $orders=$system?json_decode($system->instructions??'{}',true):[];
                foreach(app(FpsPlayerArchitecture::class)->botAssignments($definitions->only($activeIds)->all(),$gameplan) as $id=>$assignment)$orders[$id]=array_replace($orders[$id]??['instruction'=>'balanced','training'=>'system'],$assignment);
                DB::table('fps_team_systems')->updateOrInsert(['club_id'=>$club->id],['revision'=>(int)($system?->revision??0)+1,'gameplan'=>json_encode($gameplan),'culture'=>$system?->culture??json_encode($gameplan),'instructions'=>json_encode($orders),'created_at'=>$system?->created_at??now(),'updated_at'=>now()]);
'''+s[i:];p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
p=Path('EsportsClash.Api/database/migrations/2026_11_14_000001_replace_fps_player_architecture.php');s=p.read_text(encoding='utf-8');needle="            if(DB::table('fps_player_identities')->whereNull('personality')->exists())";i=s.index(needle);s=s[:i]+'''            if(Schema::hasTable('world_wire_accounts'))DB::table('world_wire_accounts')->where('kind','player')->orderBy('id')->chunk(200,function($rows)use($architecture,$archive){foreach($rows as $row){
                $profile=json_decode($row->profile,true);if(isset($profile['personality']['temperament'])&&!isset($profile['primary_personality'])&&!isset($profile['secondary_personality']))continue;
                $archive('wire_profile',$row->id,$profile);unset($profile['primary_personality'],$profile['secondary_personality']);
                $p=DB::table('fps_player_identities')->where('player_id',$row->source_id)->value('personality');$profile['personality']=$p?json_decode($p,true):$architecture->generate((string)$row->source_id);
                DB::table('world_wire_accounts')->where('id',$row->id)->update(['profile'=>json_encode($profile)]);
            }});
'''+s[i:];p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# The canonical package regression guards frontend-only deployments against external resource imports.
p=Path('EsportsClash.Web/src/fpsArchitecturePackaging.test.mjs');p.write_bytes('''import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsPlayerArchitecture.ts';
test('the FPS catalog resolves entirely inside the frontend package',async()=>{
 const source=await readFile(new URL('./fps/fpsPlayerArchitecture.ts',import.meta.url),'utf8');
 assert.ok(!source.includes('EsportsClash.Api/'));const json=JSON.parse(await readFile(new URL('./fps/fps-player-architecture-v4.json',import.meta.url),'utf8'));
 assert.equal(json.version,4);assert.equal(json.profiles.length,18);assert.equal(FPS_IDENTITY_PERSONALITIES.length,54);
});
'''.encode('utf-8'))
