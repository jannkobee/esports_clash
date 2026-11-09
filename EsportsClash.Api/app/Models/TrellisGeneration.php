<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class TrellisGeneration extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    public $incrementing=false;
    protected $keyType='string';
    protected $guarded=[];
    protected function casts(): array { return ['plan'=>'array','state'=>'array']; }
    protected static function booted():void {
        static::creating(function($run){
            $assets=\App\Models\GameContent::where('kind','avatar')->find($run->avatar_id)?->payload['assets']??[];
            $run->asset_epoch=$assets['epoch']??null;
        });
    }
    /** Filter usable payloads only; the ordinary history query remains unchanged. */
    public function scopeCurrentAssets($query) {
        $groups=\App\Models\GameContent::where('kind','avatar')->get()->filter(fn($row)=>isset($row->payload['assets']['epoch']))->groupBy(fn($row)=>$row->payload['assets']['epoch']);
        if($groups->isEmpty())return $query;
        $ids=$groups->flatten()->pluck('id')->all();
        return $query->where(function($outer)use($groups,$ids){
            $outer->whereNotIn('avatar_id',$ids);
            foreach($groups as $epoch=>$entries)$outer->orWhere(fn($part)=>$part->whereIn('avatar_id',$entries->pluck('id'))->where('asset_epoch',$epoch));
        });
    }
}
