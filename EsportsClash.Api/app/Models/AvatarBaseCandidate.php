<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AvatarBaseCandidate extends Model {
    public $incrementing=false;protected $keyType='string';protected $guarded=[];
    protected function casts():array{return ['report'=>'array','artifacts'=>'array'];}
}
