<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubFriendlyInvite extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['kickoff_at' => 'immutable_datetime']; }
    public function homeClub() { return $this->belongsTo(OnlineClub::class); }
}
