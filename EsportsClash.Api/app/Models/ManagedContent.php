<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class ManagedContent extends Model {
    use HasUuids;
    protected $guarded = [];
    protected $attributes = ['status'=>'draft','version'=>1];
    protected function casts(): array { return ['payload'=>'array', 'version'=>'integer']; }
    public function revisions() { return $this->hasMany(ManagedContentRevision::class, 'content_id'); }
}
