<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubTournament extends Model
{
    public const ORGANIZER = 'Signal Circuit';
    public const SPONSOR = 'Lantern Relay';
    public const RULES = 'Four clubs in a single-elimination bracket. Registration order seeds the bracket. Eligible bot clubs may fill vacancies. Each fixture is one Arena game. Orders close 15 minutes before kickoff. Verified results advance the bracket. An interrupted match or fixture conflict puts the event under review.';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['registration_opens_at'=>'immutable_datetime','starts_at'=>'immutable_datetime','ends_at'=>'immutable_datetime','frozen_at'=>'immutable_datetime',
            'regulations'=>'array','qualification'=>'array','sponsors'=>'array','ranked'=>'boolean',
            'registration_closes_at' => 'immutable_datetime', 'semifinals_at' => 'immutable_datetime',
            'final_at' => 'immutable_datetime', 'champion_prize' => 'integer', 'runner_up_prize' => 'integer'];
    }

    public function title(): string { return $this->name ?? "{$this->year} Manila Signal Open · Tier {$this->tier}"; }
    public function fixtures() { return $this->hasMany(ClubFixture::class, 'tournament_id'); }
}
