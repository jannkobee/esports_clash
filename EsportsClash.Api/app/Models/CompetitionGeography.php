<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CompetitionGeography extends Model
{
    public $timestamps = false;
    protected $guarded = [];
    public function path(): array
    {
        $path = []; $node = $this;
        for ($depth=0; $node && $depth<5; $depth++) { $path[]=$node->id; $node=$node->parent_id ? self::find($node->parent_id) : null; }
        return $path;
    }
}
