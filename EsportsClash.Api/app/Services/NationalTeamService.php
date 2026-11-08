<?php
namespace App\Services;

use App\Models\{ClubFixture, ClubTournament, CompetitionGeography, NationalTeam, OnlineCatalog, OwnedPlayerCard};
use Illuminate\Support\Facades\DB;
use Carbon\CarbonImmutable;

class NationalTeamService
{
    public function authorizeManager(int $team,int $user): void
    {
        abort_unless(DB::table('national_manager_terms')->where('national_team_id',$team)->where('user_id',$user)->where('status','appointed')
            ->where('starts_at','<=',now())->where('ends_at','>',now())->exists(),403,'An active national-manager appointment is required.');
    }

    public function eligiblePool(int $team,int $page=1)
    {
        $nation=NationalTeam::findOrFail($team);
        $profiles=app(WorldPlayerProfiles::class);$columns=['owned_player_cards.id','owned_player_cards.definition_id','owned_player_cards.catalog_id','owned_player_cards.training_xp','owned_player_cards.persona_name'];
        if($profiles->enabled())$columns=[...$columns,'owned_player_cards.world_profile','owned_player_cards.nationality_id'];
        $pool=OwnedPlayerCard::query()->join('player_national_eligibilities as e','e.player_id','=','owned_player_cards.id')
            ->leftJoin('player_international_commitments as c','c.player_id','=','owned_player_cards.id')
            ->where('e.geography_id',$nation->geography_id)->where(fn($q)=>$q->whereNull('c.national_team_id')->orWhere('c.national_team_id',$team))
            ->select($columns)
            ->orderBy('owned_player_cards.id')->paginate(50,['*'],'page',$page);
        $defs=collect(OnlineCatalog::where('active',true)->first()?->payload['cards']??[])->keyBy('id');
        foreach($pool->items() as $player){$template=$defs->get($player->definition_id);$d=$template?$profiles->definition($player,$template):[];$player->setAttribute('name',$d['name']??$player->persona_name);$player->setAttribute('role',$d['preferredRole']??$d['role']??null);$player->setAttribute('skills',array_intersect_key($d['stats']??[],array_flip(['lan','tf','iq','ldr','clu','sta','flx'])));$player->setAttribute('nationality',$d['nationality']??null);$player->makeHidden(['world_profile','persona_name','nationality_id']);}
        return $pool;
    }

    public function saveSquad(int $team,int $eventId,array $players,array $lineup,?string $captain=null): void
    {
        DB::transaction(function()use($team,$eventId,$players,$lineup,$captain){
            $e=ClubTournament::whereKey($eventId)->lockForUpdate()->firstOrFail();$national=NationalTeam::whereKey($team)->lockForUpdate()->firstOrFail();
            abort_if($e->participant_type!=='national' || $e->registration_closes_at->lte(now()),409,'National squad registration is locked.');
            abort_unless(DB::table('club_tournament_entries')->where('tournament_id',$eventId)->where('national_team_id',$team)->where('status','accepted')->exists(),422,'The nation must enter this competition first.');
            abort_if(count($players)<5 || count($players)>($e->regulations['squad_size']??10) || count(array_unique($players))!==count($players),422,'Select five players up to the published squad limit.');
            if($captain)abort_unless(in_array($captain,$players,true),422,'The captain must be registered.');
            $locked=OwnedPlayerCard::whereKey($players)->orderBy('id')->lockForUpdate()->get();
            abort_unless($locked->count()===count($players),422,'Unknown player instance.');
            foreach($players as $player){
                abort_unless(DB::table('player_national_eligibilities')->where('player_id',$player)->where('geography_id',$national->geography_id)->exists(),422,'A player has no verified nationality eligibility.');
                $commit=DB::table('player_international_commitments')->where('player_id',$player)->first();
                abort_if($commit && $commit->national_team_id!==$team,422,'A player is already committed to another nation.');
            }
            $this->validateLineup($lineup,$players,OnlineCatalog::where('active',true)->firstOrFail());
            $squad=DB::table('national_squads')->where('national_team_id',$team)->where('tournament_id',$eventId)->first();
            abort_if($squad?->locked_at,409,'Squad is locked.');
            $values=['lineup'=>json_encode($lineup),'captain_id'=>$captain,'updated_at'=>now()];
            if($squad){$id=$squad->id;DB::table('national_squads')->where('id',$id)->update($values);DB::table('national_squad_players')->where('squad_id',$id)->delete();}
            else $id=DB::table('national_squads')->insertGetId($values+['national_team_id'=>$team,'tournament_id'=>$eventId,'created_at'=>now()]);
            DB::table('national_squad_players')->insert(array_map(fn($p)=>['squad_id'=>$id,'player_id'=>$p],$players));
        },3);
    }

    public function validateLineup(array $lineup,array $registered,OnlineCatalog $catalog): array
    {
        abort_unless(count($lineup)===5 && count(array_unique(array_column($lineup,'instance_id')))===5 && count(array_unique(array_column($lineup,'avatar_id')))===5,422,'Choose five distinct players and Avatars.');
        $definitions=collect($catalog->payload['cards'])->keyBy('id');$avatars=collect($catalog->payload['avatars'])->keyBy('id');$result=[];
        foreach($lineup as $slot){
            abort_unless(in_array($slot['instance_id'],$registered,true),422,'A selected player is outside the registered squad.');
            $owned=OwnedPlayerCard::whereKey($slot['instance_id'])->where('catalog_id',$catalog->id)->first();
            $card=$owned?$definitions->get($owned->definition_id):null;$avatar=$avatars->get($slot['avatar_id']);
            abort_unless($card && $avatar,422,'Player or Avatar is unavailable.');
            $roles=array_filter([...($card['playableRoles']??[]),$card['preferredRole']??null,$card['role']??null]);
            abort_unless(in_array($avatar['primaryRole'],$roles,true)||in_array($avatar['secondaryRole']??'',$roles,true),422,'An Avatar does not match this player’s roles.');
            $result[]=['instance_id'=>$owned->id,'card_id'=>$owned->definition_id,'avatar_id'=>$avatar['id']];
        }
        return $result;
    }

    public function lineup(int $team,int $eventId,OnlineCatalog $catalog): array
    {
        $squad=DB::table('national_squads')->where('national_team_id',$team)->where('tournament_id',$eventId)->lockForUpdate()->first();
        if(!$squad){
            // Bounded role search over verified owned players. No manufactured players or substitute ownership.
            $pool=$this->eligiblePool($team)->items();$defs=collect($catalog->payload['cards'])->keyBy('id');
            $slots=$catalog->payload['starter'];$chosen=[];$used=[];
            foreach($slots as $slot){$avatar=collect($catalog->payload['avatars'])->firstWhere('id',$slot['avatar_id']);
                foreach($pool as $player){if(isset($used[$player->id]) || $player->catalog_id!==$catalog->id)continue;$d=$defs->get($player->definition_id);if(!$d)continue;
                    $roles=array_filter([...($d['playableRoles']??[]),$d['preferredRole']??null,$d['role']??null]);
                    if(in_array($avatar['primaryRole'],$roles,true)||in_array($avatar['secondaryRole']??'',$roles,true)){$chosen[]=['instance_id'=>$player->id,'avatar_id'=>$slot['avatar_id']];$used[$player->id]=true;break;}}
            }
            abort_unless(count($chosen)===5,409,'This nation cannot field a legal verified squad; review is required.');
            $id=DB::table('national_squads')->insertGetId(['national_team_id'=>$team,'tournament_id'=>$eventId,'lineup'=>json_encode($chosen),'locked_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
            DB::table('national_squad_players')->insert(array_map(fn($p)=>['squad_id'=>$id,'player_id'=>$p],array_keys($used)));
            $squad=DB::table('national_squads')->find($id);
        }
        DB::table('national_squads')->where('id',$squad->id)->update(['locked_at'=>$squad->locked_at??now()]);
        $players=DB::table('national_squad_players')->where('squad_id',$squad->id)->pluck('player_id')->all();
        $lineup=$this->validateLineup(json_decode($squad->lineup,true),$players,$catalog);
        $geo=NationalTeam::findOrFail($team)->geography_id;
        foreach($lineup as $slot){
            abort_unless(DB::table('player_national_eligibilities')->where('player_id',$slot['instance_id'])->where('geography_id',$geo)->exists(),422,'Nationality verification is unavailable.');
            $commit=DB::table('player_international_commitments')->where('player_id',$slot['instance_id'])->first();
            abort_if($commit && $commit->national_team_id!==$team,422,'International allegiance prevents this call-up.');
        }
        return $lineup;
    }

    public function reserve(ClubFixture $fixture,array $lineup): void
    {
        $ids=array_column($lineup,'instance_id');sort($ids);
        abort_unless(count(array_unique($ids))===count($ids),409,'A player cannot represent both sides of the same fixture.');
        OwnedPlayerCard::whereKey($ids)->orderBy('id')->lockForUpdate()->get(['id']);
        $start=CarbonImmutable::parse($fixture->kickoff_at);$end=$start->addHours(app(CompetitionCalendar::class)->settings()['recovery_hours']);
        abort_if(DB::table('competition_player_reservations')->whereIn('player_id',$ids)->where('fixture_id','<>',$fixture->id)->where('starts_at','<',$end)->where('ends_at','>',$start)->exists(),409,'A called-up player has a conflicting match or recovery window.');
        foreach($ids as $id)DB::table('competition_player_reservations')->insertOrIgnore(['player_id'=>$id,'fixture_id'=>$fixture->id,'starts_at'=>$start,'ends_at'=>$end]);
    }

    public function recordAppearances(ClubFixture $fixture,object $receipt): void
    {
        $match=$fixture->match;
        foreach(['blue'=>$fixture->home_national_team_id,'red'=>$fixture->away_national_team_id] as $side=>$team){
            foreach($match->plan[$side] as $slot){
                OwnedPlayerCard::whereKey($slot['instance_id'])->lockForUpdate()->firstOrFail();
                DB::table('player_international_commitments')->insertOrIgnore(['player_id'=>$slot['instance_id'],'national_team_id'=>$team,'committed_at'=>$receipt->verified_at]);
                $commit=DB::table('player_international_commitments')->where('player_id',$slot['instance_id'])->first();
                abort_unless($commit->national_team_id===$team,409,'Conflicting international commitment requires review.');
                DB::table('international_appearances')->insertOrIgnore(['result_id'=>$receipt->id,'player_id'=>$slot['instance_id'],'national_team_id'=>$team,'won'=>$match->result['winner']===$side]);
            }
        }
    }
}
