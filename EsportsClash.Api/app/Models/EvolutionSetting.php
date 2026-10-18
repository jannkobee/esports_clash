<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvolutionSetting extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'preferences' => 'array', 'next_training_at' => 'immutable_datetime'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], ['preferences' => ['prefer_small_changes' => true]]);
    }
}
