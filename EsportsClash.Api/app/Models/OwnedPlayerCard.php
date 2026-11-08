<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OwnedPlayerCard extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array {return ['world_profile'=>'array','retired_at'=>'immutable_datetime'];}
    protected static function booted(): void
    {
        static::addGlobalScope('activeWorldPlayer',function($query){
            if(app(\App\Services\WorldPlayerProfiles::class)->enabled())$query->whereNull('owned_player_cards.retired_at');
        });
    }
}
