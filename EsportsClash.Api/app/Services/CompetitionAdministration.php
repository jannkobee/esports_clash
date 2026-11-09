<?php
namespace App\Services;

use App\Models\{ClubTournament, CompetitionDefinition, CompetitionGeography, NationalTeam, User};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CompetitionAdministration
{
    public function admin(User $user): void { abort_unless($user->is_evolution_admin,403,'Competition administration requires the designated owner.'); }
    public function organizer(User $user,int $id): object
    {
        $o=DB::table('competition_organizers')->find($id);abort_unless($o && ($user->is_evolution_admin || $o->user_id===$user->id),403);
        return $o;
    }
    public function audit(User $user,string $action,string $subject,array $details=[]): void
    {
        DB::table('competition_audits')->insert(['user_id'=>$user->id,'action'=>$action,'subject'=>$subject,'details'=>json_encode($details),'created_at'=>now()]);
    }
    public function validateRules(array $rules): void
    {
        validator($rules,['capacity'=>'required|integer|min:2|max:256','minimum'=>'sometimes|integer|min:2|max:256',
            'stages'=>'required|array|min:1|max:8','stages.*.advance'=>'required|integer|min:1|max:256',
            'stages.*.groups'=>'sometimes|integer|min:2|max:64','stages.*.rounds'=>'sometimes|integer|min:1|max:255',
            'qualification'=>'required|array|min:1|max:256','qualification.*.key'=>'required|alpha_dash|max:60',
            'qualification.*.slots'=>'required|integer|min:1|max:256','fixture_interval_hours'=>'sometimes|integer|min:1|max:168','round_interval_hours'=>'sometimes|integer|min:24|max:336'])->validate();
        abort_if(($rules['capacity']??0)<2 || $rules['capacity']>config('competitions.max_edition_size'),422,'Use bounded editions of 2–256 teams and partition large qualifiers into independent scopes.');
        abort_unless(isset($rules['stages']) && count($rules['stages'])>=1 && count($rules['stages'])<=8,422,'Publish one to eight stages.');
        $count=$rules['capacity'];
        foreach($rules['stages'] as $stage){
            abort_unless(in_array($stage['format']??'',CompetitionPairing::FORMATS,true),422,'Unsupported format.');
            $advance=$stage['advance']??1;abort_if($advance<1 || $advance>$count,422,'Invalid advancement count.');
            if($stage['format']==='groups'){
                $groups=$stage['groups']??0;
                abort_if($groups<2 || $groups>$count/2 || $count%$groups!==0 || $advance%2!==0 || ($advance & ($advance-1))!==0,422,'Groups must be equal sized and advance a power-of-two knockout field.');
            }
            if($stage['format']==='swiss')abort_if(($stage['rounds']??0)<1 || $stage['rounds']>$count-1,422,'Publish a valid Swiss round count.');
            $count=$advance;
        }
        abort_unless($count===1,422,'The final stage must determine one champion.');
        $total=0;$keys=[];
        foreach($rules['qualification']??[] as $path){
            abort_unless(in_array($path['method']??'', ['ranking','results','open','wildcard','automatic'],true),422,'Unknown qualification method.');
            abort_if(($path['slots']??0)<1 || in_array($path['key']??'', $keys),422,'Each pathway requires a unique key and positive allocation.');
            $keys[]=$path['key'];$total+=$path['slots'];
        }
        abort_if($total!==$rules['capacity'],422,'Qualification slots must exactly equal capacity.');
        abort_if(($rules['fixture_interval_hours']??1)<1,422,'Fixture intervals must allow at least one hour.');
    }
    public function createEdition(User $user,CompetitionDefinition $definition,array $data): ClubTournament
    {
        $this->organizer($user,$definition->organizer_id);
        abort_if($definition->official,409,'Official editions come from the frozen annual calendar. Independent organizers may publish editions throughout the year.');
        abort_unless($definition->status==='approved',409,'An administrator must approve the definition first.');
        $calendar=app(CompetitionCalendar::class);
        $open=CarbonImmutable::parse($data['opens_at'])->utc();$close=CarbonImmutable::parse($data['closes_at'])->utc();
        $start=CarbonImmutable::parse($data['starts_at'])->utc();$end=CarbonImmutable::parse($data['ends_at'])->utc();
        abort_if($start->year!==$calendar->year() || $end->year!==$start->year
            || !$open->lt($close)|| !$close->lt($start)|| !$start->lt($end)||$close->lte(now()),422,'Publish future dates within the actual competitive calendar year.');
        return DB::transaction(function()use($user,$definition,$data,$open,$close,$start,$end){
            $definition=CompetitionDefinition::whereKey($definition->id)->lockForUpdate()->firstOrFail();
            $rules=$definition->rules;$this->validateRules($rules);
            $e=ClubTournament::create(['definition_id'=>$definition->id,'scope'=>$data['scope'],'name'=>$definition->name.' '.$start->year,
                'year'=>$start->year,'tier'=>null,'participant_type'=>$definition->participant_type,'capacity'=>$rules['capacity'],
                'rules_version'=>$definition->version,'regulations'=>$rules,'qualification'=>$rules['qualification'],'sponsors'=>$definition->sponsors,
                'ranked'=>$definition->ranked,'accreditation'=>$definition->ranked?($definition->official?'official':'verified_ranked'):'unranked',
                'registration_opens_at'=>$open,'registration_closes_at'=>$close,'starts_at'=>$start,'ends_at'=>$end,
                'semifinals_at'=>$start,'final_at'=>$end,'champion_prize'=>0,'runner_up_prize'=>0]);
            $this->audit($user,'edition.created',(string)$e->id,['definition_version'=>$definition->version]);return $e;
        },3);
    }
    public function geography(User $user,array $data): CompetitionGeography
    {
        $this->admin($user);
        $parent=isset($data['parent_id'])?CompetitionGeography::findOrFail($data['parent_id']):null;
        $kinds=['continent','region','country','subregion'];$index=array_search($data['kind'],$kinds,true);
        abort_if(($index===0 && $parent) || ($index>0 && (!$parent || array_search($parent->kind,$kinds,true)!==$index-1)),422,'Use continent → region → country → subregion.');
        $geo=CompetitionGeography::create($data);
        if($geo->kind==='country')NationalTeam::firstOrCreate(['geography_id'=>$geo->id],['name'=>$geo->name,'flag'=>$geo->code]);
        $this->audit($user,'geography.created',(string)$geo->id,$data);return $geo;
    }

    public function refundCancelled(int $id): void
    {
        DB::transaction(function()use($id){
            $event=ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();if($event->status!=='cancelled')return;
            if(\Illuminate\Support\Facades\Schema::hasTable('world_sponsor_ledger')){
                $escrow=DB::table('world_sponsor_ledger')->where('reference',"event:$id:escrow")->first();
                if($escrow)DB::table('world_sponsor_ledger')->insertOrIgnore(['organizer_id'=>$escrow->organizer_id,'tournament_id'=>$id,'reference'=>"event:$id:refund",'kind'=>'Cancelled event refund','amount'=>-$escrow->amount,'created_at'=>now()]);
            }
            $funding=DB::table('club_money_entries')->where('reference',"competition:$id:funding")->first();
            if($funding)DB::table('club_money_entries')->insertOrIgnore(['club_id'=>$funding->club_id,'amount'=>-$funding->amount,'kind'=>'Cancelled tournament refund','reference'=>"competition:$id:refund",'created_at'=>now()]);
        },3);
    }
}
