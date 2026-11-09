<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Services\{CommunityCups,OnlineService};
use Illuminate\Http\Request;
class CommunityCupController extends Controller {
    public function index(Request $r,OnlineService $online,CommunityCups $cups){return ['data'=>$cups->desk($online->provision($r->user()))];}
    public function respond(Request $r,int $id,OnlineService $online,CommunityCups $cups){$v=$r->validate(['accept'=>'required|boolean']);$cups->respond($online->provision($r->user()),$id,$v['accept']);return response()->noContent();}
}
