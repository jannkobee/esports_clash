<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarEvolutionSetting extends Model
{
    protected $guarded = [];
    protected function casts(): array { return ['enabled'=>'boolean','avatar_ids'=>'array','next_cycle_at'=>'immutable_datetime','heartbeat_at'=>'immutable_datetime']; }
    public static function current(): self { return static::firstOrCreate(['id'=>1], ['avatar_ids'=>['c_invoker']]); }
}
