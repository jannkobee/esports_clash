<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineCatalog extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['active' => 'boolean', 'manifest' => 'array', 'payload' => 'array']; }
}
