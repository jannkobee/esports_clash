<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CompetitionDefinition extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['rules'=>'array','schedule'=>'array','sponsors'=>'array','official'=>'boolean','ranked'=>'boolean']; }
}
