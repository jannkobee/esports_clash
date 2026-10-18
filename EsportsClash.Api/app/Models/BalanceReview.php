<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceReview extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['preferences' => 'array', 'deadline_at' => 'immutable_datetime', 'decided_at' => 'immutable_datetime'];
    }

    public function proposals()
    {
        return $this->hasMany(BalanceProposal::class, 'review_id');
    }
}
