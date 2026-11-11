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
            'title' => 'Meta analyst',
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
