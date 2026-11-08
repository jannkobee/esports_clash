<?php
namespace App\Services;

use App\Models\{ClubAuction, ClubTradeProposal, OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ClubFinances
{
    private const ESCROW = ['Bid reserved','Bid released','Bid refunded','Trade offer escrow','Trade offer refunded'];

    public function report(OnlineClub $club, string $month, int $page): array
    {
        $from = CarbonImmutable::createFromFormat('!Y-m', $month, 'Asia/Manila')->startOfMonth()->utc();
        $to = $from->setTimezone('Asia/Manila')->addMonth()->utc();
        $asOf = CarbonImmutable::now('UTC');
        return DB::transaction(function () use ($club, $from, $to, $asOf, $page, $month) {
            // One consistent view while auctions and payroll may settle in other processes.
            DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            $query = DB::table('club_money_entries')->where('club_id', $club->id);
            $available = (int)(clone $query)->sum('amount');
            $auctionHeld = (int)ClubAuction::where('bidder_id', $club->id)->where('status','open')->sum('bid');
            $tradeHeld = (int)ClubTradeProposal::where('proposer_id',$club->id)->where('status','pending')->sum('offered_cash');
            $period = (clone $query)->where('created_at','>=',$from)->where('created_at','<',$to);
            $entries = (clone $period)->orderByDesc('created_at')->orderByDesc('id')->paginate(25, ['id','amount','kind','reference','created_at'], 'page', $page);
            $realized = (clone $period)->whereNotIn('kind', [...self::ESCROW, 'Opening balance'])->get(['kind','amount','created_at']);
            // Buying consumes an earlier reservation: recognize it once, on settlement.
            foreach (ClubAuction::where('bidder_id',$club->id)->where('status','sold')->where('updated_at','>=',$from)->where('updated_at','<',$to)->get() as $a) {
                $realized->push((object)['kind'=>'Player purchase','amount'=>-$a->bid,'created_at'=>$a->updated_at]);
            }
            foreach (ClubTradeProposal::where('proposer_id',$club->id)->where('status','accepted')->where('resolved_at','>=',$from)->where('resolved_at','<',$to)->where('offered_cash','>',0)->get() as $t) {
                $realized->push((object)['kind'=>'Trade cash paid','amount'=>-$t->offered_cash,'created_at'=>$t->resolved_at]);
            }
            $income = (int)$realized->where('amount','>',0)->sum('amount');
            $expenses = -(int)$realized->where('amount','<',0)->sum('amount');
            $categories = $realized->groupBy('kind')->map(fn($rows,$kind)=>['name'=>$kind,'income'=>(int)$rows->where('amount','>',0)->sum('amount'),'expenses'=>-(int)$rows->where('amount','<',0)->sum('amount')])->values();
            $staff = app(StaffContracts::class)->weeklySalary($club->id);
            $weekly = app(ClubMarketService::class)->weeklyWages($club);
            $youth = $club->academy_opened_at ? ClubMarketService::YOUTH_COACH_WAGE : 0;
            $daily = $realized->groupBy(fn($e)=>CarbonImmutable::parse($e->created_at)->setTimezone('Asia/Manila')->format('Y-m-d'))->map(fn($rows,$date)=>['date'=>$date,'income'=>(int)$rows->where('amount','>',0)->sum('amount'),'expenses'=>-(int)$rows->where('amount','<',0)->sum('amount')])->sortBy('date')->values();
            return ['currency'=>'PHP','month'=>$month,'as_of'=>$asOf->toIso8601String(),
                'cash'=>['available'=>$available,'auction_escrow'=>$auctionHeld,'trade_escrow'=>$tradeHeld,'including_escrow'=>$available+$auctionHeld+$tradeHeld],
                'statement'=>['income'=>$income,'expenses'=>$expenses,'net'=>$income-$expenses,'capital'=>(int)(clone $period)->where('kind','Opening balance')->sum('amount'),
                    'opening_available'=>(int)(clone $query)->where('created_at','<',$from)->sum('amount'),'net_cash_movement'=>(int)(clone $period)->sum('amount')],
                'payroll'=>['players'=>$weekly-$staff-$youth,'staff'=>$staff,'academy'=>$youth,'weekly'=>$weekly,'four_week_reserve'=>$weekly*4,'weeks_covered'=>$weekly>0?round(max(0,$available)/$weekly,1):null],
                'categories'=>$categories,'daily'=>$daily,'ledger'=>$entries->items(),'page'=>$entries->currentPage(),'pages'=>$entries->lastPage(),'total'=>$entries->total(),
                'basis'=>'Settled income and expenses in Manila calendar months. Capital and refundable reservations are excluded from operating totals. Purchases are recognized at settlement, not when a bid is held. Ledger shows movements in available money; it therefore differs from the income statement. Payroll budget uses current contracts and assumes no future revenue; contract expiry and future roster changes may alter it.'];
        });
    }
}
