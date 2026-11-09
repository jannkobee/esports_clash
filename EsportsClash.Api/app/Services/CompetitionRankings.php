<?php
namespace App\Services;

use App\Models\{ClubTournament, CompetitionGeography, NationalTeam, OnlineClub};
use Illuminate\Support\Facades\DB;
use Carbon\CarbonImmutable;

class CompetitionRankings
{
    public function requestSnapshot(string $system,string $purpose):?int
    {
        $row=DB::table('competition_ranking_snapshots')->where('purpose',$purpose)->whereNotNull('completed_at')->first();
        if($row)return $row->id;
        \App\Jobs\BuildCompetitionRankingSnapshot::dispatch($system,$purpose);
        return null;
    }

    public function apply(ClubTournament $event,object $receipt): void
    {
        if(!$event->ranked || !in_array($event->accreditation,['official','verified_ranked','premier'],true))return;
        $type=$event->participant_type;$system=$type==='club'?'HGR':'HNR';
        $ids=DB::table('club_tournament_entries')->whereIn('id',[$receipt->winner_entry_id,$receipt->loser_entry_id])->get()->keyBy('id');
        $winner=$ids[$receipt->winner_entry_id]->{$type==='club'?'club_id':'national_team_id'};
        $loser=$ids[$receipt->loser_entry_id]->{$type==='club'?'club_id':'national_team_id'};
        foreach([$winner,$loser] as $id) {
            $entity=$type==='club'?OnlineClub::findOrFail($id):NationalTeam::findOrFail($id);
            $geo=$entity->geography_id?CompetitionGeography::find($entity->geography_id):null;
            DB::table('competition_ratings')->insertOrIgnore(['system'=>$system,'participant_id'=>$id,'geography_id'=>$entity->geography_id,'geography_path'=>json_encode($geo?->path()??[])]);
        }
        $ratings=DB::table('competition_ratings')->where('system',$system)->whereIn('participant_id',[$winner,$loser])->orderBy('participant_id')->lockForUpdate()->get()->keyBy('participant_id');
        if(DB::table('competition_rating_events')->where('result_id',$receipt->id)->exists())return;
        $settings=$event->regulations['ranking']??app(CompetitionCalendar::class)->settings();
        $repeats=DB::table('competition_rating_events')->where('system',$system)->where('participant_id',$winner)->where('opponent_id',$loser)
            ->where('created_at','>=',CarbonImmutable::parse($receipt->verified_at)->startOfDay())->count();
        // Keep an explicit no-op history receipt when an opponent cap excludes a result.
        $before=[];
        foreach([$winner,$loser] as $id){$r=(array)$ratings[$id];$days=$r['last_played_at']?CarbonImmutable::parse($r['last_played_at'])->diffInDays(CarbonImmutable::parse($receipt->verified_at)):0;
            $r['deviation']=min(350,sqrt($r['deviation']**2+($r['volatility']*173.7178)**2*($days/7)));
            $r['achievement']*=pow(0.5,$days/$settings['achievement_half_life_days']);$before[$id]=$r;}
        foreach([[$winner,$loser,1],[$loser,$winner,0]] as [$id,$op,$win]) {
            $r=$before[$id];$after=$r;
            if($repeats<$settings['repeat_opponent_daily_limit']) {
                $after=array_replace($r,app(GlickoRating::class)->update($r,[$before[$op]+['result'=>$win]]));
                $field=max(0.5,min(1.5,$before[$op]['rating']/1500));
                $after['achievement']=min(1000,$r['achievement']+($win?20:3)*$field);
                $after['games']=$r['games']+1;$after['last_played_at']=$receipt->verified_at;
                $skill=1000/(1+exp(-(($after['rating']-2*$after['deviation'])-1500)/350));
                $after['score']=$settings['skill_weight']*$skill+$settings['achievement_weight']*$after['achievement'];
                DB::table('competition_ratings')->where('id',$r['id'])->update(array_intersect_key($after,array_flip(['rating','deviation','volatility','achievement','games','score','last_played_at'])));
            }
            DB::table('competition_rating_events')->insert(['result_id'=>$receipt->id,'system'=>$system,'participant_id'=>$id,'opponent_id'=>$op,'before'=>json_encode($r),'after'=>json_encode($after),'created_at'=>$receipt->verified_at]);
        }
        if($system==='HGR')\App\Jobs\RecordManagerCareers::dispatch((int)$receipt->id)->afterCommit();
    }

    public function snapshot(string $system,string $purpose,?CarbonImmutable $cutoff=null): int
    {
        return DB::transaction(function()use($system,$purpose,$cutoff){
            // A snapshot is frozen under one transaction; edition-sized candidate selection uses indexed score order.
            DB::table('competition_ranking_snapshots')->insertOrIgnore(['system'=>$system,'purpose'=>$purpose,'rules'=>json_encode(app(CompetitionCalendar::class)->settings()),'frozen_at'=>$cutoff??now()]);
            $s=DB::table('competition_ranking_snapshots')->where('purpose',$purpose)->lockForUpdate()->first();
            if($s->completed_at)return $s->id;
            // One database-side point-in-time materialization: constant PHP memory, no per-club requests.
            if($cutoff){
                $pg=DB::getDriverName()==='pgsql';
                $score=$pg?'CAST("after"->>\'score\' AS DOUBLE PRECISION)':"CAST(json_extract(\"after\", '$.score') AS REAL)";
                $path=$pg?'COALESCE(CAST("after"->>\'geography_path\' AS JSON), \'[]\'::json)':"COALESCE(json_extract(\"after\", '$.geography_path'), '[]')";
                $latest=DB::table('competition_rating_events')->where('system',$system)->where('created_at','<=',$cutoff)->selectRaw("participant_id, $score as score, $path as geography_path, ROW_NUMBER() OVER (PARTITION BY participant_id ORDER BY created_at DESC, id DESC) as latest");
                $source=DB::query()->fromSub($latest,'historical')->where('latest',1);
            }else $source=DB::table('competition_ratings')->where('system',$system);
            DB::table('competition_ranking_snapshot_rows')->insertUsing(['snapshot_id','participant_id','position','score','geography_path'],
                $source->selectRaw('? as snapshot_id, participant_id, ROW_NUMBER() OVER (ORDER BY score DESC, participant_id) as position, score, COALESCE(geography_path, ?) as geography_path',[$s->id,'[]']));
            DB::table('competition_ranking_snapshots')->where('id',$s->id)->update(['completed_at'=>now()]);
            return $s->id;
        },3);
    }

    public function context(int $clubId):array
    {
        $r=DB::table('competition_ratings')->where('system','HGR')->where('participant_id',$clubId)->first();
        $total=DB::table('competition_ratings')->where('system','HGR')->count();
        if(!$r)return ['position'=>null,'population'=>$total,'games'=>0,'placement_remaining'=>10,'delta'=>null,'last_played_at'=>null];
        $above=DB::table('competition_ratings')->where('system','HGR')->where(fn($q)=>$q->where('score','>',$r->score)->orWhere(fn($q)=>$q->where('score',$r->score)->where('participant_id','<',$clubId)))->count();
        $last=DB::table('competition_rating_events')->where('system','HGR')->where('participant_id',$clubId)->orderByDesc('id')->first();
        return ['position'=>$above+1,'population'=>$total,'games'=>$r->games,'placement_remaining'=>max(0,10-$r->games),'delta'=>$last?round((json_decode($last->after,true)['score']??0)-(json_decode($last->before,true)['score']??0),2):null,'last_played_at'=>$r->last_played_at,'skill_low'=>round($r->rating-2*$r->deviation),'skill_high'=>round($r->rating+2*$r->deviation)];
    }

    public function leaderboard(string $system,?int $geography,int $page=1,array $filters=[]): array
    {
        $q=DB::table('competition_ratings as r');
        $table=$system==='HGR'?'online_clubs':'national_teams';
        $q->join($table.' as p','p.id','=','r.participant_id')->where('r.system',$system);
        if($filters['q']??null)$q->whereRaw('LOWER(p.name) LIKE ?',['%'.mb_strtolower($filters['q']).'%']);
        if($system==='HGR'&&($filters['tier']??null))$q->where('p.tier',$filters['tier']);
        if($filters['minimum_games']??null)$q->where('r.games','>=',$filters['minimum_games']);
        if($geography){$descendants=[$geography];$level=[$geography];for($i=0;$i<4 && $level;$i++){$level=DB::table('competition_geographies')->whereIn('parent_id',$level)->pluck('id')->all();$descendants=[...$descendants,...$level];}$q->whereIn('r.geography_id',$descendants);}
        return $q->select('r.*','p.name')->orderByDesc('r.score')->orderBy('r.participant_id')->paginate(50,['*'],'page',$page)->toArray();
    }
}
