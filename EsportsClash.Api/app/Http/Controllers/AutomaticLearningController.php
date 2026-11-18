<?php
namespace App\Http\Controllers;
use App\Services\AutomaticLearningBundle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
final class AutomaticLearningController extends Controller
{
    public function show(AutomaticLearningBundle $bundles): JsonResponse|Response
    {
        $directory = rtrim(config('automatic_learning.models_path', base_path('AutomaticLearning/models')), '/\\').'/';
        // The append-only registry (promotion/rollback history) takes precedence over the legacy pointer.
        $manifest = is_file($directory.'registry.json')
            ? $this->registryActive(json_decode(file_get_contents($directory.'registry.json'), true, 512, JSON_THROW_ON_ERROR))
            : json_decode(file_get_contents($directory.'active.json'), true, 512, JSON_THROW_ON_ERROR);
        if (($manifest['bundle'] ?? null) === null) {
            return response()->json(['version' => 1, 'bundle' => null]);
        }
        abort_unless(is_string($manifest['bundle']) && preg_match('/^[a-f0-9]{64}\.json$/D', $manifest['bundle']), 503);
        $path = $directory.$manifest['bundle'];
        abort_unless(is_file($path), 503);
        $bytes = file_get_contents($path);
        abort_unless(is_string($manifest['sha256'] ?? null) && hash_equals($manifest['sha256'], hash('sha256', $bytes)), 503);
        try {
            $bundle = json_decode($bytes, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            abort(503);
        }
        abort_unless(is_array($bundle) && $bundles->valid($bundle), 503);
        // Serve the approved bytes verbatim: re-encoding would turn empty JSON objects (for example an
        // empty utility `spots` map) into arrays.
        return response('{"version":1,"sha256":'.json_encode($manifest['sha256']).',"bundle":'.trim($bytes).'}', 200, ['Content-Type' => 'application/json']);
    }

    /** Mirrors registryState() in infrastructure/automatic-learning/model.mjs. */
    private function registryActive(mixed $registry): array
    {
        abort_unless(is_array($registry) && ($registry['version'] ?? null) === 1 && is_array($registry['events'] ?? null), 503);
        $active = ['bundle' => null, 'sha256' => null];
        $promoted = [];
        foreach ($registry['events'] as $event) {
            $action = $event['action'] ?? null;
            if ($action === 'promote') {
                abort_unless(is_string($event['bundle'] ?? null) && preg_match('/^[a-f0-9]{64}\.json$/D', $event['bundle'])
                    && is_string($event['sha256'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $event['sha256']), 503);
                $promoted[$event['bundle']] = $event['sha256'];
                $active = ['bundle' => $event['bundle'], 'sha256' => $event['sha256']];
            } elseif ($action === 'rollback') {
                if (($event['bundle'] ?? null) === null) $active = ['bundle' => null, 'sha256' => null];
                else {
                    abort_unless(($promoted[$event['bundle']] ?? null) === ($event['sha256'] ?? false), 503);
                    $active = ['bundle' => $event['bundle'], 'sha256' => $event['sha256']];
                }
            } elseif (! in_array($action, ['pause', 'resume'], true)) abort(503);
        }
        return $active;
    }
}
