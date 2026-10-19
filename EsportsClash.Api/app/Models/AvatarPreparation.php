<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarPreparation extends Model {
    use \Illuminate\Database\Eloquent\SoftDeletes;

    public $incrementing=false;
    protected $keyType='string';
    protected $guarded=[];
    protected function casts():array{return ['plan'=>'array','state'=>'array','progress'=>'array','control'=>'array'];}
}
