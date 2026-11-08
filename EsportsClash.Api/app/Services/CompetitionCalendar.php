<?php
namespace App\Services;

use App\Models\{ClubTournament, CompetitionDefinition};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CompetitionCalendar
{
    public function settings(): array
    {
        return array_replace(config('competitions'), json_decode(DB::table('competition_settings')->where('id',1)->value('settings') ?? '{}', true));
    }

    public function playOpens(int $year): CarbonImmutable
    {
        $jan=CarbonImmutable::create($year,1,1,0,0,0,'UTC');
        return $jan->addDays((8-$jan->dayOfWeekIso)%7+14)->setTime(10,0);
    }

    public function year(): int { return now('UTC')->year; }

    public function date(int $year, string $date): CarbonImmutable
    {
        $result = CarbonImmutable::createFromFormat('!Y-m-d H:i', "$year-$date", 'UTC');
        abort_unless($result && $result->format('Y-m-d H:i') === "$year-$date", 422, 'Invalid calendar date.');
        return $result;
    }

    public function initialize(int $year, bool $partial = false): array
    {
        $settings = $this->settings();
        abort_if($year < $settings['inaugural_year'] || $year > $this->year(), 422, 'Competitive editions may only start in their actual calendar year, from the inaugural year onward.');
        // Freeze the approved annual program once; later organizer edits cannot rewrite it.
        $record=DB::transaction(function()use($year,$settings){
            DB::table('competition_year_records')->insertOrIgnore(['year'=>$year]);
            $record=DB::table('competition_year_records')->where('year',$year)->lockForUpdate()->first();
            if(!$record->calendar_plan){
                $opening=$this->playOpens($year);
                $plan=['opening'=>$opening->toIso8601String(),'windows'=>$settings['international_windows'],
                    ...app(AnnualQualificationGraph::class)->compile(CompetitionDefinition::where('official',true)->where('status','approved')->orderBy('id')->get()->toArray(),$year)];
                $json=json_encode($plan,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
                DB::table('competition_year_records')->where('year',$year)->update(['calendar_plan'=>$json,'calendar_hash'=>hash('sha256',$json),'published_at'=>now(),'play_opens_at'=>$opening]);
                $record=DB::table('competition_year_records')->where('year',$year)->first();
            }
            return $record;
        },3);
        return DB::transaction(function()use($record,$year,$partial,$settings){
        DB::table('competition_year_records')->where('year',$year)->lockForUpdate()->firstOrFail();
        $program=json_decode($record->calendar_plan,true);$ids=[];$events=[];
        foreach ($program['definitions'] as $definition) {
            $s=$definition['schedule'];
            if(!isset($s['start'],$s['end'],$s['close']))continue;
            $opens=$this->date($year,($s['open']??'01-01').' 00:00');
            $start=$s['start']==='season-opening'?CarbonImmutable::parse($program['opening']):$this->date($year,$s['start'].' 10:00');
            $close=$s['close']==='season-lock'?$start->subDays(2):$this->date($year,$s['close'].' 10:00');
            $end=$this->date($year,$s['end'].' 23:59');
            if($close->isPast()||$start->isPast())continue;
            if(CarbonImmutable::parse($record->published_at)->dayOfYear>1&&!$partial)continue;
            $rules=$definition['rules'];
            $event=ClubTournament::firstOrCreate(['definition_id'=>$definition['id'],'year'=>$year,'scope'=>'global'],[
                'status'=>'planning','name'=>$definition['name'].' '.$year,'tier'=>null,'participant_type'=>$definition['participant_type'],
                'capacity'=>$rules['capacity'],'rules_version'=>$definition['version'],'regulations'=>$rules,'qualification'=>$rules['qualification']??[],
                'sponsors'=>$definition['sponsors'],'ranked'=>$definition['ranked'],'accreditation'=>$definition['ranked']?'official':'unranked',
                'registration_opens_at'=>$opens,'registration_closes_at'=>$close,'starts_at'=>$start,'ends_at'=>$end,
                'semifinals_at'=>$start,'final_at'=>$end,'champion_prize'=>0,'runner_up_prize'=>0,
            ]);$ids[]=$event->id;$events[]=$event;
        }
        app(AnnualQualificationGraph::class)->publish($events);
        $settings['international_windows']=$program['windows'];
        foreach ($settings['international_windows'] as [$from,$to]) {
            DB::table('competition_windows')->insertOrIgnore(['year'=>$year,'name'=>"International $from",
                'starts_at'=>$this->date($year,$from.' 00:00'),'ends_at'=>$this->date($year,$to.' 23:59')]);
        }
        return $ids;
        },3);
    }

    public function isInternationalWindow(CarbonImmutable $start, CarbonImmutable $end): bool
    {
        return DB::table('competition_windows')->where('starts_at','<=',$start)->where('ends_at','>=',$end)->exists();
    }

    public function validateSlot(ClubTournament $event, CarbonImmutable $kickoff): void
    {
        $end=$kickoff->addHours($this->settings()['recovery_hours']);
        abort_if($kickoff->lte(now()->addMinutes(15)) || $kickoff->lt($event->starts_at) || $end->gt($event->ends_at)
            || $kickoff->year !== $event->year || $end->year !== $event->year,409,'No remaining legal slot in the published calendar.');
        $overlaps=DB::table('competition_windows')->where('starts_at','<',$end)->where('ends_at','>',$kickoff)->exists();
        abort_if($event->participant_type==='club' && $overlaps,409,'The proposed match overlaps a protected international window.');
        abort_if($event->participant_type==='national' && !$this->isInternationalWindow($kickoff,$end),409,'International matches require a protected window.');
    }

    public function installGeographies(): void
    {
        foreach(config('competitions.geographies') as [$code,$name,$kind,$parent,$timezone]){
            $geo=\App\Models\CompetitionGeography::firstOrCreate(['code'=>$code],['name'=>$name,'kind'=>$kind,'parent_id'=>$parent?\App\Models\CompetitionGeography::where('code',$parent)->value('id'):null,'timezone'=>$timezone]);
            if($kind==='country')\App\Models\NationalTeam::firstOrCreate(['geography_id'=>$geo->id],['name'=>$name,'flag'=>$code]);
        }
    }

    public function installDefaults(): void
    {
        $this->installGeographies();
        // Club geography follows the already-declared club identity; existing players' nationality is untouched.
        \App\Models\OnlineClub::whereNull('geography_id')->chunkById(200,function($clubs){foreach($clubs as $club){$code=$club->identity['country']??null;if($code)$club->update(['geography_id'=>\App\Models\CompetitionGeography::where('code',$code)->where('kind','country')->value('id')]);}});
        $organizer=DB::table('competition_organizers')->where('slug','hexatrick')->first();
        if (!$organizer) {
            $id=DB::table('competition_organizers')->insertGetId(['slug'=>'hexatrick','name'=>'Hexatrick Championship Circuit','category'=>'official','status'=>'verified','created_at'=>now(),'updated_at'=>now()]);
        } else $id=$organizer->id;
        foreach(\App\Models\CompetitionGeography::where('kind','region')->get() as $region){
            foreach([['dawn','season-opening','03-02','season-lock'],['zenith','04-01','06-10','03-25'],['dusk','07-20','10-01','07-12']] as [$split,$start,$end,$close]){
                $regional=CompetitionDefinition::firstOrCreate(['slug'=>'regional-'.strtolower($region->code).'-'.$split],[
                    'version'=>2,'organizer_id'=>$id,'name'=>$region->name.' '.ucfirst($split).' League','category'=>'regional_league',
                    'participant_type'=>'club','official'=>true,'ranked'=>true,'status'=>'approved',
                    'rules'=>['capacity'=>8,'minimum'=>4,'fallback_sizes'=>[4,8],'geographies'=>[$region->id],
                        'stages'=>[['format'=>'round_robin','advance'=>4],['format'=>'single_elimination','advance'=>1]],
                        'fixture_interval_hours'=>1,'round_interval_hours'=>$split==='dawn'?96:168,'qualification'=>[['key'=>'regional-entry','method'=>'open','slots'=>8]],
                        'circuit_points'=>['champion'=>300,'finalist'=>180]],
                    'schedule'=>['open'=>'01-01','start'=>$start,'end'=>$end,'close'=>$close],'sponsors'=>[],
                ]);
                if($regional->version===1 && ($regional->rules['fixture_interval_hours']??null)===48){
                    DB::table('competition_audits')->insert(['action'=>'annual.template_revised','subject'=>(string)$regional->id,'details'=>json_encode(['previous_rules'=>$regional->rules,'previous_version'=>1,'reason'=>'Separate match broadcast spacing from regional round cadence.']),'created_at'=>now()]);
                    $regional->update(['version'=>2,'rules'=>array_replace($regional->rules,['fixture_interval_hours'=>1,'round_interval_hours'=>$split==='dawn'?96:168])]);
                }
            }
        }
        foreach (config('competitions.events') as $slug=>$event) {
            $groups=$event['capacity']/4;
            $advance=$event['capacity']===48?32:($event['capacity']===24?16:$event['capacity']/2);
            $international=CompetitionDefinition::firstOrCreate(['slug'=>$slug],[
                'version'=>2,'organizer_id'=>$id,'name'=>$event['name'],'category'=>$slug==='nations-cup'?'nations_cup':'international_club',
                'participant_type'=>$event['type'],'official'=>true,'ranked'=>true,'status'=>'approved',
                'rules'=>['capacity'=>$event['capacity'],'minimum'=>8,'fallback_sizes'=>$event['type']==='national'?[8,16,32,48]:array_values(array_filter([8,16,24,32],fn($n)=>$n<=$event['capacity'])),'squad_size'=>config('competitions.national_squad_size'),
                    'stages'=>[['format'=>'groups','groups'=>(int)$groups,'advance'=>(int)$advance],['format'=>'single_elimination','advance'=>1]],
                    'tiebreakers'=>['wins','head_to_head','seed'],'circuit_points'=>$event['type']==='club'?['champion'=>1000,'finalist'=>600]:[],
                    'qualification'=>[['key'=>'regional-champions','method'=>'results','slots'=>(int)($event['capacity']/2)],
                        ['key'=>'ranking','method'=>'ranking','slots'=>(int)($event['capacity']/4)],
                        ['key'=>'last-chance','method'=>'open','slots'=>(int)($event['capacity']/4)]]],
                'schedule'=>['open'=>'01-01','close'=>$event['close'],'start'=>$event['start'],'end'=>$event['end']],
                'sponsors'=>[],
            ]);
            if($international->version===1){
                DB::table('competition_audits')->insert(['action'=>'annual.template_revised','subject'=>(string)$international->id,'details'=>json_encode(['previous_schedule'=>$international->schedule,'previous_version'=>1,'reason'=>'Owner-approved regional/international cadence; existing editions retain their snapshots.']),'created_at'=>now()]);
                $international->update(['version'=>2,'schedule'=>['open'=>'01-01','close'=>$event['close'],'start'=>$event['start'],'end'=>$event['end']]]);
            }
        }
    }
}
