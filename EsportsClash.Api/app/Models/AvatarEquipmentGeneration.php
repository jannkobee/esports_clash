<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarEquipmentGeneration extends Model {
    public $incrementing=false;
    protected $keyType='string';
    protected $guarded=[];
    protected function casts():array{return ['plan'=>'array','state'=>'array','installed_at'=>'datetime'];}
}
