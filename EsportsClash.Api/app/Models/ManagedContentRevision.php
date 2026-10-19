<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class ManagedContentRevision extends Model {
    public $timestamps = false;
    protected $guarded = [];
    protected function casts(): array { return ['payload'=>'array', 'created_at'=>'datetime']; }
}
