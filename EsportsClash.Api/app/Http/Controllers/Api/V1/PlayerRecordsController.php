<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Services\{AnnualLaurels,PlayerRecordBook};
use Illuminate\Http\Request;
class PlayerRecordsController extends Controller {
 public function records(Request $r,string $id,PlayerRecordBook $book){$v=$r->validate(['scope'=>'nullable|in:ranked,scrimmage,community,exhibition','year'=>'nullable|integer|min:2020|max:2200','q'=>'nullable|string|max:100','page'=>'nullable|integer|min:1|max:1000000','per_page'=>'nullable|integer|in:20,50']);return ['data'=>$book->page($id,$v)];}
 public function awards(Request $r,AnnualLaurels $awards){$v=$r->validate(['year'=>'nullable|integer|min:2020|max:2200']);return ['data'=>$awards->show($v['year']??now('Asia/Manila')->year)];}
}
