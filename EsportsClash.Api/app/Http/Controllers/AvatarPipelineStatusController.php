<?php
namespace App\Http\Controllers;

use App\Services\AvatarPipelineStatusService;
use Illuminate\Http\Request;

class AvatarPipelineStatusController extends Controller {
    public function __invoke(Request $request,AvatarPipelineStatusService $service) {
        abort_unless($request->user()?->is_evolution_admin,403,'Avatar pipeline status requires the designated owner account.');
        return response()->json(['data'=>$service->snapshot()])->header('Cache-Control','private, no-store');
    }
}
