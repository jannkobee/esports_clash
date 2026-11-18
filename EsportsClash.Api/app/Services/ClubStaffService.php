<?php

namespace App\Services;

use App\Models\{ClubStaff, OnlineClub};
use Illuminate\Support\Facades\DB;

class ClubStaffService
{
    private const ROLES = [
        'head_coach' => [
            'title' => 'Head coach',
            'names' => ['Ari Navarro', 'Mika Santos', 'Jun Park', 'Tala Reyes', 'Noah Cruz'],
            'attributes' => ['tactics', 'drafting', 'leadership', 'adaptation'],
        ],
        'assistant_coach' => [
            'title' => 'Assistant coach',
            'names' => ['Eli Ramos', 'Sora Kim', 'Rafi Dela Cruz', 'Nico Lim', 'Aya Flores'],
            'attributes' => ['preparation', 'communication', 'flexibility', 'teamwork'],
        ],
        'analyst' => [
            'title' => 'Analyst',
            'names' => ['Bea Tan', 'Kai Mendoza', 'Luz Villanueva', 'Ren Ito', 'Sam Yu'],
            'attributes' => ['meta_reading', 'scouting', 'counter_pick', 'data_quality'],
        ],
        'performance_coach' => [
            'title' => 'Performance coach',
            'names' => ['Ira Valdez', 'Sol Rivera', 'Aki Mori', 'Mara Chua', 'Toni Garcia'],
            'attributes' => ['conditioning', 'recovery', 'development', 'load_management'],
        ],
        'psychologist' => [
            'title' => 'Team psychologist',
            'names' => ['Cami Ortega', 'Drew Bautista', 'Yuna Lee', 'Paz Domingo', 'Alex Lim'],
            'attributes' => ['composure', 'resilience', 'motivation', 'communication'],
        ],
    ];

    public function definitions(): array { return self::ROLES; }

    public function ensure(OnlineClub $club): void
    {
        foreach (self::ROLES as $role => $definition) {
            $seed = crc32($club->id.':'.$role);
            $attributes = [];
            foreach ($definition['attributes'] as $index => $attribute) {
                $attributes[$attribute] = 4 + (($seed >> (($index * 5) % 24)) & 0x7) % 7;
            }
            $names = $definition['names'];
            ClubStaff::firstOrCreate(
                ['club_id' => $club->id, 'role' => $role],
                ['name' => $names[$seed % count($names)], 'ratings' => $attributes,'founding_profile'=>['name'=>$names[$seed % count($names)],'ratings'=>$attributes]],
            );
        }
        if(ClubStaff::where('club_staff.club_id',$club->id)->join('club_staff_contracts as c','c.id','=','club_staff.contract_id')->where('c.ends_at','<=',now())->exists())app(StaffContracts::class)->expire($club);
    }

    public function roster(OnlineClub $club): array
    {
        $this->ensure($club);
        $rows = ClubStaff::where('club_id', $club->id)->get()->keyBy('role');
        $contracts=DB::table('club_staff_contracts')->whereIn('id',$rows->pluck('contract_id')->filter())->get()->keyBy('id');

        return collect(self::ROLES)->map(function (array $definition, string $role) use ($rows,$contracts): array {
            $member = $rows->get($role);

            return [
                'portrait_key' => $member?->contract_id?'candidate:'.($contracts[$member->contract_id]->candidate_key??$member->name):'staff:'.$member?->id, 'role' => $role,
                'title' => $definition['title'],
                'name' => $member->name,
                'attributes' => $member->ratings,
                'weekly_salary'=>$member->contract_id?(int)$contracts[$member->contract_id]->weekly_salary:0,
                'contract_id'=>$member->contract_id,'contract_ends_at'=>$member->contract_id?\Carbon\CarbonImmutable::parse($contracts[$member->contract_id]->ends_at)->toIso8601String():null,
                'arrangement'=>$member->contract_id?'Eight-week paid contract':'Founding staff arrangement',
            ];
        })->values()->all();
    }

    public function snapshot(OnlineClub $club): array
    {
        return collect($this->roster($club))->map(fn($m)=>array_intersect_key($m,array_flip(['role','title','name','attributes'])))->keyBy('role')->all();
    }

    public function coachCard(OnlineClub $club): array
    {
        $staff = $this->snapshot($club);
        $coach = $staff['head_coach'];
        $assistant = $staff['assistant_coach'];
        $analyst = $staff['analyst'];
        $psychologist = $staff['psychologist'];
        $style = match (true) {
            $coach['attributes']['tactics'] >= 8 && $analyst['attributes']['meta_reading'] >= 7 => 'Objective Macro',
            $coach['attributes']['adaptation'] >= 8 => 'Dynamic Adapt',
            $coach['attributes']['drafting'] >= 8 => 'Pick & Burst',
            $assistant['attributes']['flexibility'] >= 8 => 'Scaling Poke',
            default => 'Aggressive Dive',
        };
        $tactical = $coach['attributes']['tactics'];
        $playbook = (int) round(($tactical * 0.45 + $coach['attributes']['drafting'] * 0.35
            + $analyst['attributes']['meta_reading'] * 0.2) * 2);
        $chemistry = (int) round(($coach['attributes']['leadership'] + $assistant['attributes']['teamwork']
            + $psychologist['attributes']['communication'] + $psychologist['attributes']['resilience']) * 20 / 40);

        return [
            'id' => 'club-coach-'.$club->id,
            'name' => $coach['name'],
            'style' => $style,
            'chemistryBonus' => $chemistry,
            'playbookBonus' => $playbook,
            'extraBans' => 0,
            'quote' => 'Prepared from the club staff scouting report.',
            'rating10' => (int) round(($tactical + $coach['attributes']['drafting'] + $coach['attributes']['leadership']) / 3),
            'coachAttributes' => [
                'tactical' => $tactical,
                'mechanical' => $assistant['attributes']['teamwork'],
                'conditioning' => $staff['performance_coach']['attributes']['conditioning'],
                'youthDevelopment' => $staff['performance_coach']['attributes']['development'],
                'motivation' => $psychologist['attributes']['motivation'],
            ],
        ];
    }

    /**
     * What each staff rating does in the tactical FPS game. Every effect is a learning rate or a report's depth
     * (decision-side): staff never change aim, damage or reaction. Keys are the stored attribute keys; their
     * historical names (drafting, meta reading, counter-pick) are kept so signed contracts stay valid.
     */
    public const FPS_ATTRIBUTES = [
        'head_coach' => ['tactics' => ['System teaching', 'Players learn the gameplan faster.'], 'drafting' => ['Match preparation', 'A fixture-specific plan borrows more of the familiar club plan.'],
            'leadership' => ['Leadership', 'Players accept the in-game leader\'s calls sooner.'], 'adaptation' => ['Adaptation', 'Less familiarity is lost when this coach takes over.']],
        'assistant_coach' => ['preparation' => ['Session preparation', 'Players learn the gameplan faster (with system teaching).'], 'communication' => ['Communication', 'Teammates build communication faster.'],
            'flexibility' => ['Role coaching', 'Players settle into new positions faster.'], 'teamwork' => ['Teamwork', 'Teammates build trust faster.']],
        'analyst' => ['meta_reading' => ['Pattern reading', 'Opponent reports cover more categories.'], 'scouting' => ['Opponent scouting', 'Opponent reports cover more categories.'],
            'counter_pick' => ['Counter-planning', 'Opponent reports cover more categories.'], 'data_quality' => ['Data quality', 'Opponent reports cover more categories.']],
        'performance_coach' => ['conditioning' => ['Conditioning', 'More training XP from matches.'], 'recovery' => ['Recovery', 'A little more training XP from matches.'],
            'development' => ['Player development', 'Most of the training XP bonus.'], 'load_management' => ['Reserve development', 'Reserves earn more practice XP from scrimmages.']],
        'psychologist' => ['composure' => ['Composure', 'Teammates build trust faster.'], 'resilience' => ['Resilience', 'Teammates build trust faster.'],
            'motivation' => ['Motivation', 'Teammates build understanding faster.'], 'communication' => ['Communication', 'Teammates build communication faster.']],
    ];

    /** 0.6 at rating 0, 1.0 at the founding average of 5, 1.4 at 10. */
    public static function rate(float $rating): float { return .6 + .08 * max(0, min(10, $rating)); }

    /**
     * Learning-rate multipliers from a pinned staff snapshot (plan['staff'][side]); neutral (1.0) when the plan
     * has no staff, so older allocations keep their exact behaviour.
     */
    public static function learningRates(?array $staff): array
    {
        $a = fn (string $role, string $key) => (float) ($staff[$role]['attributes'][$key] ?? 5);
        if (! is_array($staff)) return ['system' => 1.0, 'retention' => .8, 'role' => 1.0, 'trust' => 1.0, 'communication' => 1.0, 'understanding' => 1.0, 'leadership' => 1.0, 'carry' => .6];
        return [
            'system' => self::rate(($a('head_coach', 'tactics') + $a('assistant_coach', 'preparation')) / 2),
            'retention' => min(.95, .7 + .025 * $a('head_coach', 'adaptation')),
            'role' => self::rate($a('assistant_coach', 'flexibility')),
            'trust' => self::rate(($a('assistant_coach', 'teamwork') + $a('psychologist', 'composure') + $a('psychologist', 'resilience')) / 3),
            'communication' => self::rate(($a('assistant_coach', 'communication') + $a('psychologist', 'communication')) / 2),
            'understanding' => self::rate($a('psychologist', 'motivation')),
            'leadership' => self::rate($a('head_coach', 'leadership')),
            'carry' => min(.9, .3 + .06 * $a('head_coach', 'drafting')),
        ];
    }

    /** Analyst quality (mean of the four ratings) for opponent reports. */
    public static function analystQuality(?array $analyst): int
    {
        $values = array_values($analyst['attributes'] ?? []);
        return $values ? (int) round(array_sum($values) / count($values)) : 5;
    }

    /** Reserve practice XP as a share of a starter's match XP. */
    public static function reserveShare(?array $staff): float
    {
        return min(.75, .25 + .04 * (float) ($staff['performance_coach']['attributes']['load_management'] ?? 5));
    }

    /** Manager-facing description of the current staff's effects. */
    public function fpsEffects(OnlineClub $club): array
    {
        $staff = $this->snapshot($club);
        $rates = self::learningRates($staff);
        $pct = fn (float $r) => (int) round(($r - 1) * 100);
        return ['system_learning' => $pct($rates['system']), 'role_learning' => $pct($rates['role']), 'chemistry' => $pct(($rates['trust'] + $rates['communication'] + $rates['understanding']) / 3),
            'leadership' => $pct($rates['leadership']), 'coach_change_retention' => (int) round($rates['retention'] * 100), 'fixture_plan_carry' => (int) round($rates['carry'] * 100),
            'training_bonus_percent' => $this->trainingBonusFromSnapshot($staff), 'reserve_practice_percent' => (int) round(self::reserveShare($staff) * 100),
            'opponent_report_categories' => OpponentScouting::analystDetail(self::analystQuality($staff['analyst'] ?? null))];
    }

    public function trainingBonusPercent(OnlineClub $club): int
    {
        return $this->trainingBonusFromSnapshot($this->snapshot($club));
    }

    public function trainingBonusFromSnapshot(?array $staff): int
    {
        // Plans allocated before staff snapshots existed receive the historical zero bonus.
        $performance = $staff['performance_coach']['attributes'] ?? null;
        if (!is_array($performance)) return 0;

        return max(0, min(15, (int) round(
            max(0, ($performance['development'] ?? 5) - 5) * 1.5
            + max(0, ($performance['conditioning'] ?? 5) - 5) * 0.75
            + max(0, ($performance['recovery'] ?? 5) - 5) * 0.25,
        )));
    }
}
