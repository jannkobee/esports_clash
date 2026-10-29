<?php
namespace App\Http\Controllers;
use App\Services\IntelligenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class IntelligenceController extends Controller {
    private function owner(Request $r):string{abort_unless($r->user()?->is_evolution_admin,403);return 'user:'.$r->user()->id;}
    public function manifest(IntelligenceService $s){return response()->json($s->manifest())->header('Cache-Control','no-store');}
    public function configure(Request $r,IntelligenceService $s){$actor=$this->owner($r);$data=$r->validate([
        'enabled'=>'required|boolean','preview_learning'=>'sometimes|boolean','cycle_domains'=>'sometimes|boolean','domain'=>'required|in:parameter,marl,source,arena','max_minutes'=>'required|integer|min:16|max:90',
        'total_minutes'=>'required|integer|min:16|max:10080','generations'=>'required|integer|min:1|max:8',
        'training_matches'=>'required|integer|min:1|max:16']);$s->configure($data,$actor);
        return $r->expectsJson()?response()->json(['data'=>$data]):back()->with('status','Intelligence automation saved.');}
    public function start(Request $r,IntelligenceService $s){
        $actor=$this->owner($r);$data=$r->validate(['request_id'=>'required|uuid','domain'=>'required|in:parameter,marl,source,arena',
            'max_minutes'=>'sometimes|integer|min:16|max:90','total_minutes'=>'sometimes|integer|min:16|max:10080',
            'generations'=>'sometimes|integer|min:1|max:8','training_matches'=>'sometimes|integer|min:1|max:16']);
        $run=$s->start($data,$actor);return $r->expectsJson()?response()->json(['data'=>$run],202):back()->with('status','Intelligence study queued.');
    }
    public function resume(Request $r,string $id,IntelligenceService $s){$run=$s->resume($id,$this->owner($r));return $r->expectsJson()?response()->json(['data'=>$run],202):back()->with('status','Study resumed with its original seeds and checkpoints.');}
    public function activate(Request $r,string $id,IntelligenceService $s){$manifest=$s->activate($id,$this->owner($r));return $r->expectsJson()?response()->json($manifest):back()->with('status','Qualified policy activated for new matches.');}
    public function rollback(Request $r,IntelligenceService $s){$actor=$this->owner($r);$data=$r->validate(['policy_id'=>'nullable|string|size:64']);$manifest=$s->rollback($data['policy_id']??null,$actor);return $r->expectsJson()?response()->json($manifest):back()->with('status','Policy restored for new matches.');}
}
