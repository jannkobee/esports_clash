<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class WorldAgent extends Model {
    public $incrementing=false;protected $keyType='string';protected $guarded=[];
    protected function casts():array{return ['skills'=>'array','traits'=>'array','goals'=>'array','policy'=>'array','review_at'=>'immutable_datetime'];}
}
