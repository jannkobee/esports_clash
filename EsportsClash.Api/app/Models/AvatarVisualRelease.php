<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarVisualRelease extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['validation'=>'array','active'=>'boolean','health_report'=>'array','last_checked_at'=>'immutable_datetime','quarantined_at'=>'immutable_datetime']; }
}
