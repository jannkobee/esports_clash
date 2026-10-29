<?php
namespace App\Models;
use Illuminate\Database\Eloquent\{Model, SoftDeletes};
class GameContent extends Model {
    use SoftDeletes;
    public $incrementing=false;
    protected $keyType='string';
    protected $guarded=[];
    protected $attributes=['version'=>1,'builtin'=>false];
    protected function casts():array { return ['payload'=>'array','version'=>'integer','builtin'=>'boolean']; }
}
