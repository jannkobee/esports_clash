<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubAuction extends Model
{
    protected $guarded = [];
    protected function casts(): array
    {
        return ['closes_at' => 'immutable_datetime', 'bid' => 'integer', 'opening_bid' => 'integer'];
    }
    public function card() { return $this->belongsTo(OwnedPlayerCard::class); }
    public function seller() { return $this->belongsTo(OnlineClub::class, 'seller_id'); }
    public function bidder() { return $this->belongsTo(OnlineClub::class, 'bidder_id'); }
}
