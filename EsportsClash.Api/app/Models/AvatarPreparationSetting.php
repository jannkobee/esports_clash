<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarPreparationSetting extends Model {
    protected $guarded=[];
    protected function casts():array{return ['enabled'=>'boolean'];}
    public static function current():self{return static::firstOrCreate(['id'=>1],['enabled'=>false]);}
}
