<?php
namespace App\Services;
use App\Models\{ClubAuction,ClubFixture,ClubTournament,ClubTradeProposal,OnlineClub,OwnedPlayerCard};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class PlayerCareer {
    public function show(OwnedPlayerCard $player):array{
        $current=$player->retired_at?null:OnlineClub::where('user_id',$player->user_id)->first(['id','name','tag']);
        $transfers=ClubAuction::where('card_id',$player->id)->where('status','sold')->with(['seller:id,name,tag','bidder:id,name,tag'])->orderBy('updated_at')->limit(100)->get()->map(fn($a)=>[
            'id'=>'auction-'.$a->id,'date'=>$a->updated_at->toIso8601String(),'from'=>$a->seller,'to'=>$a->bidder,'fee'=>$a->bid,'currency'=>'PHP','method'=>'Auction']);
        $tradeTransfers=ClubTradeProposal::where('status','accepted')
            ->where(fn($q)=>$q->whereJsonContains('offered_player_ids',$player->id)->orWhereJsonContains('requested_player_ids',$player->id))
            ->with(['proposer:id,name,tag','recipient:id,name,tag'])->orderByDesc('resolved_at')->limit(100)->get()
            ->map(function($trade)use($player){
                $offered=in_array($player->id,$trade->offered_player_ids,true);
                return ['id'=>'trade-'.$trade->id.'-'.$player->id,'date'=>$trade->resolved_at?->toIso8601String(),
                    'from'=>$offered?$trade->proposer:$trade->recipient,'to'=>$offered?$trade->recipient:$trade->proposer,
                    'fee'=>null,'currency'=>'PHP','method'=>'Player trade'];
            });
        $transfers=$transfers->concat($tradeTransfers)->sortByDesc('date')->take(100)->values();
        $development=DB::table('player_progress_snapshots')->where('player_id',$player->id)->orderByDesc('observed_at')->limit(52)->get()->map(fn($s)=>['observed_at'=>CarbonImmutable::parse($s->observed_at)->toIso8601String(),'training_xp'=>$s->training_xp,'stats'=>json_decode($s->stats,true),'overall'=>$s->overall]);
        $ratings=DB::table('club_player_match_ratings')->where('card_id',$player->id)->orderByDesc('created_at')->orderByDesc('id')->limit(100)->get()
            ->map(fn($row)=>['match_id'=>$row->match_id,'date'=>CarbonImmutable::parse($row->created_at)->toIso8601String(),
                'competition'=>$row->competition,'club'=>['id'=>$row->club_id,'name'=>$row->club_name],'won'=>(bool)$row->won,
                'rating'=>(float)$row->rating,'performance'=>json_decode($row->performance,true)]);
        $honors=[];$appearances=[];
        $fixtures=ClubFixture::whereIn('match_id',DB::table('club_training_sessions')->where('card_id',$player->id)->select('match_id'))->whereHas('match',fn($q)=>$q->where('status','completed'))->with('match')->orderByDesc('kickoff_at')->limit(100)->get();
        foreach($fixtures as $f){$m=$f->match;foreach(['blue','red'] as $side){if(!in_array($player->id,array_column($m->plan[$side]??[],'instance_id'),true))continue;
            $clubId=$side==='blue'?$f->home_club_id:$f->away_club_id;
            $appearances[]=['fixture_id'=>$f->id,'match_id'=>$m->canSpectate()?$m->id:null,'date'=>$f->kickoff_at,'competition'=>$f->competition,'club'=>['id'=>$clubId,'name'=>$m->plan['clubs'][$side]],'won'=>$m->result['winner']===$side];
            if($f->tournament_id && $m->result['winner']===$side){$e=ClubTournament::find($f->tournament_id);
                if($e?->status==='completed' && !CommunityCups::isFun($e) && $e->provenance==='verified' && $e->champion_id===$clubId && !isset($honors[$e->id])){
                    $last=ClubFixture::where('tournament_id',$e->id)->orderByDesc('kickoff_at')->first();
                    if($last?->id===$f->id)$honors[$e->id]=['tournament_id'=>$e->id,'name'=>$e->title(),'year'=>$e->year,'club_id'=>$clubId,'basis'=>'Played for the winner in the verified championship final'];
                }
            }
        }}
        return ['registered_at'=>$player->created_at?->toIso8601String(),'current_contract'=>$current,'retired_at'=>$player->retired_at,
            'transfers'=>$transfers,'development'=>$development,'appearances'=>$appearances,'match_ratings'=>$ratings,'form'=>app(PlayerForm::class)->summarize($ratings),'honors'=>array_values($honors),
            'note'=>'Auction dates and fees come from settled listings; direct trades show the completed player movement without assigning a fictional transfer fee. Match ratings use verified final Arena statistics on a 1–10 Hexatrick scale; they are not an official competition award. Form uses up to ten verified appearances within 56 days, with a 21-day recency half-life, appearance decay and two neutral prior appearances. No recent evidence is Unrated. Form does not alter combat attributes. Development observations begin when this record system was introduced. Honors require a verified winning-final appearance; current club membership alone does not award a title.'];
    }
}
