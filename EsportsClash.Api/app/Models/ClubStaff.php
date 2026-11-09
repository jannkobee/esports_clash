<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubStaff extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['ratings' => 'array','founding_profile'=>'array'];
    }
}
