<?php
namespace App\Services;
use App\Models\{ClubTournament,CompetitionDefinition,OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Bounded fictional organizer decisions, separate from the annual official program. */
class IndependentOrganizers
{
    public function tick():void{
        DB::transaction(function(){
            $now=CarbonImmutable::now('UTC');$cycle=$now->format('o-\WW');
            DB::table('world_organizer_cycles')->insertOrIgnore(['cycle'=>$cycle,'status'=>'reviewing','created_at'=>now()]);
            $turn=DB::table('world_organizer_cycles')->where('cycle',$cycle)->lockForUpdate()->first();if($turn->status!=='reviewing')return;
            $start=$now->addDays(3)->setTime(10,0);$end=$start->addDays(9)->setTime(23,59);
            if($end->year!==$now->year||DB::table('competition_windows')->where('starts_at','<',$end)->where('ends_at','>',$start)->exists()){
                DB::table('world_organizer_cycles')->where('id',$turn->id)->update(['status'=>'deferred','reason'=>'No legal event window this cycle.']);return;
            }
            $pools=OnlineClub::whereNotNull('tag')->whereNotNull('geography_id')->selectRaw('geography_id,tier,COUNT(*) as clubs')->groupBy('geography_id','tier')->havingRaw('COUNT(*) >= 4')->orderByDesc('clubs')->orderBy('geography_id')->orderBy('tier')->get();
            $pool=$pools->isEmpty()?null:$pools[$now->weekOfYear%$pools->count()];
            if(!$pool){DB::table('world_organizer_cycles')->where('id',$turn->id)->update(['status'=>'deferred','reason'=>'Insufficient eligible published clubs.']);return;}
            $names=[['harbor-stage','Harbor Stage','Harbor Open','Copperline'],['meridian-relay','Meridian Relay','Meridian Cup','Northglass'],['patchline-studio','Patchline Studio','Patchline Series','Beacon Works']];
            [$slug,$name,$title,$sponsor]=$names[$now->weekOfYear%3];
            $org=DB::table('competition_organizers')->where('slug',$slug)->first();
            if(!$org){$id=DB::table('competition_organizers')->insertGetId(['slug'=>$slug,'name'=>$name,'category'=>'independent','status'=>'verified','branding'=>json_encode(['fictional'=>true,'managed_by'=>'world-organizer']),'created_at'=>now(),'updated_at'=>now()]);}
            else{$id=$org->id;abort_unless(($org->user_id??null)===null,409,'A human-owned organizer cannot be automated.');}
            DB::table('world_sponsor_ledger')->insertOrIgnore(['organizer_id'=>$id,'reference'=>'sponsor:'.$id.':'.$now->format('Y-m'),'kind'=>'Monthly fictional sponsorship','amount'=>3000000,'created_at'=>now()]);
            if(DB::table('world_sponsor_ledger')->where('organizer_id',$id)->sum('amount')<300000){DB::table('world_organizer_cycles')->where('id',$turn->id)->update(['status'=>'deferred','reason'=>'Sponsorship budget exhausted.']);return;}
            $rules=['capacity'=>8,'minimum'=>4,'fixture_interval_hours'=>1,'geographies'=>[(int)$pool->geography_id],'tiers'=>[(int)$pool->tier],
                'stages'=>[['format'=>'single_elimination','advance'=>1]],'qualification'=>[['key'=>'open','method'=>'open','slots'=>8]],
                'tiebreakers'=>['seed'],'notice'=>'Fictional independent organizer. Funded prizes; open places can be filled by bots and replaced by human entrants before roster lock.'];
            $definition=CompetitionDefinition::firstOrCreate(['slug'=>$slug.'-t'.$pool->tier.'-g'.$pool->geography_id],[
                'version'=>2,'organizer_id'=>$id,'name'=>$title,'category'=>'independent','participant_type'=>'club','official'=>false,'ranked'=>false,'status'=>'approved','rules'=>$rules,'schedule'=>[],
                'sponsors'=>[['name'=>$sponsor,'fictional'=>true,'currency'=>'PHP']]]);
            if($definition->version<2){
                DB::table('competition_audits')->insert(['action'=>'independent.template_revised','subject'=>(string)$definition->id,'details'=>json_encode(['previous_rules'=>$definition->rules,'previous_version'=>$definition->version,'reason'=>'One-hour spacing between distinct clubs; club recovery remains 24 hours.']),'created_at'=>now()]);
                $definition->update(['rules'=>$rules,'version'=>2]);
            }
            $event=ClubTournament::create(['definition_id'=>$definition->id,'scope'=>'weekly-'.$cycle,'year'=>$now->year,'tier'=>null,'name'=>$title.' '.$now->format('M j').' · Tier '.$pool->tier,
                'participant_type'=>'club','capacity'=>8,'rules_version'=>$definition->version,'regulations'=>$rules,'qualification'=>$rules['qualification'],'sponsors'=>$definition->sponsors,
                'ranked'=>false,'accreditation'=>'unranked','registration_opens_at'=>$now,'registration_closes_at'=>$start->subDay(),
                'starts_at'=>$start,'ends_at'=>$end,'semifinals_at'=>$start,'final_at'=>$end,'champion_prize'=>200000,'runner_up_prize'=>100000]);
            DB::table('world_sponsor_ledger')->insert(['organizer_id'=>$id,'tournament_id'=>$event->id,'reference'=>'event:'.$event->id.':escrow','kind'=>'Published prize escrow','amount'=>-300000,'created_at'=>now()]);
            DB::table('world_organizer_cycles')->where('id',$turn->id)->update(['tournament_id'=>$event->id,'status'=>'announced']);
            DB::table('competition_audits')->insert(['action'=>'independent.announced','subject'=>(string)$event->id,'details'=>json_encode(['cycle'=>$cycle,'funded_prizes'=>300000,'currency'=>'PHP','fictional_organizer'=>true]),'created_at'=>now()]);
        },3);
    }
}
