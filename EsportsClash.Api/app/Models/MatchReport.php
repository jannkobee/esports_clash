<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'match_version', 'match_seed', 'winner', 'duration_seconds',
        'blue_kills', 'red_kills', 'report',
    ];

    protected function casts(): array
    {
        return [
            'report' => 'array',
            'match_seed' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
