<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineClub extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['lineup' => 'array']; }
}
