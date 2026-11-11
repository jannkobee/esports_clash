<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\{Cache,DB};
class WorldRevisionController extends Controller {
 public function __invoke(){
  $data=Cache::remember('world.revision.v2',2,function(){
   $parts=['activity'=>DB::table('club_world_events')->max('id'),'news'=>[DB::table('world_news_posts')->max('id'),DB::table('world_news_posts')->max('hidden_at')],
    'comments'=>[DB::table('world_news_comments')->max('id'),DB::table('world_news_comments')->max('hidden_at')],
    'fixtures'=>[DB::table('club_fixtures')->max('id'),DB::table('online_matches')->max('started_at'),DB::table('online_matches')->max('completed_at'),DB::table('online_matches')->whereIn('status',['failed','interrupted'])->max('updated_at')],
    'players'=>DB::table('owned_player_cards')->max('updated_at'),'records'=>[DB::table('player_career_records')->max('id'),DB::table('manager_match_records')->max('id')],'awards'=>DB::table('annual_award_editions')->max('calculated_at'),
    'geography'=>DB::table('competition_geographies')->max('id'),'competitions'=>DB::table('club_tournaments')->max('updated_at'),'clubs'=>DB::table('online_clubs')->max('updated_at'),'market'=>DB::table('club_auctions')->max('updated_at'),
    'voices'=>DB::table('world_wire_accounts')->max('updated_at'),'arena_updates'=>DB::table('arena_update_bulletins')->max('id')];
   $revision=hash('sha256',json_encode($parts));Cache::put('world.public.cache-revision',$revision,60);return ['revision'=>$revision,'revisions'=>array_map(fn($value)=>hash('sha256',json_encode($value)),$parts),'topics'=>array_keys($parts)];
  });return response()->json(['data'=>$data])->header('Cache-Control','public, max-age=2');
 }
}
