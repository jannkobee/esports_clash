<?php
namespace App\Services;

use App\Models\{ClubFixture,OwnedPlayerCard};
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\{Cache,DB,Schema};

/** Event/utility simulation with persistent social state. Contains no network or model client. */
class WorldVoiceSimulation
{
    public function ready(): bool {
        return (bool)config('world_narration.enabled')&&Schema::hasTable('world_voice_states')&&Schema::hasTable('world_voice_memories');
    }
    public function status(): string { return $this->ready()?'enabled':'disabled'; }

    public function tick(?float $deadline = null): array {
        $summary=['observed'=>0,'published'=>0];if(!$this->ready())return $summary;
        $lock=Cache::lock('world-voice-simulation:v1',90);if(!$lock->get())return $summary;
        try {
            $daily=max(0,min(1000,(int)config('world_narration.daily_posts',144)));
            $hourly=max(0,min(100,(int)config('world_narration.hourly_posts',18)));
            $today=DB::table('world_voice_memories')->where('outcome','published')->where('observed_at','>=',now()->startOfDay())->count();
            $hour=DB::table('world_voice_memories')->where('outcome','published')->where('observed_at','>=',now()->subHour())->count();
            $remaining=min(max(0,$daily-$today),max(0,$hourly-$hour),max(0,min(5,(int)config('world_narration.posts_per_tick',3))));
            if($remaining===0)return $summary;
            $sources=DB::table('world_news_posts')->whereNull('hidden_at')->whereNull('source_post_id')->whereIn('kind',['arena_update','result','world_activity','tournament','spotlight'])
                ->where('published_at','>=',now()->subDays(2))->orderByDesc('id')->limit(40)->get();
            $signals=[];foreach($sources as $source)if($signal=$this->signal($source))$signals[$source->id]=$signal;
            if(!$signals)return $summary;
            $actors=collect();
            foreach(['analyst','streamer','caster','host','manager','general_manager','organizer','referee','observer','head_coach','assistant_coach','performance_coach','psychologist'] as $role){
                $actors=$actors->concat($this->available()->where('role',$role)->orderByRaw('(SELECT COUNT(*) FROM world_voice_memories m WHERE m.account_id=world_wire_accounts.id)')->orderBy('id')->limit(12)->get());
            }
            $players=array_values(array_unique(array_filter(array_column($signals,'player_id'))));
            if($players)$actors=$actors->concat($this->available()->where('kind','player')->whereIn('source_id',$players)->limit(40)->get());
            if(in_array('patch',array_column($signals,'type'),true))$actors=$actors->concat($this->available()->where('kind','player')->orderByRaw('(SELECT COUNT(*) FROM world_voice_memories m WHERE m.account_id=world_wire_accounts.id)')->orderBy('id')->limit(24)->get());
            $actors=$actors->unique('id')->values();if($actors->isEmpty())return $summary;
            $seen=DB::table('world_voice_memories')->whereIn('account_id',$actors->pluck('id'))->whereIn('source_post_id',array_keys($signals))->get(['account_id','source_post_id'])->mapWithKeys(fn($m)=>[$m->account_id.':'.$m->source_post_id=>true]);
            $counts=DB::table('world_voice_memories')->whereIn('source_post_id',array_keys($signals))->where('outcome','published')->selectRaw('source_post_id,COUNT(*) as total')->groupBy('source_post_id')->pluck('total','source_post_id');
            $roleCounts=DB::table('world_voice_memories as m')->join('world_wire_accounts as a','a.id','=','m.account_id')->where('m.outcome','published')->where('m.observed_at','>=',now()->subHour())->selectRaw('a.role,COUNT(*) as total')->groupBy('a.role')->pluck('total','a.role');
            $pairs=[];$mind=app(WorldSocialMind::class);
            foreach($actors as $actor)foreach($signals as $sourceId=>$signal){
                if($deadline!==null && microtime(true)>=$deadline)return $summary;
                if(isset($seen[$actor->id.':'.$sourceId])||($counts[$sourceId]??0)>=4)continue;
                $relevance=$this->relevance($actor,$signal);if($relevance<.25)continue;
                $freshness=max(.25,1-Carbon::parse($signal['published_at'])->diffInHours(now(),true)/48);
                $pairs[]=['actor'=>$actor,'source'=>$sources->firstWhere('id',$sourceId),'signal'=>$signal,
                    'rank'=>$relevance*.7+$freshness*.2+$mind->noise($actor->id.':'.$sourceId.':attention')*.1];
            }
            $spoke=[];$unavailable=[];
            while($pairs&&$summary['observed']<max(1,min(24,(int)config('world_narration.decisions_per_tick',12)))&&$summary['published']<$remaining){
                if($deadline!==null && microtime(true)>=$deadline)break;
                $pairs=array_values(array_filter($pairs,fn($p)=>!isset($spoke[$p['actor']->id])&&!isset($unavailable[$p['actor']->id])&&($counts[$p['source']->id]??0)<4));
                if(!$pairs)break;
                $score=fn($p)=>$p['rank']-min(.35,.1*($roleCounts[$p['actor']->role]??0));
                usort($pairs,fn($a,$b)=>$score($b)<=>$score($a));$pair=array_shift($pairs);
                $outcome=$this->observe($pair['actor']->id,$pair['source']->id);
                if($outcome==='unchanged'){$unavailable[$pair['actor']->id]=true;continue;}$summary['observed']++;
                if($outcome==='published'){$summary['published']++;$spoke[$pair['actor']->id]=true;$counts[$pair['source']->id]=($counts[$pair['source']->id]??0)+1;$roleCounts[$pair['actor']->role]=($roleCounts[$pair['actor']->role]??0)+1;}
            }
            return $summary;
        }finally{$lock->release();}
    }

    private function available() {
        return DB::table('world_wire_accounts')->where('autonomous',true)->whereNull('owner_id')->where('kind','<>','game')
            ->where(fn($q)=>$q->whereNull('last_post_at')->orWhere('last_post_at','<=',now()->subHours(max(1,(int)config('world_narration.account_cooldown_hours',8)))));
    }

    public function signal(object $source): ?array {
        if($source->hidden_at||$source->source_post_id||!in_array($source->kind,['arena_update','result','world_activity','tournament','spotlight']))return null;
        $facts=json_decode($source->facts??'{}',true)??[];
        if(in_array($facts['provenance']??null,['launch_simulation','statistical_exhibition','generated_opinion','simulated_opinion']))return null;
        $type=match($source->kind){'arena_update'=>'patch','result'=>'result','spotlight'=>'development',default=>'calendar'};
        if($source->kind==='world_activity'){
            $event=isset($facts['activity_id'])?DB::table('club_world_events')->find($facts['activity_id']):null;
            $type=match($event?->kind){'transfer'=>'transfer','recruitment'=>'recruitment','auction','bid'=>'market','competition'=>'calendar',default=>'club'};
        }
        if(($facts['provenance']??null)==='verified_live')$type='broadcast';
        if(isset($facts['award_year']))$type='awards';
        elseif($source->kind==='spotlight'&&isset($facts['score']))$type='rankings';
        elseif($source->kind==='spotlight'&&isset($facts['home_wins']))$type='rivalry';
        $playerId=$facts['player_instance_id']??$facts['player_id']??null;$clubId=$facts['team_id']??null;
        $tournamentId=$source->tournament_id??$facts['tournament_id']??null;$entities=[];$clubIds=[];
        if($clubId){$clubIds[]=(int)$clubId;$entities[]=['kind'=>'club','id'=>(string)$clubId];}
        $player=$playerId&&Str::isUuid($playerId)?DB::table('owned_player_cards')->where('id',$playerId)->first(['id','persona_name','user_id']):null;
        if($player){$entities[]=['kind'=>'player','id'=>(string)$player->id];$currentClub=DB::table('online_clubs')->where('user_id',$player->user_id)->value('id');if($currentClub)$clubIds[]=(int)$currentClub;}
        $fixture=$source->match_id?ClubFixture::where('match_id',$source->match_id)->first():(!empty($facts['fixture_id'])?ClubFixture::find($facts['fixture_id']):null);
        if($fixture){foreach([$fixture->home_club_id,$fixture->away_club_id] as $id)if($id){$clubIds[]=(int)$id;$entities[]=['kind'=>'club','id'=>(string)$id];}}
        $winnerClubId=null;$game=null;
        if($fixture&&in_array($type,['result','rivalry'])){
            $game=DB::table('online_matches')->where('id',$source->match_id)->first(['plan','result','status']);
            $result=json_decode($game?->result??'{}',true)??[];
            if($game?->status==='completed')$winnerClubId=match($result['winner']??null){'blue'=>$fixture->home_club_id,'red'=>$fixture->away_club_id,default=>null};
        }
        if($tournamentId)$entities[]=['kind'=>'tournament','id'=>(string)$tournamentId];
        $organizerId=$tournamentId?DB::table('club_tournaments as t')->join('competition_definitions as d','d.id','=','t.definition_id')->where('t.id',$tournamentId)->value('d.organizer_id'):null;
        $crew=$fixture?DB::table('fixture_talent_assignments')->where('fixture_id',$fixture->id)->get(['talent_id','role'])->groupBy('role')->map(fn($rows)=>$rows->pluck('talent_id')->map(fn($id)=>(int)$id)->all())->all():[];
        $subject=$type==='patch'?(isset($facts['version'])?'Arena '.preg_replace('/^Arena\s+/i','',$facts['version']):'the Arena update'):
            ($player?->persona_name??($clubId?DB::table('online_clubs')->where('id',$clubId)->value('name'):null)??$source->headline);
        if($game){$plan=json_decode($game->plan,true)??[];if(!empty($plan['clubs']['blue'])&&!empty($plan['clubs']['red']))$subject=$plan['clubs']['blue'].' vs '.$plan['clubs']['red'];}
        $subject=preg_replace('/^(Tournament desk|Tournament notice|Competition entry|Player spotlight|Development watch|New signing|Transfer desk):\s*/i','',$subject);
        $subject=trim(mb_substr(strip_tags($subject),0,110));
        if($subject===''||preg_match('/https?:|www\.|@/i',$subject))$subject=match($type){'patch'=>'the Arena update','result'=>'the recorded game','calendar'=>'the published competition',default=>'the latest club news'};
        $text=mb_strtolower($source->headline.' '.$source->body);
        $roleTopics=[];foreach(['tank','fighter','assassin','mage','marksman','support'] as $role)if(preg_match('/\b'.$role.'s?\b/u',$text))$roleTopics[]=$role;
        $focus=match(true){
            $type==='patch'&&preg_match('/cooldown|haste|ability/',$text)===1=>'ability windows',
            $type==='patch'&&preg_match('/armor|armour|resistance|defen[cs]e/',$text)===1=>'survivability',
            $type==='patch'&&preg_match('/shield|heal|support/',$text)===1=>'team protection',
            $type==='patch'&&preg_match('/damage|crit|attack/',$text)===1=>'damage trades',
            $type==='patch'=>'the Arena changes',in_array($type,['transfer','recruitment','club','market'])=>'squad building',
            in_array($type,['result','rivalry'])=>'the recorded game',$type==='development'=>'player development',$type==='rankings'=>'the published rating record',$type==='awards'=>'the published honors',default=>'competition preparation',
        };
        $entity=$playerId?'player:'.$playerId:($tournamentId?'tournament:'.$tournamentId:($clubId?'club:'.$clubId:'circuit'));
        $topic=$type==='patch'?'patch:'.($facts['version']??$source->arena_update_id??$source->id).':'.$focus:$type.':'.$entity;
        $entities=array_values(collect($entities)->unique(fn($e)=>$e['kind'].':'.$e['id'])->all());
        return ['source_id'=>$source->id,'type'=>$type,'subject'=>$subject,'focus'=>$focus,'topic_key'=>mb_substr($topic,0,180),'winner_club_id'=>$winnerClubId,
            'player_id'=>$playerId,'club_ids'=>array_values(array_unique($clubIds)),'reported_club_id'=>$clubId?(int)$clubId:null,'tournament_id'=>$tournamentId,'fixture_id'=>$fixture?->id,'organizer_id'=>$organizerId,'crew'=>$crew,'role_topics'=>$roleTopics,
            'entities'=>$entities,'quote'=>mb_substr(trim($source->body),0,180),'phase'=>$facts['release_status']??null,
            'self'=>false,'valence'=>in_array($type,['recruitment','development','transfer'])?.45:0,'published_at'=>$source->published_at];
    }

    public function relevance(object $actor,array $signal): float {
        if(!$actor->autonomous||$actor->owner_id||$actor->kind==='game'||$actor->kind==='tournament')return 0;
        $p=json_decode($actor->profile,true)??[];
        if($actor->kind==='player'&&$actor->role==='player'){
            if($signal['player_id']===$actor->source_id)return 1;
            if($signal['type']==='patch')return .58+(!empty($p['preferred_role'])&&in_array(mb_strtolower($p['preferred_role']),$signal['role_topics'],true)?.2:0);
            return isset($p['club_id'])&&in_array((int)$p['club_id'],$signal['club_ids'],true)?.72:0;
        }
        if(in_array($actor->role,['manager','general_manager']))return isset($p['club_id'])&&in_array((int)$p['club_id'],$signal['club_ids'],true)?.95:0;
        if(in_array($actor->role,['head_coach','assistant_coach','performance_coach','psychologist']))return $signal['type']==='patch'?.65:(!empty($p['club_id'])&&in_array((int)$p['club_id'],$signal['club_ids'],true)?.85:0);
        if($actor->role==='organizer'){
            return $signal['organizer_id']&&(string)$signal['organizer_id']===$actor->source_id?.95:0;
        }
        if(in_array($actor->role,['referee','observer']))return in_array((int)$actor->source_id,$signal['crew'][$actor->role]??[],true)?.9:0;
        return match($actor->role){
            'analyst'=>match($signal['type']){'patch'=>.88,'result'=>.8,'calendar'=>.66,'development'=>.65,default=>.52},
            'streamer'=>match($signal['type']){'patch'=>.85,'development','recruitment','transfer'=>.78,default=>.6},
            'caster'=>in_array($signal['type'],['result','broadcast','rivalry'])?.9:($signal['type']==='calendar'?.6:.38),
            'host'=>in_array($signal['type'],['calendar','awards'])?.8:.45,default=>0,
        };
    }

    public function observe(int $accountId,int $sourceId): string {
        if(!$this->ready())return 'unchanged';
        return DB::transaction(function()use($accountId,$sourceId){
            $actor=DB::table('world_wire_accounts')->where('id',$accountId)->lockForUpdate()->first();
            if(!$actor||!$actor->autonomous||$actor->owner_id||$actor->kind==='game'||$actor->kind==='tournament')return 'unchanged';
            if(DB::table('world_voice_memories')->where('account_id',$accountId)->where('source_post_id',$sourceId)->exists())return 'unchanged';
            $actor=app(WireAccounts::class)->refresh($actor);if(!$actor||!$actor->autonomous||$actor->owner_id)return 'unchanged';
            if($actor->last_post_at&&Carbon::parse($actor->last_post_at)->gt(now()->subHours(max(1,(int)config('world_narration.account_cooldown_hours',8)))))return 'unchanged';
            $source=DB::table('world_news_posts')->where('id',$sourceId)->whereNull('hidden_at')->lockForUpdate()->first();
            if(!$source||!($signal=$this->signal($source)))return 'unchanged';
            $signal['self']=$signal['player_id']===$actor->source_id||in_array((int)(json_decode($actor->profile,true)['club_id']??0),$signal['club_ids'],true);
            $clubId=(int)(json_decode($actor->profile,true)['club_id']??0);
            if($clubId&&$signal['winner_club_id']&&in_array($clubId,$signal['club_ids'],true))$signal['valence']=(int)$signal['winner_club_id']===$clubId?.7:-.7;
            $mind=app(WorldSocialMind::class);$state=$this->state($actor);
            $recent=DB::table('world_voice_memories')->where('account_id',$accountId)->where('observed_at','>=',now()->subDays(8))->orderByDesc('id')->limit(16)->get()->map(fn($m)=>(array)$m)->all();
            $familiarity=0;foreach($signal['entities'] as $e)$familiarity=max($familiarity,(float)(DB::table('world_voice_relationships')->where('account_id',$accountId)->where('subject_kind',$e['kind'])->where('subject_id',$e['id'])->value('attention')??0));
            $decision=$mind->decide($actor,$signal,$state,$recent,$this->relevance($actor,$signal),$familiarity);
            $body=null;$chosen=null;$outcome='observed';$reason=$decision['reason'];
            if($decision['speak'])foreach(app(WorldVoiceGrammar::class)->candidates($actor,$signal,$decision) as $candidate){
                if(!$this->acceptable($candidate['body'],$actor->id,$source))continue;
                $body=$candidate['body'];$chosen=$candidate;$outcome='published';$reason='goal_and_event_match';break;
            }
            if($decision['speak']&&!$body)$reason='recent_language_saturated';
            $postId=null;
            if($body){
                $postId=DB::table('world_news_posts')->insertGetId(['event_key'=>'simulation-voice:'.$accountId.':'.$sourceId,'wire_account_id'=>$accountId,'source_post_id'=>$sourceId,'arena_update_id'=>$source->arena_update_id,
                    'kind'=>'reaction','headline'=>mb_substr($actor->name.' on '.$source->headline,0,200),'body'=>$body,
                    'facts'=>json_encode(['provenance'=>'simulated_opinion','engine'=>WorldSocialMind::ENGINE,'source_post_id'=>$sourceId,'source_quote'=>$signal['quote'],'angle'=>$chosen['intent'],'goal'=>$decision['goal']]),'published_at'=>now()]);
                DB::table('world_wire_accounts')->where('id',$accountId)->update(['last_post_at'=>now(),'updated_at'=>now()]);
            }
            $state=$mind->evolve($state,$signal,$decision);
            DB::table('world_voice_states')->updateOrInsert(['account_id'=>$accountId],[
                'engine'=>WorldSocialMind::ENGINE,'traits'=>json_encode($state['traits']),'mood'=>json_encode($state['mood']),'interests'=>json_encode($state['interests']),
                'goals'=>json_encode($state['goals']),'current_goal'=>$state['current_goal'],'observations'=>$state['observations'],'updated_at'=>now()]);
            DB::table('world_voice_memories')->insert(['account_id'=>$accountId,'source_post_id'=>$sourceId,'post_id'=>$postId,'topic_key'=>$signal['topic_key'],'event_type'=>$signal['type'],
                'intent'=>$chosen['intent']??'silence','goal'=>$decision['goal'],'outcome'=>$outcome,'reason'=>$reason,'salience'=>$decision['salience'],
                'composition'=>$chosen?json_encode($chosen['composition']):null,'body_hash'=>$body?hash('sha256',$body):null,'observed_at'=>now()]);
            foreach($signal['entities'] as $e){
                $where=['account_id'=>$accountId,'subject_kind'=>$e['kind'],'subject_id'=>$e['id']];$old=DB::table('world_voice_relationships')->where($where)->first();
                DB::table('world_voice_relationships')->updateOrInsert($where,['observations'=>($old?->observations??0)+1,'attention'=>round(min(1,($old?->attention??0)*.85+$decision['salience']*.15),4),'last_observed_at'=>now()]);
            }
            return $outcome;
        },3);
    }

    private function state(object $actor): array {
        $mind=app(WorldSocialMind::class);$stored=DB::table('world_voice_states')->where('account_id',$actor->id)->first();
        if(!$stored)return $mind->initial($actor);
        $state=['traits'=>$mind->traits($actor),'mood'=>json_decode($stored->mood,true),'interests'=>json_decode($stored->interests,true),
            'goals'=>json_decode($stored->goals,true),'current_goal'=>$stored->current_goal,'observations'=>$stored->observations];
        $decay=exp(-Carbon::parse($stored->updated_at)->diffInHours(now(),true)/48);
        foreach(['energy'=>.5,'confidence'=>.5,'concern'=>.2] as $key=>$baseline)$state['mood'][$key]=$baseline+($state['mood'][$key]-$baseline)*$decay;
        return $state;
    }

    private function acceptable(string $body,int $accountId,object $source): bool {
        if(mb_strlen($body)<25||mb_strlen($body)>600||preg_match('/https?:|www\.|@[\w]+|<[^>]+>/i',$body))return false;
        if(DB::table('world_voice_memories')->where('body_hash',hash('sha256',$body))->exists())return false;
        $recent=DB::table('world_news_posts')->where('kind','reaction')->whereNull('hidden_at')->where(fn($q)=>$q->where('wire_account_id',$accountId)->orWhere('source_post_id',$source->id))->orderByDesc('id')->limit(24)->pluck('body');
        $tokens=fn($s)=>array_unique(preg_split('/\W+/u',mb_strtolower($s),-1,PREG_SPLIT_NO_EMPTY));$a=$tokens($body);
        foreach($recent as $old){$b=$tokens($old);$union=array_unique([...$a,...$b]);if($union&&count(array_intersect($a,$b))/count($union)>.64)return false;}
        return true;
    }

    public function publicState(int $accountId): ?array {
        if(!Schema::hasTable('world_voice_states'))return null;$state=DB::table('world_voice_states')->where('account_id',$accountId)->first();
        if(!$state)return null;$mood=json_decode($state->mood,true);
        return ['focus'=>WorldSocialMind::GOALS[$state->current_goal]??'Follow the next opportunity','disposition'=>($mood['concern']??0)>.55?'Reflective':(($mood['energy']??0)>.65?'Engaged':'Steady'),
            'observed_at'=>Carbon::parse($state->updated_at)->toIso8601String()];
    }
}
