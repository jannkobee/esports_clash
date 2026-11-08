<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineClub extends Model
{
    protected $guarded = [];
    public function user() { return $this->belongsTo(User::class); }
    protected function casts(): array
    {
        return ['lineup' => 'array', 'starters' => 'array', 'identity' => 'array', 'is_bot' => 'boolean', 'academy_opened_at' => 'immutable_datetime'];
    }
}
