<?php

namespace App\Services;

use App\Models\OwnedPlayerCard;
use Illuminate\Support\Facades\DB;

class FpsIdentityProfiles
{
    public const PERSONALITIES=['icebound','momentum_surfer','redemption_chaser','pressure_magnet','slow_burner','reset_specialist','window_pouncer','contact_hunter','counterpuncher','calculated_gambler','tempo_thief','boundary_tester','structured_operator','tactical_skeptic','silent_enabler','rally_voice','independent_solver','burden_carrier','asset_guardian','utility_investor','force_buy_optimist','bankroll_planner','salvage_opportunist','role_first_buyer'];
    // Approximate FPS interpretations; original badges remain stored and visible.
    private const LEGACY_MAP = [
        'igl'=>'burden_carrier','captain'=>'rally_voice','challenger'=>'tactical_skeptic',
        'loyalist'=>'structured_operator','glue_guy'=>'silent_enabler','silent_operator'=>'independent_solver',
        'untiltable'=>'reset_specialist','cold_as_ice'=>'icebound','short_fuse'=>'redemption_chaser',
        'fragile_mental'=>'slow_burner','iron_will'=>'reset_specialist','clutch_performer'=>'pressure_magnet',
        'overconfident'=>'momentum_surfer','egoistic'=>'independent_solver','momentum_junkie'=>'momentum_surfer',
        'revenge_driven'=>'redemption_chaser','showman'=>'pressure_magnet','perfectionist'=>'structured_operator',
        'first_blood_hunter'=>'contact_hunter','counterpuncher'=>'counterpuncher','limit_tester'=>'boundary_tester',
        'bodyguard'=>'silent_enabler','patient_predator'=>'window_pouncer','tunnel_vision'=>'contact_hunter',
        'objective_zealot'=>'role_first_buyer','steal_gambler'=>'calculated_gambler','siege_closer'=>'tempo_thief',
        'wave_architect'=>'utility_investor','bush_stalker'=>'window_pouncer','survivalist'=>'asset_guardian',
    ];
    private const ROLE_WEIGHTS = [
        'entry'=>['lan'=>.7,'flx'=>.2,'tf'=>.1], 'caller'=>['ldr'=>.6,'iq'=>.3,'tf'=>.1],
        'sniper'=>['lan'=>.55,'clu'=>.35,'iq'=>.1], 'support'=>['iq'=>.45,'tf'=>.35,'flx'=>.2],
        'lurker'=>['iq'=>.4,'clu'=>.35,'flx'=>.25], 'anchor'=>['iq'=>.4,'clu'=>.35,'tf'=>.25],
        'trade'=>['tf'=>.75,'lan'=>.25],
    ];
    private const ROLE_SPECIALTIES = [
        'entry'=>['contact_splitter','flash_window_finisher','gap_punisher'],
        'caller'=>['rotation_decoder','midround_rebuilder','double_fake_conductor'],
        'sniper'=>['long_lane_guardian','relocation_marksman','opening_sightline_expert'],
        'support'=>['smoke_cartographer','entry_flash_synchronizer','retake_utility_expert'],
        'lurker'=>['rotation_cutter','flank_sentinel','timing_ghost'],
        'anchor'=>['delay_engineer','crossfire_composer','last_line_defender'],
        'trade'=>['instant_refragger','spacing_technician','crossfire_breaker'],
    ];
    private function initialSpecialty(string $id, array $stats): ?string
    {
        $best=null; $bestScore=-INF;
        foreach (self::ROLE_WEIGHTS as $role=>$weights) {
            $score=0;
            foreach ($weights as $key=>$weight) {
                if (!isset($stats[$key]) || !is_numeric($stats[$key])) continue 2;
                $score+=(float)$stats[$key]*$weight;
            }
            if ($score>$bestScore) { $best=$role; $bestScore=$score; }
        }
        if ($best===null) return null;
        $choices=self::ROLE_SPECIALTIES[$best];
        return $choices[hexdec(substr(hash('sha256',$id.':fps-specialty-v1'),0,8)) % count($choices)];
    }

    /** Stable initial behavioral characteristics. They do not modify skill values. */
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

    /** Initial estimates retain provenance; existing DNA and assigned badges are immutable here. */
    public function initialize(OwnedPlayerCard $player, array $definition, bool $newIdentity=false): void
    {
        $legacy=$definition['primaryPersonality'] ?? null;
        $personality=is_string($legacy) ? (self::LEGACY_MAP[$legacy] ?? null) : null;
        $mapping='approximate_legacy_v1';
        if($newIdentity || !$personality) {
            $personality=self::PERSONALITIES[hexdec(substr(hash('sha256',$player->id.':fps-personality-v1'),0,8))%count(self::PERSONALITIES)];
            $mapping=$newIdentity?'generated_fps_v1':'no_legacy_equivalent_generated_v1';
        }
        $specialty=$this->initialSpecialty($player->id,$definition['stats'] ?? []);
        DB::table('fps_player_identities')->insertOrIgnore([
            'player_id'=>$player->id, 'schema_version'=>2,
            'dna'=>json_encode($this->dna($player->id),JSON_THROW_ON_ERROR),
            'legacy_primary'=>$definition['primaryPersonality'] ?? null,
            'legacy_secondary'=>$definition['secondaryPersonality'] ?? null,
            'personality_id'=>$personality, 'specialty_id'=>$specialty,
            'development'=>json_encode(['familiarity'=>0,'role_familiarity'=>[], 'mapping'=>$mapping, 'specialty_source'=>$specialty ? 'initial_role_fit_v1' : 'unassigned'],JSON_THROW_ON_ERROR),
            'created_at'=>now(), 'updated_at'=>now(),
        ]);
        $row=DB::table('fps_player_identities')->where('player_id',$player->id)->first();
        if ($row && (!$row->personality_id || !$row->specialty_id)) {
            $dev=json_decode($row->development,true);
            $dev['previous_mapping']=$dev['mapping']??'pending';
            $dev['mapping']=$mapping;
            DB::table('fps_player_identities')->where('player_id',$player->id)->whereNull('personality_id')->update(['personality_id'=>$personality,'development'=>json_encode($dev),'updated_at'=>now()]);
            DB::table('fps_player_identities')->where('player_id',$player->id)->whereNull('specialty_id')->update(['specialty_id'=>$specialty,'updated_at'=>now()]);
        }
    }

    /** Coarse scouting notes; the internal DNA is not returned to a manager. */
    public function scouting(object $row, ?array $plan = null, ?array $coach = null): array
    {
        $dna=json_decode($row->dna,true,512,JSON_THROW_ON_ERROR);
        $band=fn(string $key) => $dna[$key]<40 ? 'lower' : ($dna[$key]>60 ? 'higher' : 'mixed');
        $development=json_decode($row->development,true,512,JSON_THROW_ON_ERROR);
        $gameplanFit=null;
        $coachFit=null;
        $describe=fn(float $fit)=>$fit>=.75?'promising':($fit>=.55?'mixed':'potential friction');
        if ($plan && isset($plan['aggression'],$plan['structure'],$plan['preparation'],$plan['freedom'])) {
            $fit=(1-abs($dna['riskTolerance']/100-(float)$plan['aggression'])
                +1-abs($dna['tacticalDiscipline']/100-(float)$plan['structure'])
                +1-abs($dna['preparationPreference']/100-(float)$plan['preparation'])
                +1-abs($dna['creativity']/100-(float)$plan['freedom']))/4;
            $gameplanFit=$describe($fit);
        }
        if($coach) $coachFit=$describe((1-abs($dna['tacticalDiscipline']/100-$coach['rigidity'])+1-abs($dna['preparationPreference']/100-$coach['preparation'])+1-abs($dna['creativity']/100-$coach['freedom'])+1-abs($dna['teamOrientation']/100-$coach['communication']))/4);
        $appearances=$development['appearances']??0;
        $familiarity=$plan ? ($development['systems'][hash('sha256',json_encode($plan))]??0) : 0;
        return ['player_id'=>$row->player_id,'personality_id'=>$row->personality_id,'specialty_id'=>$row->specialty_id,
            'legacy_primary'=>$row->legacy_primary,'mapping'=>$development['mapping'] ?? 'pending','confidence'=>$appearances>=20?'established':($appearances>=5?'developing evidence':'early estimate'),'appearances'=>$appearances,'gameplan_fit'=>$gameplanFit,'coach_fit'=>$coachFit,
            'familiarity'=>$familiarity>.7?'familiar':($familiarity>.3?'learning':'new system'),'role_familiarity'=>$development['role_familiarity']??(object)[],
            'recent_observations'=>$development['recent_observations']??[],
            'observations'=>['risk'=>$band('riskTolerance'),'adaptability'=>$band('adaptability'),'preparation'=>$band('preparationPreference'),'team_orientation'=>$band('teamOrientation'),'pressure_response'=>$band('emotionalStability'),'economy_discipline'=>$band('tacticalDiscipline')]];
    }
}
