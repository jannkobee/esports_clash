<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvolutionRun extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['plan' => 'array', 'progress' => 'array', 'result' => 'array',
            'started_at' => 'immutable_datetime', 'finished_at' => 'immutable_datetime'];
    }
}
