<?php
namespace App\Http\Controllers;
use App\Services\AutomaticLearningBundle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
final class AutomaticLearningController extends Controller
{
    public function show(AutomaticLearningBundle $bundles): JsonResponse|Response
    {
        $approved = $bundles->approved();
        if ($approved === null) return response()->json(['version' => 1, 'bundle' => null]);

        // Serve the original JSON so empty maps keep their object shape.
        return response('{"version":1,"sha256":'.json_encode($approved['sha256']).',"bundle":'.trim($approved['bytes']).'}', 200, ['Content-Type' => 'application/json']);
    }
}
