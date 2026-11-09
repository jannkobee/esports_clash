<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubTradeProposal extends Model
{
    protected $guarded = [];

    public function proposer() { return $this->belongsTo(OnlineClub::class, 'proposer_id'); }
    public function recipient() { return $this->belongsTo(OnlineClub::class, 'recipient_id'); }

    protected function casts(): array
    {
        return [
            'offered_player_ids' => 'array',
            'requested_player_ids' => 'array',
            'comparison' => 'array',
            'offered_cash' => 'integer',
            'requested_cash' => 'integer',
            'expires_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }
}
