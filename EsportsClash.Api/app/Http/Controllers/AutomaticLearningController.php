<?php
namespace App\Http\Controllers;
use Illuminate\Http\JsonResponse;
final class AutomaticLearningController extends Controller
{
    public function show(): JsonResponse
    {
        $directory = base_path('AutomaticLearning/models/');
        $manifest = json_decode(file_get_contents($directory.'active.json'), true, 512, JSON_THROW_ON_ERROR);
        if (($manifest['bundle'] ?? null) === null) {
            return response()->json(['version' => 1, 'bundle' => null]);
        }
        abort_unless(preg_match('/^[a-f0-9]{64}\.json$/D', $manifest['bundle']), 503);
        $path = $directory.$manifest['bundle'];
        abort_unless(is_file($path), 503);
        $bytes = file_get_contents($path);
        abort_unless(hash_equals($manifest['sha256'], hash('sha256', $bytes)), 503);
        return response()->json(['version' => 1, 'sha256' => $manifest['sha256'], 'bundle' => json_decode($bytes, true, 512, JSON_THROW_ON_ERROR)]);
    }
}
