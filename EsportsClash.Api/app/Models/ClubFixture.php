<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

class ClubFixture extends Model
{
    protected $guarded = [];
    protected $hidden = ['home_orders', 'away_orders'];

    protected function casts(): array
    {
        return ['kickoff_at' => 'immutable_datetime', 'orders_close_at' => 'immutable_datetime',
            'home_orders' => 'array', 'away_orders' => 'array'];
    }

    public function homeClub() { return $this->belongsTo(OnlineClub::class); }
    public function awayClub() { return $this->belongsTo(OnlineClub::class); }
    public function match() { return $this->belongsTo(OnlineMatch::class); }
    public function homeNation() { return $this->belongsTo(NationalTeam::class, 'home_national_team_id'); }
    public function awayNation() { return $this->belongsTo(NationalTeam::class, 'away_national_team_id'); }

    public static function conflicts(array $clubIds, CarbonInterface $kickoff): bool
    {
        $hours = \Illuminate\Support\Facades\Schema::hasTable('competition_settings')
            ? app(\App\Services\CompetitionCalendar::class)->settings()['recovery_hours'] : 1;
        $window = \Illuminate\Support\Facades\Schema::hasTable('competition_windows') && \Illuminate\Support\Facades\DB::table('competition_windows')
            ->where('starts_at','<',$kickoff->copy()->addHours($hours))->where('ends_at','>',$kickoff)->exists();
        return $window || static::whereBetween('kickoff_at', [$kickoff->copy()->subHours($hours), $kickoff->copy()->addHours($hours)])
            ->where(fn ($query) => $query->whereIn('home_club_id', $clubIds)->orWhereIn('away_club_id', $clubIds))->exists();
    }

    public static function awaitingSnapshot(int $clubId): bool
    {
        return static::whereNull('match_id')->whereNull('hold_reason')->where('orders_close_at', '<=', now())
            ->where(fn ($query) => $query->where('home_club_id', $clubId)->orWhere('away_club_id', $clubId))->exists();
    }
}
