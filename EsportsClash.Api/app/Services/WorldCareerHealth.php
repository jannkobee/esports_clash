<?php
namespace App\Services;
use Illuminate\Support\Facades\{Cache,DB};

class WorldCareerHealth {
    public function snapshot():array {
        if(!app(WorldCareers::class)->ready())return [];
        return Cache::remember('world-career-health:v1',60,function(){
            $balances=DB::table('club_money_entries')->select('club_id')->selectRaw('SUM(amount) AS balance')->groupBy('club_id');
            return ['career_people'=>DB::table('world_agents')->count(),'career_available_professionals'=>DB::table('world_agents')->where('status','available')->where('profession','<>','player')->count(),
                'career_pending_agreements'=>DB::table('world_negotiations')->whereIn('status',['pending','countered'])->count(),'career_accepted_agreements'=>DB::table('world_negotiations')->where('status','accepted')->count(),
                'career_failed_agreements'=>DB::table('world_negotiations')->whereIn('status',['rejected','conditions_changed','expired'])->count(),'career_open_vacancies'=>DB::table('world_vacancies')->where('status','open')->count(),
                'career_employment_changes'=>DB::table('world_employments')->whereNotNull('ends_at')->count(),'career_policy_observations'=>DB::table('world_agent_memories')->count(),
                'career_explicit_delegations'=>DB::table('world_delegations')->where('enabled',true)->count(),'career_due_delegations'=>DB::table('world_delegations')->where('enabled',true)->where('review_at','<=',now())->count(),
                'economy_club_cash_minor_units'=>(int)DB::table('club_money_entries')->sum('amount'),'economy_insolvent_clubs'=>DB::query()->fromSub($balances,'balances')->where('balance','<',0)->count(),
                'economy_sponsor_available_minor_units'=>(int)DB::table('world_sponsor_entries')->sum('amount'),
                'economy_sponsor_escrow_minor_units'=>(int)DB::table('world_sponsor_deals')->whereIn('status',['offered','active'])->selectRaw('COALESCE(SUM(reserved_amount-paid_amount),0) AS total')->value('total'),
                'economy_sponsor_paid_minor_units'=>(int)DB::table('world_sponsor_deals')->sum('paid_amount'),
                'economy_player_weekly_agreed_minor_units'=>(int)DB::table('world_player_terms')->whereNotNull('active_player_id')->sum('weekly_salary')];
        });
    }
}
