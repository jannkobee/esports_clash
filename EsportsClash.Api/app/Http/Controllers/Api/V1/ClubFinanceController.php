<?php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\{ClubFinances, OnlineService};
use Illuminate\Http\Request;

class ClubFinanceController extends Controller
{
    public function index(Request $request, OnlineService $online, ClubFinances $finances)
    {
        $data=$request->validate(['month'=>['sometimes','date_format:Y-m','after_or_equal:2000-01-01'], 'page'=>['sometimes','integer','min:1','max:100000']]);
        $club=$online->provision($request->user());
        app(\App\Services\ClubMarketService::class)->balance($club->id);
        return response()->json(['data'=>$finances->report($club,$data['month']??now('Asia/Manila')->format('Y-m'),(int)($data['page']??1))]);
    }
}
