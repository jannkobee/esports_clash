<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Services\{ClubOffice,OnlineService};
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class ClubOfficeController extends Controller {
    public function inbox(Request $r,OnlineService $online,ClubOffice $office){$v=$r->validate(['page'=>'nullable|integer|min:1|max:1000000','unread'=>'nullable|boolean']);return ['data'=>$office->inbox($online->provision($r->user()),$v['page']??1,(bool)($v['unread']??false))];}
    public function read(Request $r,OnlineService $online){$v=$r->validate(['ids'=>'required|array|min:1|max:100','ids.*'=>'required|integer|min:1|distinct']);DB::table('club_inbox')->where('club_id',$online->provision($r->user())->id)->whereIn('id',$v['ids'])->whereNull('read_at')->update(['read_at'=>now()]);return response()->noContent();}
    public function reports(Request $r,OnlineService $online,ClubOffice $office){$v=$r->validate(['page'=>'nullable|integer|min:1|max:1000000']);$club=$online->provision($r->user());$q=DB::table('club_weekly_reports')->where('club_id',$club->id);$count=(clone $q)->count();
        return ['data'=>['current'=>$office->report($club,CarbonImmutable::now('Asia/Manila')->startOfWeek()->utc()),'history'=>$q->orderByDesc('week')->offset((($v['page']??1)-1)*8)->limit(8)->get()->map(fn($r)=>['id'=>$r->id,'report'=>json_decode($r->report,true),'generated_at'=>$r->generated_at]),'meta'=>['page'=>$v['page']??1,'last_page'=>max(1,(int)ceil($count/8))]]];}
}
