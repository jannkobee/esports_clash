<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScrimmageQueueTicket extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['lineup' => 'array', 'rating' => 'float'];
    }
}
