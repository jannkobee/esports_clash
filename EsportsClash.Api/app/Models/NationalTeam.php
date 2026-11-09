<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class NationalTeam extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['tactics'=>'array']; }
    public function geography() { return $this->belongsTo(CompetitionGeography::class); }
}
