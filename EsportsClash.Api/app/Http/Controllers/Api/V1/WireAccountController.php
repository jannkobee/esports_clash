<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WireAccountController extends Controller
{
    private function project(object $a): array {
        return ['id'=>$a->id,'name'=>$a->name,'handle'=>$a->handle,'kind'=>$a->kind,'role'=>$a->role,'profile'=>json_decode($a->profile,true),'source_id'=>$a->source_id];
    }
    public function index(Request $r) {
        $v=$r->validate(['q'=>'nullable|string|max:80','kind'=>'nullable|in:player,organizer,tournament,game,talent,career','page'=>'nullable|integer|min:1|max:100000']);
        $q=DB::table('world_wire_accounts')->orderBy('name')->orderBy('id');
        if($v['q']??null)$q->where(fn($q)=>$q->whereRaw('LOWER(name) LIKE ?',['%'.mb_strtolower($v['q']).'%'])->orWhereRaw('LOWER(handle) LIKE ?',['%'.mb_strtolower($v['q']).'%']));
        if($v['kind']??null)$q->where('kind',$v['kind']);
        $rows=$q->paginate(20,['*'],'page',$v['page']??1);
        return ['data'=>$rows->getCollection()->map(fn($a)=>$this->project($a)),'meta'=>['page'=>$rows->currentPage(),'last_page'=>$rows->lastPage(),'total'=>$rows->total()]];
    }
    public function show(int $id) {
        $a=DB::table('world_wire_accounts')->find($id);abort_unless($a,404);
        $agent=app(\App\Services\WorldAgents::class)->ready()?\App\Models\WorldAgent::where('wire_account_id',$id)->first():null;
        return ['data'=>$this->project($a)+['world_state'=>app(\App\Services\WorldVoiceSimulation::class)->publicState($id),'career'=>$agent?app(\App\Services\WorldAgents::class)->publicProfile($agent):null]];
    }
    public function owned(Request $r) {
        return ['data'=>DB::table('world_wire_accounts as a')->join('competition_organizers as o',function($join){$join->on('a.source_id','=',DB::raw('CAST(o.id AS VARCHAR)'));})
            ->where('o.user_id',$r->user()->id)->where('a.kind','organizer')->orderBy('a.name')->get(['a.*'])->map(fn($a)=>$this->project($a))];
    }
}
