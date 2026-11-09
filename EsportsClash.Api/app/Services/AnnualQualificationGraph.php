<?php
namespace App\Services;
use App\Models\{ClubTournament,CompetitionGeography,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Resolve annual source definitions before any edition becomes visible to entrants. */
class AnnualQualificationGraph {
    public function compile(array $definitions,int $year):array{
        $geographies=CompetitionGeography::get(['id','parent_id'])->keyBy('id');$population=[];
        foreach(OnlineClub::where('tier',1)->whereNotNull('tag')->whereNotNull('geography_id')->selectRaw('geography_id,COUNT(*) as clubs')->groupBy('geography_id')->get() as $row){
            $id=$row->geography_id;$visited=[];
            while($id&&!isset($visited[$id])){$visited[$id]=true;$population[$id]=($population[$id]??0)+(int)$row->clubs;$id=$geographies[$id]->parent_id??null;}
        }
        $splits=['vanguard-cup'=>'dawn','summit-masters'=>'zenith','crown-championship'=>'dusk','nations-cup'=>null];
        foreach($definitions as &$definition){
            if(in_array($definition['category'],['regional_league','international_club'],true)&&$definition['participant_type']==='club'){$definition['rules']['tiers']=[1];$definition['rules']['hierarchy_version']=2;}
            if($definition['category']==='regional_league')$definition['rules']['qualification']=[['key'=>'regional-tier-one-ranking','method'=>'ranking','slots'=>$definition['rules']['capacity'],'geography_id'=>$definition['rules']['geographies'][0]??null]];
            if(!array_key_exists($definition['slug'],$splits))continue;
            $paths=$definition['rules']['qualification']??[];$extraRanking=0;
            foreach($paths as &$path){
                if(($path['method']??null)!=='results'||($path['key']??null)!=='regional-champions')continue;
                $source=[];$split=$splits[$definition['slug']];
                foreach($definitions as $candidate){
                    if($candidate['participant_type']!==$definition['participant_type'])continue;
                    $matches=$split?($candidate['category']==='regional_league'&&str_ends_with($candidate['slug'],'-'.$split)):($candidate['category']==='national_continental');
                    if(!$matches||empty($candidate['schedule']['end']))continue;
                    if(CarbonImmutable::parse($year.'-'.$candidate['schedule']['end'].' 23:59 UTC')->gte(CarbonImmutable::parse($year.'-'.$definition['schedule']['close'].' 10:00 UTC')))continue;
                    $geos=$candidate['rules']['geographies']??[];
                    // One published champion place per viable regional source. Never invent regional entrants.
                    if($geos&&array_sum(array_map(fn($id)=>$population[$id]??0,$geos))<($candidate['rules']['minimum']??2))continue;
                    $source[]=$candidate['id'];
                }
                sort($source);$source=array_slice($source,0,$path['slots']);$places=count($source);
                $extraRanking+=$path['slots']-$places;$path['slots']=$places;$path['source_definitions']=$source;$path['fallback_method']='ranking';
            }unset($path);
            $paths=array_values(array_filter($paths,fn($p)=>$p['slots']>0));
            if($extraRanking){$found=false;foreach($paths as &$p)if($p['method']==='ranking'){$p['slots']+=$extraRanking;$found=true;break;}unset($p);
                if(!$found)$paths[]=['key'=>'annual-ranking','method'=>'ranking','slots'=>$extraRanking];
            }
            $definition['rules']['qualification']=$paths;
            $definition['rules']['qualification_graph_version']=1;
            $definition['rules']['qualification_policy']='One champion place per eligible regional source, capped by the published results quota. Unallocated quota becomes ranked-snapshot places. A cancelled or unavailable source, or exhausted eligible champions after source completion, uses the declared ranking fallback. No synthetic results.';
        }unset($definition);
        return ['definitions'=>$definitions,'regional_population'=>$population,'qualification_graph_version'=>1];
    }

    public function publish(array $events):void{
        $map=[];foreach($events as $e)$map[$e->definition_id]=$e->id;
        foreach($events as $event){
            if($event->status!=='planning')continue;
            $rules=$event->regulations;$paths=$event->qualification??[];
            foreach($paths as &$path){
                if($path['method']!=='results')continue;
                if(isset($path['source_definitions'])){
                    $path['editions']=array_values(array_filter(array_map(fn($id)=>$map[$id]??null,$path['source_definitions'])));
                    // Partial-year recovery cannot recreate missed regional tournaments.
                    if(!$path['editions']&&($path['fallback_method']??null)==='ranking'){$path['method']='ranking';$path['source_unavailable']=true;}
                }
                abort_if($path['method']==='results'&&empty($path['editions']),409,'Bind results-based qualification sources before publishing registration.');
            }unset($path);
            $rules['qualification']=$paths;
            $event->update(['qualification'=>$paths,'regulations'=>$rules,'status'=>'registration']);
            DB::table('competition_audits')->insert(['action'=>'annual.qualification-published','subject'=>(string)$event->id,'details'=>json_encode(['paths'=>$paths,'policy'=>$rules['qualification_policy']??null]),'created_at'=>now()]);
        }
    }

    public function assertBound(ClubTournament $event,bool $atLock=false):void{
        foreach($event->qualification??[] as $path){
            if($path['method']!=='results')continue;
            $ids=array_values(array_unique($path['editions']??[]));abort_unless($ids,409,'This edition needs published qualification sources before entry.');
            $sources=ClubTournament::whereKey($ids)->get();
            abort_unless($sources->count()===count($ids)&&$sources->every(fn($s)=>$s->id!==$event->id&&$s->year===$event->year&&$s->participant_type===$event->participant_type&&$s->provenance==='verified'&&($s->ends_at??$s->final_at)->lt($event->registration_closes_at)),409,'Qualification sources must be verified editions in the same year, ending before the target registration deadline.');
            if($atLock)abort_unless($sources->every(fn($s)=>in_array($s->status,['completed','cancelled'],true)),409,'A qualification source is unresolved; the field requires organizer review.');
        }
    }
}
