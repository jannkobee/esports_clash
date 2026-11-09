<?php
namespace App\Services;

use App\Models\{ClubTournament,CompetitionDefinition,CompetitionGeography,NationalTeam,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CompetitionQualifiers
{
    /** Balanced bounded shards, avoiding a one-team final shard. No population array. */
    public function partition(int $population,int $limit=128): array
    {
        if($population<2)return [];
        $groups=(int)ceil($population/$limit);$base=intdiv($population,$groups);$extra=$population%$groups;
        return array_map(fn($i)=>$base+($i<$extra?1:0),range(0,$groups-1));
    }

    public function build(int $eventId,int $geography,int $limit=128): array
    {
        abort_if($limit<4||$limit>256,422,'Qualifier group size must be 4–256.');
        return DB::transaction(function()use($eventId,$geography,$limit){
            $main=ClubTournament::whereKey($eventId)->lockForUpdate()->firstOrFail();
            abort_if(!$main->definition_id||$main->status!=='registration'||DB::table('competition_invitations')->where('tournament_id',$eventId)->exists()||DB::table('club_tournament_entries')->where('tournament_id',$eventId)->exists(),409,'Publish qualification before invitations or entries begin.');
            $geo=CompetitionGeography::findOrFail($geography);$desc=[$geography];$level=[$geography];
            for($i=0;$i<4&&$level;$i++){$level=CompetitionGeography::whereIn('parent_id',$level)->pluck('id')->all();$desc=[...$desc,...$level];}
            $query=$main->participant_type==='club'?OnlineClub::whereNotNull('tag')->whereIn('geography_id',$desc):NationalTeam::whereIn('geography_id',$desc);
            $population=(clone $query)->count();$sizes=$this->partition($population,$limit);abort_unless($sizes,422,'At least two eligible teams are required.');
            $start=CarbonImmutable::parse($main->starts_at)->subDays(45);$end=CarbonImmutable::parse($main->registration_closes_at)->subDays(2);
            if($main->participant_type==='national'){
                $window=DB::table('competition_windows')->where('year',$main->year)->where('starts_at','>',now()->addDay())->where('ends_at','<',$end)->orderBy('starts_at')->first();
                abort_unless($window,409,'Publish a future protected qualifying window before the finals registration deadline.');$start=CarbonImmutable::parse($window->starts_at)->addHour();
            }
            abort_if($start->lte(now()->addDay()),409,'No future qualifier window remains. Publish a later finals edition instead of backdating matches.');
            $base=CompetitionDefinition::findOrFail($main->definition_id);
            $def=CompetitionDefinition::firstOrCreate(['slug'=>'qualifier-'.$base->id],[
                'organizer_id'=>$base->organizer_id,'name'=>$base->name.' Qualifier','category'=>$main->participant_type==='club'?'regional':'national_qualifier',
                'participant_type'=>$main->participant_type,'official'=>$base->official,'ranked'=>$base->ranked,'status'=>'approved',
                'rules'=>['capacity'=>$limit,'stages'=>[['format'=>'single_elimination','advance'=>1]]],'schedule'=>[]]);
            $cursor=0;$editions=[];
            foreach($sizes as $index=>$size){
                $rules=['capacity'=>$size,'minimum'=>$size,'geographies'=>[$geography],'stages'=>[['format'=>'single_elimination','advance'=>1]],'qualification'=>[['key'=>'automatic','method'=>'automatic','slots'=>$size]],'circuit_points'=>$main->participant_type==='club'?['champion'=>100,'finalist'=>60]:[]];
                $edition=ClubTournament::firstOrCreate(['definition_id'=>$def->id,'year'=>$main->year,'scope'=>'event-'.$main->id.'-geo-'.$geography.'-shard-'.$index],[
                    'name'=>$geo->name.' '.$base->name.' Qualifier '.($index+1),'tier'=>null,'participant_type'=>$main->participant_type,'capacity'=>$size,'rules_version'=>$base->version,'regulations'=>$rules,'qualification'=>$rules['qualification'],
                    'ranked'=>$main->ranked,'accreditation'=>$main->accreditation,'registration_opens_at'=>now(),'registration_closes_at'=>$start->subDay(),'starts_at'=>$start,'ends_at'=>$end,
                    'semifinals_at'=>$start,'final_at'=>$end,'champion_prize'=>0,'runner_up_prize'=>0]);
                $teams=(clone $query)->where('id','>',$cursor)->orderBy('id')->limit($size)->get(['id','geography_id']);
                foreach($teams as $seed=>$team){$cursor=$team->id;DB::table('club_tournament_entries')->insertOrIgnore([
                    'tournament_id'=>$edition->id,$main->participant_type==='club'?'club_id':'national_team_id'=>$team->id,'seed'=>$seed+1,'status'=>'accepted',
                    'source'=>json_encode(['method'=>'automatic','geography'=>$geography,'shard'=>$index]),'geography_path'=>json_encode(CompetitionGeography::find($team->geography_id)->path())]);}
                $editions[]=$edition->id;
            }
            // Qualification is based on real results; missing champions do not turn into fabricated invitations.
            $paths=$main->qualification??[];$key='geo-'.$geography;
            $existing=array_search($key,array_column($paths,'key'),true);
            $slots=min(count($editions),max(1,(int)floor($main->capacity/2)));
            if($existing===false){
                $donor=null;foreach($paths as $i=>$path)if($path['method']==='results'&&$path['slots']>=$slots){$donor=$i;break;}
                abort_if($donor===null,422,'Reserve enough results-based final slots before creating this qualifier.');
                $paths[$donor]['slots']-=$slots;$paths=array_values(array_filter($paths,fn($p)=>$p['slots']>0));
                $paths[]=['key'=>$key,'method'=>'results','slots'=>$slots,'editions'=>$editions,'geography_id'=>$geography];
            }
            $main->update(['qualification'=>$paths]);return $editions;
        },3);
    }
}
