<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarEvolutionRun extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['plan'=>'array','report'=>'array','decisions'=>'array']; }
}
