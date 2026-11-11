<?php
namespace App\Services;

use App\Models\{ClubTournament, OnlineCatalog, OnlineClub, OwnedPlayerCard};
use Illuminate\Support\Facades\{DB, Schema};

class WireAccounts
{
    private array $templates=[];
    public function ready(): bool { return Schema::hasTable('world_wire_accounts'); }

    private function save(string $kind, string $id, string $name, string $role, array $profile, ?int $owner = null, bool $autonomous = false): int
    {
        $key=$kind.':'.$id;$name=mb_substr($name,0,160);
        DB::table('world_wire_accounts')->upsert([['source_key'=>$key,'source_id'=>$id,'kind'=>$kind,'name'=>$name,
            'handle'=>($kind==='game'?'arena':$kind).'-'.substr(hash('sha256',$key),0,10),'role'=>$role,'profile'=>json_encode($profile),
            'owner_id'=>$owner,'autonomous'=>$autonomous,'created_at'=>now(),'updated_at'=>now()]], ['source_key'], ['name','role','profile','owner_id','autonomous','updated_at']);
        return DB::table('world_wire_accounts')->where('source_key',$key)->value('id');
    }

    public function game(): int { return $this->save('game','arena','Arena Game Updates','game',['bio'=>'Official MOBA balance, content and release announcements. Manager-game announcements are separate.']); }

    public function career(\App\Models\WorldAgent $agent):int {
        $old=$agent->wire_account_id?DB::table('world_wire_accounts')->find($agent->wire_account_id):null;
        $profile=$old?json_decode($old->profile,true):[];
        $id=$this->save($old?->kind??'career',$old?->source_id??$agent->id,$agent->name,$agent->profession,array_replace($profile??[],['bio'=>'Circuit professional. Employment and career milestones follow confirmed records.','club_id'=>$agent->club_id,'former_player_id'=>$agent->kind==='player'?$agent->source_id:null]),autonomous:$agent->status!=='human_controlled');
        if($old&&$old->role!==$agent->profession){
            if($old->kind==='talent')DB::table('world_media_personalities')->where('id',(int)$old->source_id)->update(['role'=>$agent->profession]);
            $actor=DB::table('world_wire_accounts')->find($id);$goals=app(WorldSocialMind::class)->initial($actor)['goals'];
            DB::table('world_voice_states')->where('account_id',$id)->update(['goals'=>json_encode($goals),'current_goal'=>$goals[0],'updated_at'=>now()]);
        }
        return $id;
    }

    public function tournament(ClubTournament $event): int {
        return $this->save('tournament',(string)$event->id,$event->title(),'tournament',['bio'=>'Published notices from this tournament edition.','tournament_id'=>$event->id]);
    }

    public function organizerNotice(ClubTournament $event): void {
        if(!$this->ready()||!$event->definition_id)return;
        $o=DB::table('competition_definitions as d')->join('competition_organizers as o','o.id','=','d.organizer_id')->where('d.id',$event->definition_id)->whereNull('o.user_id')->first(['o.*']);
        if(!$o)return; // Human-owned organizations speak through their authorized users.
        $id=$this->save('organizer',(string)$o->id,$o->name,'organizer',['bio'=>'Tournament organizer in the Hexatrick circuit.'],autonomous:true);
        DB::table('world_news_posts')->insertOrIgnore(['event_key'=>'organizer-notice:'.$event->id.':'.$event->status,'wire_account_id'=>$id,'kind'=>'tournament',
            'headline'=>mb_substr($o->name.': '.$event->title(),0,200),'body'=>'The published record for '.$event->title().' is available with its entry requirements, schedule and regulations. '.($event->registration_closes_at?'Entry deadline: '.$event->registration_closes_at->timezone('Asia/Manila')->format('j M Y, g:i A').' Manila.':''),
            'tournament_id'=>$event->id,'facts'=>json_encode(['provenance'=>'published_schedule','status'=>$event->status]),'published_at'=>now()]);
    }

    public function player(OwnedPlayerCard $player): int {
        $templates=$this->templates[$player->catalog_id]??=collect(OnlineCatalog::find($player->catalog_id)?->payload['cards']??[])->keyBy('id')->all();
        $template=$templates[$player->definition_id]??[];
        $club=OnlineClub::where('user_id',$player->user_id)->first(['id','name']);
        return $this->save('player',$player->id,$player->persona_name??$template['name']??'Player','player',[
            'bio'=>'Arena player · '.($template['preferredRole']??$template['role']??'Role unlisted'),
            'primary_personality'=>$template['primaryPersonality']??$template['personality']??'Not recorded',
            'secondary_personality'=>$template['secondaryPersonality']??null,'player_id'=>$player->id,
            'preferred_role'=>$template['preferredRole']??$template['role']??null,
            'club_id'=>$club?->id,'club_name'=>$club?->name,
            'interests'=>$template['signatureChampions']??[],
        ],autonomous:!$player->retired_at);
    }

    public function sync(?float $deadline=null): void {
        if(!$this->ready())return;
        $this->game();
        // First admission is bounded and resumable; subsequent ticks only add missing identities.
        foreach(DB::table('competition_organizers as o')->whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_wire_accounts as a')->where('a.kind','organizer')->whereColumn('a.source_id',DB::raw('CAST(o.id AS VARCHAR)')))->orderBy('o.id')->limit(100)->get() as $o)
            $this->save('organizer',(string)$o->id,$o->name,'organizer',['bio'=>'Tournament organizer in the Hexatrick circuit.'],$o->user_id,$o->user_id===null);
        if($deadline!==null&&microtime(true)>=$deadline)return;
        foreach(DB::table('world_wire_accounts')->where('kind','organizer')->orderBy('updated_at')->orderBy('id')->limit(20)->get() as $account){if($deadline!==null&&microtime(true)>=$deadline)return;$this->refresh($account);}
        foreach(ClubTournament::whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_wire_accounts as a')->where('a.kind','tournament')->whereColumn('a.source_id',DB::raw('CAST(club_tournaments.id AS VARCHAR)')))->limit(100)->get() as $event)$this->tournament($event);
        foreach(OwnedPlayerCard::whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_wire_accounts as a')->where('a.kind','player')->whereColumn('a.source_id',DB::raw('CAST(owned_player_cards.id AS VARCHAR)')))->orderBy('owned_player_cards.id')->limit(100)->get() as $p){if($deadline!==null&&microtime(true)>=$deadline)return;$this->player($p);}
        foreach(DB::table('world_media_personalities as t')->whereIn('role',['analyst','streamer','caster','host','manager','referee','observer'])->whereNotExists(fn($q)=>$q->selectRaw('1')->from('world_wire_accounts as a')->where('a.kind','talent')->whereColumn('a.source_id',DB::raw('CAST(t.id AS VARCHAR)')))->orderBy('t.id')->limit(100)->get() as $t){
            if($deadline!==null&&microtime(true)>=$deadline)return;
            $profile=json_decode($t->profile??'{}',true)??[];
            if($t->role==='manager'&&!empty($profile['club_id'])){$policy=app(WorldManagerPolicy::class)->profile((int)$profile['club_id']);$profile['manager_style']=$policy['style'];$profile['management_traits']=$policy['traits'];}
            $autonomous=$t->role!=='manager'||(!empty($profile['club_id'])&&OnlineClub::whereKey($profile['club_id'])->where('is_bot',true)->exists());
            $this->save('talent',(string)$t->id,$t->name,$t->role,['bio'=>$t->bio,'specialty'=>$t->style,'voice'=>['measured','curious','expressive','dry wit','detail-minded'][hexdec(substr(hash('sha256',$t->slug),0,2))%5],...$profile],autonomous:$autonomous);
        }
    }

    public function refresh(object $account): ?object {
        if(in_array($account->kind,['career','talent'])&&app(WorldAgents::class)->ready()&&($professional=\App\Models\WorldAgent::where('wire_account_id',$account->id)->first())){
            $this->career($professional);return DB::table('world_wire_accounts')->find($account->id);
        }
        if($account->kind==='career'){
            $agent=\App\Models\WorldAgent::find($account->source_id);if(!$agent)return null;$this->career($agent);
        }
        if($account->kind==='player'){
            if(app(WorldAgents::class)->ready()&&($professional=\App\Models\WorldAgent::where('source_key','player:'.$account->source_id)->where('profession','<>','player')->first())){
                $this->career($professional);return DB::table('world_wire_accounts')->find($account->id);
            }
            $p=OwnedPlayerCard::find($account->source_id);if(!$p){DB::table('world_wire_accounts')->where('id',$account->id)->update(['autonomous'=>false,'updated_at'=>now()]);return null;}$this->player($p);
        }elseif($account->kind==='organizer'){
            $o=DB::table('competition_organizers')->find($account->source_id);if(!$o)return null;
            $this->save('organizer',(string)$o->id,$o->name,'organizer',['bio'=>'Tournament organizer in the Hexatrick circuit.'],$o->user_id,$o->user_id===null);
        }elseif($account->kind==='talent'&&$account->role==='manager'){
            $profile=json_decode($account->profile,true)??[];
            if(empty($profile['club_id'])||!OnlineClub::whereKey($profile['club_id'])->where('is_bot',true)->exists()){
                DB::table('world_wire_accounts')->where('id',$account->id)->update(['autonomous'=>false,'updated_at'=>now()]);return null;
            }
        }
        return DB::table('world_wire_accounts')->find($account->id);
    }
}
