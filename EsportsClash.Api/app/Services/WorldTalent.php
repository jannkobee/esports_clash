<?php
namespace App\Services;
use App\Models\ClubFixture;
use Illuminate\Support\Facades\DB;
class WorldTalent {
 public function populate():int {
  $first=['Mika','Eli','Tala','Ari','Ren','Kai','Sol','Noa','Dani','Lena','Cami','Jules','Rafi','Aya','Kira','Nico','Bea','Ira','Sora','Paz'];
  $last=['Varela','Santos','Navarro','Mori','Arden','Reyes','Vale','Cruz','Silva','Dela Vega','Rivera','Chen','Torres','Park','Solis','Bautista'];$count=0;
  $target=max(6,min(128,(int)ceil(\App\Models\OnlineClub::count()/20)));
  foreach(['caster','analyst','streamer','host','referee','observer'] as $role)for($i=0;$i<$target;$i++){
   $seed=hexdec(substr(hash('sha256','talent-v1:'.$role.':'.$i),0,7));$name=$first[$seed%count($first)].' '.$last[intdiv($seed,20)%count($last)];$slug=$role.'-'.strtolower(str_replace(' ','-',$name)).'-'.$i;
   $profile=['nationality'=>['PH','KR','JP','BR','FR','ZA'][$seed%6],'languages'=>['English'],'specialty'=>['macro analysis','play-by-play','player development','draft analysis','tournament storytelling','rules and competitive integrity'][$seed%6],'joined_at'=>now()->toIso8601String()];
   $count+=DB::table('world_media_personalities')->insertOrIgnore(['slug'=>$slug,'name'=>$name,'role'=>$role,'style'=>$profile['specialty'],'bio'=>$name.' works across the Hexatrick circuit as a '.$role.', with a focus on '.$profile['specialty'].'.','profile'=>json_encode($profile)]);
  }
  $managers=[];foreach(\App\Models\OnlineClub::where('is_bot',true)->with('user:id,name')->get(['id','user_id','name','identity']) as $club){$name=$club->user->name;if(preg_match('/bot/i',$name))$name=app(WorldClubIdentity::class)->make('manager:'.$club->id)['manager'];$managers[]=['slug'=>'manager-'.$club->id,'name'=>$name,'role'=>'manager','style'=>'Club management','bio'=>$name.' manages '.$club->name.'.','profile'=>json_encode(['club_id'=>$club->id,'nationality'=>$club->identity['country']??null])];}if($managers)$count+=DB::table('world_media_personalities')->insertOrIgnore($managers);
  return $count;
 }
 public function directory(string $search='',int $page=1,int $perPage=30):array {
  $q=DB::table('world_media_personalities')->orderBy('name')->orderBy('id');
  if($search!=='')$q->where(fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',['%'.mb_strtolower($search).'%'])->orWhereRaw('LOWER(role) LIKE ?',['%'.mb_strtolower($search).'%']));
  $total=(clone $q)->count();$items=$q->offset(($page-1)*$perPage)->limit($perPage)->get()->map(fn($t)=>$this->record($t));
  return ['items'=>$items,'meta'=>['page'=>$page,'per_page'=>$perPage,'total'=>$total,'last_page'=>max(1,(int)ceil($total/$perPage))]];
 }
 private function record(object $t):array {return ['id'=>$t->id,'name'=>$t->name,'role'=>$t->role,'style'=>$t->style,'bio'=>preg_replace('/^Fictional /','',$t->bio),'profile'=>json_decode($t->profile??'{}',true)];}
 public function article(string $id):array {
  $t=DB::table('world_media_personalities')->where('id',ctype_digit($id)?(int)$id:0)->first();abort_unless($t,404);
  $posts=DB::table('world_news_posts')->where('personality_id',$t->id)->whereNull('hidden_at')->orderByDesc('id')->limit(30)->get(['id','headline','body','published_at','tournament_id','match_id']);
  $appointments=DB::table('fixture_talent_assignments as a')->join('club_fixtures as f','f.id','=','a.fixture_id')->where('a.talent_id',$t->id)->orderByDesc('f.kickoff_at')->limit(30)->get(['f.id','f.competition','f.kickoff_at','f.tournament_id','a.role']);
  return $this->record($t)+['posts'=>$posts,'appointments'=>$appointments];
 }
 public function assign(ClubFixture $fixture):void {
  foreach(['referee','caster','observer'] as $role){
   $ids=DB::table('world_media_personalities')->where('role',$role)->orderBy('id')->pluck('id');if($ids->isEmpty())continue;
   foreach(range(0,$ids->count()-1) as $offset){$id=$ids[($fixture->id+$offset)%$ids->count()];
    $conflict=DB::table('fixture_talent_assignments as a')->join('club_fixtures as f','f.id','=','a.fixture_id')->where('a.talent_id',$id)->where('f.id','!=',$fixture->id)->whereBetween('f.kickoff_at',[$fixture->kickoff_at->subHours(2),$fixture->kickoff_at->addHours(2)])->exists();
    if($conflict)continue;
    DB::table('fixture_talent_assignments')->insertOrIgnore(['fixture_id'=>$fixture->id,'talent_id'=>$id,'role'=>$role,'assigned_at'=>now()]);break;
   }
  }
 }
}
