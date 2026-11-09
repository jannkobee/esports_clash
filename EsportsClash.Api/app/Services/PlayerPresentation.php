<?php
namespace App\Services;
use App\Models\{ClubAuction,ClubFixture,ClubTradeProposal,OnlineCatalog,OnlineClub,OwnedPlayerCard,User};
use Illuminate\Support\Facades\DB;
class PlayerPresentation {
 public function desk(User $user):array {return OwnedPlayerCard::where('user_id',$user->id)->orderBy('persona_name')->get()->map(fn($p)=>$this->record($p))->all();}
 private function record(OwnedPlayerCard $p):array {return ['id'=>$p->id,'name'=>$p->persona_name,'presentation'=>$p->presentation??['bio'=>'','appearance'=>[]],'name_available_at'=>$p->name_customized_at?->addDays(30)->toIso8601String(),'profile_available_at'=>$p->profile_customized_at?->addDays(7)->toIso8601String(),'protected_alias'=>$p->original_identity!==null];}
 public function save(User $user,string $id,array $data):array {
  app(SupporterMembership::class)->requireFeature($user,'player_identity');
  return DB::transaction(function()use($user,$id,$data){
   $catalog=OnlineCatalog::where('active',true)->lockForUpdate()->firstOrFail();$club=OnlineClub::where('user_id',$user->id)->lockForUpdate()->firstOrFail();$p=OwnedPlayerCard::where('user_id',$user->id)->whereKey($id)->lockForUpdate()->firstOrFail();
   abort_if(ClubFixture::awaitingSnapshot($club->id),409,'A fixture is locking its player identities. Try again shortly.');
   abort_if(\App\Models\NormalQueueTicket::where('user_id',$user->id)->where('status','queued')->exists()||\App\Models\ScrimmageQueueTicket::where('user_id',$user->id)->where('status','queued')->exists(),409,'Leave the match queue before changing player presentation.');
   abort_if(ClubAuction::where('card_id',$id)->where('status','open')->exists(),409,'A player listed for auction cannot be reidentified until that auction resolves.');
   $traded=ClubTradeProposal::where('status','pending')->where('expires_at','>',now())->where(fn($q)=>$q->whereJsonContains('offered_player_ids',$id)->orWhereJsonContains('requested_player_ids',$id))->exists();abort_if($traded,409,'Resolve the pending player trade before editing this identity.');
   $old=['name'=>$p->persona_name,'presentation'=>$p->presentation??['bio'=>'','appearance'=>[]]];$name=array_key_exists('name',$data)?trim($data['name']):$p->persona_name;$presentation=['bio'=>$data['bio']??($p->presentation['bio']??''),'appearance'=>$data['appearance']??($p->presentation['appearance']??[])];
   $renamed=$name!==$p->persona_name;$styled=$presentation!=($p->presentation??['bio'=>'','appearance'=>[]]);
   if($renamed){
    abort_if($p->original_identity!==null,409,'This protected historical alias cannot be renamed.');abort_if($p->name_customized_at&&$p->name_customized_at->addDays(30)->isFuture(),409,'This player is still in the 30-day IGN cooldown.');
    $reserved=collect([...($catalog->payload['cards']??[]),...($catalog->payload['coaches']??[])])->pluck('name')->map(fn($n)=>strtolower($n));abort_if($reserved->contains(strtolower($name)),422,'Choose an original IGN instead of a protected catalog alias.');
    $peers=OwnedPlayerCard::withoutGlobalScopes()->whereRaw('LOWER(persona_name) = ?',[strtolower($name)])->where('id','!=',$id);abort_if((clone $peers)->count()>=3,422,'Three players already use that IGN. Choose another combination.');abort_if((clone $peers)->where('user_id',$user->id)->exists(),422,'Another player in your club already uses that IGN.');
   }
   if($styled)abort_if($p->profile_customized_at&&$p->profile_customized_at->addDays(7)->isFuture(),409,'This player is still in the seven-day profile and portrait cooldown.');
   if(!$renamed&&!$styled)return $this->record($p);
   $p->update(['persona_name'=>$name,'presentation'=>$presentation,...($renamed?['name_customized_at'=>now()]:[]),...($styled?['profile_customized_at'=>now()]:[])]);
   $club->increment('revision');
   DB::table('player_presentation_revisions')->insert(['player_id'=>$id,'user_id'=>$user->id,'previous'=>json_encode($old),'current'=>json_encode(['name'=>$name,'presentation'=>$presentation]),'created_at'=>now()]);
   return $this->record($p);
  },3);
 }
}
