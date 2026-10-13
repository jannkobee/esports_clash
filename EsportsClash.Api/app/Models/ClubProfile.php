<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClubProfile extends Model
{
    use HasFactory;

    protected $fillable = ['schema_version', 'roster', 'starting_five'];

    protected function casts(): array
    {
        return [
            'roster' => 'array',
            'starting_five' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
