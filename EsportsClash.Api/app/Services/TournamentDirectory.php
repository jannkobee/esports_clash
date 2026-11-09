<?php
namespace App\Services;
use App\Models\ClubTournament;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/** One lifecycle projection for management and public tournament tables. */
class TournamentDirectory {
 public function query(array $filters=[]){
  $base=DB::table('club_tournaments');
  foreach(['year','tier'] as $field)if($filters[$field]??null)$base->where($field,$filters[$field]);
  if($filters['type']??null)$base->where('participant_type',$filters['type']);
  if($filters['q']??null)$base->whereRaw('LOWER(COALESCE(name, ?)) LIKE ?',['Manila Signal Open','%'.mb_strtolower(trim($filters['q'])).'%']);
  if(($filters['status']??null)==='launch_history')$base->where('provenance','launch_simulation');elseif($filters['status']??null)$base->where('status',$filters['status']);
  $start='COALESCE(starts_at,semifinals_at,registration_closes_at)';$end='COALESCE(ends_at,final_at)';$now=now('UTC');
  $phase="CASE WHEN status='completed' THEN 'finished' WHEN status='cancelled' THEN 'cancelled' WHEN status='review' OR ($end IS NOT NULL AND $end < ?) THEN 'review' WHEN $start > ? THEN 'upcoming' WHEN status='registration' AND registration_closes_at < ? THEN 'review' ELSE 'ongoing' END";
  $base->select('club_tournaments.*')->selectRaw("$start as effective_starts_at, $end as effective_ends_at, $phase as lifecycle",[$now,$now,$now]);
  return DB::query()->fromSub($base,'editions');
 }
 public function counts(array $filters=[]):array {
  return array_replace(array_fill_keys(['upcoming','ongoing','finished','review','cancelled'],0),$this->query($filters)->select('lifecycle')->selectRaw('COUNT(*) as total')->groupBy('lifecycle')->pluck('total','lifecycle')->map(fn($v)=>(int)$v)->all());
 }
 public function page(array $filters=[],int $perPage=30):LengthAwarePaginator {
  $query=$this->query($filters);if($filters['phase']??null)$query->where('lifecycle',$filters['phase']);
  match($filters['sort']??'lifecycle'){
   'starts_asc'=>$query->orderBy('effective_starts_at'),
   'starts_desc'=>$query->orderByDesc('effective_starts_at'),
   'ends_desc'=>$query->orderByDesc('effective_ends_at'),
   'name'=>$query->orderByRaw('LOWER(name) ASC'),
   'prize'=>$query->orderByRaw('(champion_prize + runner_up_prize) DESC'),
   default=>$query->orderByRaw("CASE lifecycle WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'finished' THEN 2 WHEN 'review' THEN 3 ELSE 4 END")->orderBy('effective_starts_at'),
  };
  $page=$query->orderBy('id')->paginate($perPage,['*'],'page',$filters['page']??1);
  $models=ClubTournament::hydrate($page->getCollection()->map(fn($r)=>(array)$r)->all());
  $models->each(fn($event)=>$event->mergeCasts(['effective_starts_at'=>'immutable_datetime','effective_ends_at'=>'immutable_datetime']));
  return $page->setCollection($models);
 }
}
