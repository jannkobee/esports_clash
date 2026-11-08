<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\{OnlineService, ScrimmageQueueService};
use Illuminate\Http\Request;

class ScrimmageQueueController extends Controller
{
    public function join(Request $request, OnlineService $online, ScrimmageQueueService $queue)
    {
        abort_if($request->all() !== [], 422, 'Scrimmage matchmaking uses only your saved lineup and server-computed squad rating.');
        return response()->json(['data' => $queue->join($request->user(), $online)], 202);
    }

    public function leave(Request $request, ScrimmageQueueService $queue)
    {
        $queue->leave($request->user());
        return response()->noContent();
    }
}
