<?php
namespace App\Services;
use App\Models\OwnedPlayerCard;
use Illuminate\Support\Facades\DB;
class FpsIdentityProfiles
{
    public function dna(string $id): array
    {
        $sample=function (string $key) use ($id): float {
            $hash=2166136261;
            $input=$id.':fps-dna-v2:'.$key;
            for ($i=0; $i<strlen($input); $i++) $hash=(($hash ^ ord($input[$i]))*16777619) & 0xffffffff;
            $hash=(($hash ^ ($hash >> 16))*0x45d9f3b) & 0xffffffff;
            $hash=(($hash ^ ($hash >> 16))*0x45d9f3b) & 0xffffffff;
            return ($hash ^ ($hash >> 16))/4294967295;
        };
        $value=fn(float $x) => (int) round(max(0,min(1,$x))*100);
        $discipline=$sample('discipline'); $social=$sample('social'); $stability=$sample('stability');
        return [
            'riskTolerance'=>$value($sample('risk')), 'emotionalStability'=>$value($stability),
            'coachability'=>$value(.35*$discipline+.65*$sample('coachability')), 'tacticalDiscipline'=>$value($discipline),
            'adaptability'=>$value($sample('adaptability')), 'creativity'=>$value($sample('creativity')),
            'confidenceVolatility'=>$value(.35*(1-$stability)+.65*$sample('volatility')), 'socialTrust'=>$value($social),
            'leadershipInitiative'=>$value($sample('leadership')), 'competitiveDrive'=>$value($sample('drive')),
            'teamOrientation'=>$value(.35*$social+.65*$sample('team')),
            'preparationPreference'=>$value(.35*$discipline+.65*$sample('preparation')),
        ];
    }


    public function initialize(OwnedPlayerCard $player,array $definition,bool $newIdentity=false): void
    {
        DB::table('fps_player_identities')->insertOrIgnore(['player_id'=>$player->id,'schema_version'=>4,
            'dna'=>json_encode($this->dna($player->id),JSON_THROW_ON_ERROR),
            'personality'=>json_encode(app(FpsPlayerArchitecture::class)->generate($player->id),JSON_THROW_ON_ERROR),
            'behavior'=>json_encode(['version'=>4,'matches'=>0,'metrics'=>(object)[]]),
            'development'=>json_encode(['familiarity'=>0,'role_familiarity'=>(object)[],'mapping'=>'deterministic_id_v4']),
            'created_at'=>now(),'updated_at'=>now()]);
    }
    public function assignmentsFor(OwnedPlayerCard $player): ?array
    {
        $club=\App\Models\OnlineClub::where('user_id',$player->user_id)->first();if(!$club)return null;
        $orders=json_decode(DB::table('fps_team_systems')->where('club_id',$club->id)->value('instructions')??'{}',true);
        $assigned=array_filter(array_intersect_key($orders[$player->id]??[],array_flip(['t','ct'])));
        return $assigned?:null;
    }
    public function scouting(object $row,?array $plan=null,?array $coach=null): array
    {
        $arch=app(FpsPlayerArchitecture::class);
        $p=$arch->personality(json_decode($row->personality,true,512,JSON_THROW_ON_ERROR));
        $dna=json_decode($row->dna??'{}',true)?:[];
        $tendencies=$arch->deriveTendencies($p,$dna);
        $iglIdentity=$arch->iglLeadershipIdentity($tendencies);
        $dev=json_decode($row->development,true);$behavior=json_decode($row->behavior??'null',true);
        $initiative=match($p['playstyle']){'AGGRESSIVE'=>.9,'PASSIVE'=>.1,default=>.5};
        $deliberation=match($p['decisionStyle']){'METHODICAL'=>.85,'INSTINCTIVE'=>.15,default=>.5};
        $coordination=$p['mindset']==='TEAM_FIRST'?.85:.25;
        $describe=fn($fit)=>$fit>=.75?'promising':($fit>=.55?'mixed':'potential friction');
        $gameplanFit=$plan?$describe((4-abs($initiative-$plan['aggression'])-abs($deliberation-$plan['preparation'])-abs($coordination-$plan['structure'])-abs(1-$deliberation-$plan['freedom']))/4):null;
        $coachFit=$coach?$describe((4-abs($initiative-$coach['aggression'])-abs($deliberation-$coach['preparation'])-abs($coordination-$coach['communication'])-abs(1-$deliberation-$coach['freedom']))/4):null;
        $appearances=$behavior['matches']??0;$sufficient=$appearances>=5&&($behavior['metrics']['engagement']['opportunities']??0)>=30;
        // Derived values only; raw DNA never leaves this service. Labels come from the shared catalog.
        $labels=[];foreach($arch->tendenciesCatalog()['individualCategories'] as $category)foreach($category['tendencies'] as $t)$labels[$t['key']]=$t['label'];
        $topTendencies=[];
        foreach(['earlyAggression','playDiscipline','supportFlash','lurkFlank','wideSwing','jigglePeek','utilityConservation','rotationProactivity'] as $k)$topTendencies[]=['key'=>$k,'label'=>$labels[$k]??$k,'value'=>$tendencies[$k]??50];
        usort($topTendencies,fn($a,$b)=>abs($b['value']-50)<=>abs($a['value']-50)?:$b['value']<=>$a['value']);
        // Manager-facing output uses whole 1–10 levels with labels; raw 0–100 values stay here.
        $topTendencies=array_map(function($t)use($arch){$r=$arch->rated($t['value'],'tendency');return ['key'=>$t['key'],'label'=>$t['label'],'value'=>$r['value'],'level'=>$r['label']];},$topTendencies);
        return ['player_id'=>$row->player_id,'personality'=>$p,'observed'=>$sufficient?$behavior:null,
            'mapping'=>$dev['mapping']??'deterministic_id_v4','confidence'=>$sufficient?'observed':'natural preferences; insufficient match observations',
            'appearances'=>$appearances,'gameplan_fit'=>$gameplanFit,'coach_fit'=>$coachFit,'role_familiarity'=>$dev['role_familiarity']??(object)[],
            'igl_identity'=>$iglIdentity,'top_tendencies'=>array_slice($topTendencies,0,3),
            // Derived diagnostics (shared diagnosticKeys) and the hidden consistency trait, both as whole
            // 1–10 levels with labels; neither exposes DNA or a raw 0–100 value.
            'derived_tendencies'=>array_map(fn($v)=>$arch->rated($v,'tendency'),$arch->diagnosticTendencies($p,$dna)),'consistency'=>$arch->rated($arch->deriveConsistency($p,$dna),'skill'),
            'familiarity'=>($dev['familiarity']??0)>.3?'learning':'new system','recent_observations'=>$sufficient?($dev['recent_observations']??[]):[],
            'observations'=>['risk'=>strtolower($p['playstyle']),'adaptability'=>'universal; '.strtolower($p['decisionStyle']).' reassessment','preparation'=>$deliberation>.7?'deliberate':'contextual','team_orientation'=>strtolower($p['mindset']),'pressure_response'=>strtolower($p['temperament'])]];
    }
}
