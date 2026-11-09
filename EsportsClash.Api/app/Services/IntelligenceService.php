<?php
namespace App\Services;
use App\Jobs\PollEvolutionRun;
use App\Models\{EvolutionRun,EvolutionSetting};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class IntelligenceService {
    public const SCOPES=['parameter','marl','source','arena'];
    public function configure(array $data,string $actor): void {
        EvolutionSetting::current();DB::transaction(function()use($data,$actor){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);$preferences=$settings->preferences??[];
            if(array_key_exists('preview_learning',$data))$preferences['intelligence_preview_enabled']=(bool)$data['preview_learning'];
            $preferences['intelligence']=$data;$settings->update(['preferences'=>$preferences]);
            app(EvolutionService::class)->audit('intelligence','automation.configured',$actor,$data);
        });
    }
    public function tick(): void {
        $settings=EvolutionSetting::current();$config=$settings->preferences['intelligence']??[];
        if(!$settings->enabled||!($config['enabled']??false))return;
        if($paused=EvolutionRun::where('status','paused_budget')->first()){$this->resume($paused->id,'scheduler');return;}
        if(EvolutionRun::whereIn('status',['queued','running','stopping','paused_resource'])->exists()||$settings->next_training_at?->isFuture())return;
        if($config['cycle_domains']??false){
            $previous=EvolutionRun::whereIn('plan->version',[3,4])->whereIn('status',['completed','failed','cancelled'])->latest()->first()?->plan['domain']??null;
            $position=array_search($previous,self::SCOPES,true);$config['domain']=self::SCOPES[$position===false?0:($position+1)%count(self::SCOPES)];
        }
        $this->start([...$config,'request_id'=>(string)Str::uuid()],'scheduler');
    }
    public function start(array $input,string $actor): EvolutionRun {
        EvolutionSetting::current();
        return DB::transaction(function()use($input,$actor){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);
            $id=$input['request_id'];
            if($old=EvolutionRun::withTrashed()->find($id)){
                if(($old->plan['domain']??null)!==$input['domain'])throw ValidationException::withMessages(['request_id'=>'Request ID already used.']);
                return $old;
            }
            if(EvolutionRun::whereIn('status',['queued','running','stopping','paused_resource','paused_budget'])->exists())
                throw ValidationException::withMessages(['run'=>'A study is already active.']);
            $seed=max(56001,$settings->next_seed); // Retained inventory through55000, never reclaimed.
            if($seed<=901000&&$seed+999>=900001)$seed=901001; // Frozen standalone planning block.
            // Same row lock and 1000-seed blocks as the legacy learner. Never reclaim seeds.
            if($seed>999000)throw ValidationException::withMessages(['run'=>'Supported deterministic seed space exhausted.']);
            $arena=$input['domain']==='arena';$championKey=$arena?'intelligence_arena_champion':'intelligence_champion';
            $policy=$settings->preferences[$championKey]??DB::table('intelligence_releases')->latest('id')->first()?->policy_id;
            $incumbent=$policy?DB::table('intelligence_policies')->find($policy):null;
            $history=DB::table('intelligence_policies')->orderBy('created_at')->get()->map(fn($p)=>[
                'id'=>$p->id,'policy'=>json_decode($p->policy,true,flags:JSON_THROW_ON_ERROR)])->filter(fn($p)=>(($p['policy']['kind']??'')==='arena-actor')===$arena)->values()->all();
            if($incumbent&&((json_decode($incumbent->policy,true)['kind']??'')==='arena-actor')!==$arena){$incumbent=null;$policy=null;}
            $payload=json_encode(['run_id'=>$id,'domain'=>$input['domain'],'first'=>$seed,'count'=>1000],JSON_THROW_ON_ERROR);
            $receipt=['payload'=>base64_encode($payload),'signature'=>hash_hmac('sha256',$payload,config('evolution.worker_token'))];
            DB::table('intelligence_seed_reservations')->insert(['id'=>(string)Str::uuid(),'run_id'=>$id,'first_seed'=>$seed,
                'count'=>1000,'receipt'=>json_encode($receipt,JSON_THROW_ON_ERROR),'created_at'=>now(),'updated_at'=>now()]);
            $plan=['version'=>$arena?4:3,'policy_scope'=>'autonomous-intelligence','domain'=>$input['domain'],
                'seed_start'=>$seed,'reservation'=>$receipt,'max_minutes'=>$input['max_minutes']??30,
                'total_minutes'=>$input['total_minutes']??1440,'generations'=>$input['generations']??2,
                'training_matches'=>$input['training_matches']??4,'evaluation_seeds'=>32,
                'incumbent'=>$incumbent?json_decode($incumbent->policy,true,flags:JSON_THROW_ON_ERROR):null,
                'incumbent_id'=>$policy,'opponents'=>$history,'automatic_promotion'=>false];
            if($arena){
                $plan['teaching']=json_decode(file_get_contents(resource_path('game/arena-teaching-v6.json')),true,flags:JSON_THROW_ON_ERROR);
                $plan['opponents']=array_slice($history,-2); // Larger factual actors must fit the authenticated 1 MiB job envelope.
                $preview=$this->manifest();$engine=json_decode(file_get_contents(resource_path('game/manifest.json')),true,flags:JSON_THROW_ON_ERROR);
                $retained=isset($preview['run_id'])?Cache::get('arena-preview:'.$preview['run_id']):null;
                $plan['initialization']=($preview['engine']==='arena-command-v1'&&($preview['policy']['version']??null)===3&&($preview['qualification']??null)==='learning'
                    &&$preview['source_hash']===($engine['arena_source_hash']??null))
                    &&isset($retained['policy_bytes'])&&$retained['id']===$preview['id']
                    ?array_intersect_key($retained,array_flip(['id','policy_bytes','source_hash','run_id'])):null;
            }
            if($plan['total_minutes']<$plan['max_minutes'])throw ValidationException::withMessages(['total_minutes'=>'Total budget must cover one invocation.']);
            if(strlen(config('evolution.worker_token'))<32)throw ValidationException::withMessages(['run'=>'Configure a private worker token before reserving seeds.']);
            $run=EvolutionRun::create(['id'=>$id,'plan'=>$plan]);
            $settings->update(['next_seed'=>$seed+1000,'next_training_at'=>now()->addMinutes($settings->training_interval_minutes)]);
            app(EvolutionService::class)->audit($id,'intelligence.queued',$actor,['domain'=>$input['domain'],'seed_start'=>$seed]);
            DB::afterCommit(fn()=>PollEvolutionRun::dispatch($id)); return $run;
        });
    }
    public function resume(string $id,string $actor): EvolutionRun {
        return DB::transaction(function()use($id,$actor){
            $run=EvolutionRun::lockForUpdate()->findOrFail($id);
            if(!in_array($run->plan['version']??0,[3,4],true)||$run->status!=='paused_budget')throw ValidationException::withMessages(['run'=>'Only a paused intelligence study can resume.']);
            $run->update(['status'=>'queued']);app(EvolutionService::class)->audit($id,'intelligence.resumed',$actor);
            DB::afterCommit(fn()=>PollEvolutionRun::dispatch($id));return $run;
        });
    }
    public function manifest(): array {
        // Learning previews are explicitly unqualified and frozen by the browser
        // when a match starts. They never enter the qualified-policy registry.
        $preferences=EvolutionSetting::current()->preferences??[];
        $study=($preferences['intelligence_preview_enabled']??true)?EvolutionRun::where('plan->version',4)->whereNotIn('status',['failed','cancelled','stopping'])->latest()->first():null;
        if($study){
            $candidate=Cache::remember('arena-preview:'.$study->id,now()->addSeconds(5),function()use($study){
                try{
                    $r=Http::withToken(config('evolution.worker_token'))->connectTimeout(1)->timeout(3)
                        ->get(rtrim(config('evolution.runner_url'),'/').'/runs/'.$study->id.'/checkpoint');
                    if(!$r->ok())return [];$p=$r->json();$bytes=base64_decode($p['policy_bytes']??'',true);
                    $decoded=$bytes?json_decode($bytes,true,flags:JSON_THROW_ON_ERROR):null;
                    if(!$bytes||($p['run_id']??null)!==$study->id||!hash_equals($p['hash']??'',hash('sha256',$bytes))
                        ||!is_array($decoded)||!$this->validPolicy($decoded)||($decoded['kind']??'')!=='arena-actor')return [];
                    return ['engine'=>'arena-command-v1','id'=>$p['hash'],'source_hash'=>$p['source_hash'],'policy'=>$decoded,'policy_bytes'=>$p['policy_bytes'],
                        'qualification'=>'learning','run_id'=>$study->id,'generation'=>$p['generation'],'metrics'=>$p['metrics']];
                }catch(\Throwable){return [];}
            });
            if($candidate){
                unset($candidate['policy_bytes']); // Exact bytes remain private for subsequent study initialization.
                if(($preferences['intelligence_arena_champion']??null)===$candidate['id']
                    &&DB::table('intelligence_policies')->where('id',$candidate['id'])->exists())$candidate['qualification']='qualified';
                return $candidate;
            }
        }
        $release=DB::table('intelligence_releases')->latest('id')->first();
        $policy=$release?->policy_id?DB::table('intelligence_policies')->find($release->policy_id):null;
        $arenaChampion=EvolutionSetting::current()->preferences['intelligence_arena_champion']??null;
        if($arenaChampion)$policy=DB::table('intelligence_policies')->find($arenaChampion);
        if($policy&&!hash_equals($policy->id,hash('sha256',$policy->policy)))$policy=null;
        $isArena=$policy&&(json_decode($policy->policy,true)['kind']??'')==='arena-actor';
        return ['engine'=>$isArena?'arena-command-v1':'safe-macro-v1','qualification'=>$policy?'qualified':null,'id'=>$policy?->id,'source_hash'=>$policy?->source_hash,
            'policy'=>$policy?json_decode($policy->policy,true,flags:JSON_THROW_ON_ERROR):null];
    }
    public function monitor():void {
        $this->monitorArenaChampion();
        $release=DB::table('intelligence_releases')->latest('id')->first();if(!$release?->policy_id)return;
        $policy=DB::table('intelligence_policies')->find($release->policy_id);
        $valid=$policy&&hash_equals($policy->id,hash('sha256',$policy->policy));
        if($valid){
            try{$response=Http::withToken(config('evolution.worker_token'))->connectTimeout(3)->timeout(15)
                ->get(rtrim(config('evolution.runner_url'),'/').'/runs/'.$policy->run_id.'/qualification');}
            catch(\Illuminate\Http\Client\ConnectionException){return;} // Outage does not establish model corruption.
            if($response->serverError()||$response->status()===401)return;
            $valid=$response->ok()&&$response->json('candidate.hash')===$policy->id&&$response->json('assessment.status')==='promote';
        }
        if($valid)return;
        DB::transaction(function()use($release){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);
            if(DB::table('intelligence_releases')->latest('id')->first()?->id!==$release->id)return;
            $preferences=$settings->preferences??[];$bad=$preferences['intelligence_quarantine']??[];$bad[]=$release->policy_id;
            $preferences['intelligence_quarantine']=array_values(array_unique($bad));$settings->update(['preferences'=>$preferences]);
            $previous=DB::table('intelligence_releases')->whereNotNull('policy_id')->whereNotIn('policy_id',$bad)->latest('id')->first()?->policy_id;
            $this->rollback($previous,'integrity-monitor','Artifact revalidation failed');
        });
    }
    private function monitorArenaChampion():void {
        $id=EvolutionSetting::current()->preferences['intelligence_arena_champion']??null;if(!$id)return;
        $policy=DB::table('intelligence_policies')->find($id);
        $valid=$policy&&hash_equals($id,hash('sha256',$policy->policy));
        if($valid){
            try{$r=Http::withToken(config('evolution.worker_token'))->connectTimeout(3)->timeout(15)
                ->get(rtrim(config('evolution.runner_url'),'/').'/runs/'.$policy->run_id.'/qualification');}
            catch(\Illuminate\Http\Client\ConnectionException){return;}
            if($r->serverError()||$r->status()===401)return;
            $valid=$r->ok()&&$r->json('candidate.hash')===$id&&$r->json('assessment.status')==='promote';
        }
        if($valid)return;
        DB::transaction(function()use($id){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);$preferences=$settings->preferences??[];
            if(($preferences['intelligence_arena_champion']??null)!==$id)return;
            $preferences['intelligence_arena_champion']=null;$preferences['intelligence_preview_enabled']=false;
            $preferences['intelligence_quarantine']=array_values(array_unique([...($preferences['intelligence_quarantine']??[]),$id]));
            $settings->update(['preferences'=>$preferences]);
            app(EvolutionService::class)->audit($id,'policy.arena-quarantined','integrity-monitor',['reason'=>'Independent artifact revalidation failed']);
        });
    }
    public function activate(string $runId,string $actor,bool $internal=false): array {
        $run=EvolutionRun::findOrFail($runId);
        if($run->status!=='completed'||!in_array($run->plan['version']??0,[3,4],true))throw ValidationException::withMessages(['run'=>'Complete a held-out intelligence study first.']);
        $evidence=Http::withToken(config('evolution.worker_token'))->timeout(15)->get(rtrim(config('evolution.runner_url'),'/').'/runs/'.$runId.'/qualification')->throw()->json();
        $a=$evidence['assessment']??[];
        if(($a['status']??'')!=='promote'||($a['independentSeeds']??0)<32||(($run->plan['version']??0)===3&&($a['extraTeamDeathCases']??1)!==0)
            ||($a['winDelta']['lower']??-1)<=0||($a['reasons']??['missing'])!==[])
            throw ValidationException::withMessages(['run'=>'The independently recomputed full-match gate did not pass.']);
        $bytes=base64_decode($evidence['policy_bytes']??'',true);$id=$evidence['candidate']['hash']??'';
        if(!$bytes||!hash_equals($id,hash('sha256',$bytes)))throw ValidationException::withMessages(['run'=>'Policy artifact integrity failed.']);
        $decoded=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);
        if(!$this->validPolicy($decoded)||((($decoded['kind']??'')==='arena-actor')!==($run->plan['version']===4)))throw ValidationException::withMessages(['run'=>'Unsupported policy schema or controller family.']);
        return DB::transaction(function()use($run,$evidence,$id,$bytes,$actor,$internal){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);
            $championKey=($run->plan['version']??0)===4?'intelligence_arena_champion':'intelligence_champion';
            $old=$internal?($settings->preferences[$championKey]??null)
                :DB::table('intelligence_releases')->latest('id')->first()?->policy_id;
            if($old===$id)return $this->manifest();
            if($old!==$run->plan['incumbent_id']||$old!==($evidence['incumbent_id']??null))
                throw ValidationException::withMessages(['run'=>'The incumbent changed; evaluate again.']);
            DB::table('intelligence_policies')->insertOrIgnore(['id'=>$id,'run_id'=>$run->id,'source_hash'=>$evidence['source_hash'],
                'policy'=>$bytes,'evidence'=>json_encode($evidence,JSON_THROW_ON_ERROR),'created_at'=>now(),'updated_at'=>now()]);
            if($internal){
                $preferences=$settings->preferences??[];$preferences[$championKey]=$id;$settings->update(['preferences'=>$preferences]);
                app(EvolutionService::class)->audit($id,'policy.internal-promotion',$actor,['run'=>$run->id,'from'=>$old,'evidence'=>$evidence['evidence_hash']]);
                return ['id'=>$id,'production_promoted'=>false];
            }
            DB::table('intelligence_releases')->insert(['policy_id'=>$id,'previous_policy_id'=>$old,'actor'=>$actor,
                'reason'=>'Independent full-match qualification','created_at'=>now(),'updated_at'=>now()]);
            app(EvolutionService::class)->audit($id,'policy.activated',$actor,['run'=>$run->id,'evidence'=>$evidence['evidence_hash']]);
            return $this->manifest();
        });
    }
    private function validPolicy(array $p):bool {
        $vector=fn($v,$n)=>is_array($v)&&array_is_list($v)&&count($v)===$n&&collect($v)->every(fn($x)=>(is_int($x)||is_float($x))&&is_finite((float)$x)&&abs($x)<=20);
        $matrix=fn($v,$n,$m)=>is_array($v)&&array_is_list($v)&&count($v)===$n&&collect($v)->every(fn($r)=>$vector($r,$m));
        if(($p['kind']??'')==='arena-actor')return count($p)===8
            &&((($p['version']??0)===1&&($p['input']??0)===48)||(in_array($p['version']??0,[2,3],true)&&($p['input']??0)===224))&&($p['hidden']??0)===32
            &&$matrix($p['w1']??null,32,$p['input'])&&$vector($p['b1']??null,32)&&$vector($p['w2']??null,32)
            &&isset($p['b2'])&&(is_int($p['b2'])||is_float($p['b2']))&&is_finite((float)$p['b2'])&&abs($p['b2'])<=20;
        if(($p['version']??0)!==1)return false;
        if(($p['kind']??'')==='macro-program')return count($p)===4&&$matrix($p['weights']??null,5,20)&&$vector($p['bias']??null,5);
        if(($p['kind']??'')==='macro-actor')return count($p)===8&&($p['input']??0)===20&&($p['hidden']??0)===16
            &&$matrix($p['w1']??null,16,20)&&$vector($p['b1']??null,16)&&$matrix($p['w2']??null,5,16)&&$vector($p['b2']??null,5);
        if(($p['kind']??'')!=='macro-strategy'||count($p)!==7)return false;
        foreach(['farmStrategic'=>[.32,.52],'farmTactical'=>[.26,.46],'farmConversionTactical'=>[.55,.75],'pushStrategic'=>[.08,.28],'pushTempoStrategic'=>[.52,.72]] as $key=>$bounds)
            if(!isset($p[$key])||!is_numeric($p[$key])||$p[$key]<$bounds[0]||$p[$key]>$bounds[1])return false;
        return $p['farmConversionTactical']>=$p['farmTactical']+.09&&$p['pushTempoStrategic']>=$p['pushStrategic']+.2;
    }
    public function rollback(?string $id,string $actor,string $reason='Owner rollback'): array {
        return DB::transaction(function()use($id,$actor,$reason){
            $settings=EvolutionSetting::lockForUpdate()->findOrFail(1);
            if($id&&!DB::table('intelligence_policies')->where('id',$id)->exists())throw ValidationException::withMessages(['policy_id'=>'Unknown qualified version.']);
            $old=DB::table('intelligence_releases')->latest('id')->first()?->policy_id;
            DB::table('intelligence_releases')->insert(['policy_id'=>$id,'previous_policy_id'=>$old,'actor'=>$actor,
                'reason'=>$reason,'created_at'=>now(),'updated_at'=>now()]);
            $preferences=$settings->preferences??[];$preferences['intelligence_champion']=$id;$settings->update(['preferences'=>$preferences]);
            $preferences['intelligence_preview_enabled']=false;
            $restored=$id?json_decode(DB::table('intelligence_policies')->find($id)->policy,true):null;
            $preferences['intelligence_arena_champion']=($restored['kind']??'')==='arena-actor'?$id:null;
            $settings->update(['preferences'=>$preferences]);
            app(EvolutionService::class)->audit('intelligence','policy.rollback',$actor,['from'=>$old,'to'=>$id]);
            return $this->manifest();
        });
    }
}
