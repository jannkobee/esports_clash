<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Services\{ClubMatchHistory,OnlineService};
use Illuminate\Http\Request;
class ClubHistoryController extends Controller {
 public function __invoke(Request $r,OnlineService $online,ClubMatchHistory $history){$v=$r->validate(['view'=>'nullable|in:fixtures,archive','status'=>'nullable|in:played,all,verified,wins,losses,interrupted,upcoming','kind'=>'nullable|in:all,tournaments,scrimmages,community','q'=>'nullable|string|max:100','from'=>'nullable|date_format:Y-m-d','to'=>'nullable|date_format:Y-m-d','sort'=>'nullable|in:newest,oldest','page'=>'nullable|integer|min:1|max:1000000','per_page'=>'nullable|integer|in:20,50']);return ['data'=>$history->page($online->provision($r->user()),$v)];}
}
