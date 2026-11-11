<?php
namespace App\Services;
use App\Models\{ClubAuction,OnlineCatalog,OnlineClub};
use Illuminate\Support\Facades\DB;

class AuctionDirectory {
 public function page(OnlineClub $club,OnlineCatalog $catalog,array $filters):array {
  $cards=collect($catalog->payload['cards'])->keyBy('id');
  $q=ClubAuction::query()->join('owned_player_cards as p','p.id','=','club_auctions.card_id')->whereNull('p.retired_at')->where('p.catalog_id',$catalog->id)->where('club_auctions.status','open')->where('club_auctions.closes_at','>',now())->select('club_auctions.*');
  if($filters['q']??null){$term='%'.mb_strtolower($filters['q']).'%';$q->where(fn($q)=>$q->whereRaw('LOWER(p.persona_name) LIKE ?',[$term])->orWhereHas('seller',fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',[$term])->orWhereRaw('LOWER(tag) LIKE ?',[$term])));}
  if($filters['role']??null)$q->whereIn('p.definition_id',$cards->filter(fn($c)=>($c['preferredRole']??$c['role']??'')===$filters['role'])->pluck('id'));
  if($filters['personality']??null){if(in_array($filters['personality'],FpsIdentityProfiles::PERSONALITIES,true)&&\Illuminate\Support\Facades\Schema::hasTable('fps_player_identities'))$q->whereIn('p.id',DB::table('fps_player_identities')->where('personality_id',$filters['personality'])->select('player_id'));else $q->whereIn('p.definition_id',$cards->filter(fn($c)=>in_array($filters['personality'],[$c['primaryPersonality']??null,$c['secondaryPersonality']??null],true))->pluck('id'));}
  if($filters['nationality']??null)$q->whereIn('p.nationality_id',DB::table('competition_geographies')->where('kind','country')->where('code',$filters['nationality'])->select('id'));
  if(($filters['view']??'all')==='mine')$q->where('club_auctions.seller_id',$club->id);
  if(($filters['view']??'all')==='leading')$q->where('club_auctions.bidder_id',$club->id);
  $overall=$this->overallExpression();$band=(int)($filters['minimum']??0);
  if($band>0){$threshold=[1=>1,2=>20,3=>30,4=>40,5=>50,6=>60,7=>70,8=>80,9=>88,10=>95][$band];$q->whereRaw("$overall >= ?",[$threshold]);}
  match($filters['sort']??'closing'){'price'=>$q->orderByRaw('COALESCE(club_auctions.bid,club_auctions.opening_bid) ASC'),'skill'=>$q->orderByRaw("$overall DESC"),'name'=>$q->orderByRaw('LOWER(p.persona_name) ASC'),default=>$q->orderBy('club_auctions.closes_at')};
  $page=$q->with(['card','seller:id,name,tag,is_bot','bidder:id,name,tag,is_bot'])->orderBy('club_auctions.id')->paginate($filters['per_page']??20,['*'],'page',$filters['page']??1);
  $items=$page->getCollection()->map(function($a)use($cards,$club){$p=app(WorldPlayerProfiles::class)->definition($a->card,$cards[$a->card->definition_id]);return ['id'=>$a->id,'player'=>$a->card->persona_name,'player_id'=>$a->card_id,'seller'=>$a->seller->name,'seller_id'=>$a->seller_id,'seller_tag'=>$a->seller->tag,'seller_is_bot'=>$a->seller->is_bot,'bidder'=>$a->bidder?->only(['id','name','tag','is_bot']),'your_listing'=>$a->seller_id===$club->id,'leading'=>$a->bidder_id===$club->id,'bid'=>$a->bid,'minimum'=>$a->bid===null?$a->opening_bid:$a->bid+ClubMarketService::BID_INCREMENT,'closes_at'=>$a->closes_at,'overall'=>$p['ovr'],'role'=>$p['preferredRole']??$p['role']??null,'nationality'=>$p['nationality']??null,'age'=>$p['age']??null,'wage'=>$p['wage']??null,'stats'=>$p['stats']??[],'presentation'=>$p['presentation']??null,'fpsIdentity'=>$p['fpsIdentity']??null,'primaryPersonality'=>$p['primaryPersonality']??null,'secondaryPersonality'=>$p['secondaryPersonality']??null];});
  return ['items'=>$items,'meta'=>['total'=>$page->total(),'page'=>$page->currentPage(),'per_page'=>$page->perPage(),'last_page'=>$page->lastPage()]];
 }
 private function overallExpression():string {
  $pg=DB::getDriverName()==='pgsql';$min=$pg?'LEAST':'MIN';$max=$pg?'GREATEST':'MAX';
  $json=function(string $path)use($pg):string {
   if(!$pg)return "CAST(json_extract(p.world_profile, '$.$path') AS REAL)";
   $segments=explode('.',$path);$expression='p.world_profile';
   foreach($segments as $i=>$segment)$expression.=($i===count($segments)-1?'->>':'->')."'$segment'";
   return "CAST($expression AS DOUBLE PRECISION)";
  };
  $step=(int)config('world_players.training_xp_per_step');$growth="FLOOR(SQRT($max(0, p.training_xp-COALESCE(".$json('training_baseline').",0))/$step.0))";$parts=[];
  foreach(WorldPlayerProfiles::ATTRIBUTES as $key)$parts[]="$min(COALESCE(".$json('potential').",99),$max(1,COALESCE(".$json('stats.'.$key).",18))+$growth)";
  return 'ROUND(('.implode('+',$parts).')/7.0)';
 }
}
