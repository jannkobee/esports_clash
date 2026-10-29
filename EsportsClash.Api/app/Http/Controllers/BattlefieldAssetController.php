<?php

namespace App\Http\Controllers;

use App\Models\TrellisGeneration;
use App\Services\TrellisGenerationService;
use App\Services\AvatarAssetPromptService;
use Illuminate\Http\Request;

class BattlefieldAssetController extends Controller
{
    public function index(Request $request, TrellisGenerationService $service)
    {
        $rawWorld = $service->worldCatalog();
        $operations = $service->operations();
        $references = $service->references($operations);
        $activeRuns = TrellisGeneration::whereIn('status', [...TrellisGenerationService::ACTIVE, 'cancelling'])->get();
        $completedModels = TrellisGeneration::withTrashed()
            ->currentAssets()
            ->where('status', 'generated_unqualified')
            ->latest()
            ->get()
            ->unique('avatar_id')
            ->keyBy('avatar_id');

        // Group into 3 tactical MOBA categories
        $groups = [
            'structures' => [
                'title' => 'Structures & Defensive Spire Network',
                'description' => 'Lane turrets, barracks inhibitors, and Ancient Nexus cores. Rigid unrigged geometry with high-poly architectural silhouettes and levitating crystal apex sockets.',
                'icon' => '🏰',
                'assets' => [],
            ],
            'environment' => [
                'title' => 'Battlefield Terrain, Flora & Ambient Wildlife',
                'description' => 'Granite boulders, canyon cliffs, spirit trees, river ambush brush, and ambient river critters (Amber Frog, Dragonfly, Pebble Crab). Unrigged static ground props and ambient wildlife.',
                'icon' => '🌲',
                'assets' => [],
            ],
            'creeps' => [
                'title' => 'Combat Minions, Jungle Guardians & Epic Bosses',
                'description' => 'Melee, caster, cannon, and super minions plus Dragon Embermaw and Siege Golem Gravemarch. Moving units engineered for skeletal rigging, joint pivots, and combat animations.',
                'icon' => '⚔️',
                'assets' => [],
            ],
        ];

        foreach ($rawWorld as $asset) {
            $cat = $asset['category'] ?? 'environment';
            $subcat = $asset['subcategory'] ?? 'prop';

            if ($cat === 'structure') {
                $groups['structures']['assets'][] = $asset;
            } elseif ($cat === 'creep' || in_array($subcat, ['boss', 'jungle', 'minion'], true)) {
                $groups['creeps']['assets'][] = $asset;
            } else {
                $groups['environment']['assets'][] = $asset;
            }
        }

        $stats = [
            'total' => count($rawWorld),
            'environment' => count($groups['environment']['assets']),
            'structures' => count($groups['structures']['assets']),
            'creeps' => count($groups['creeps']['assets']),
            'has_ref' => count(array_filter($rawWorld, fn($a) => isset($references[$a['id']]))),
            'generated' => count(array_filter($rawWorld, fn($a) => $completedModels->has($a['id']))),
            'queued' => count(array_filter($rawWorld, fn($a) => $activeRuns->contains('avatar_id', $a['id']))),
        ];

        return response()->view('evolution.battlefield.index', [
            'groups' => $groups,
            'stats' => $stats,
            'operations' => $operations,
            'computePreference' => $service->computePreference(),
            'references' => $references,
            'activeRuns' => $activeRuns,
            'completedModels' => $completedModels,
            'runs' => TrellisGeneration::whereIn('avatar_id', collect($rawWorld)->pluck('id'))
                ->latest()
                ->limit(50)
                ->get()
                ->sortBy('created_at')
                ->values(),
        ])->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, string $asset, TrellisGenerationService $service, AvatarAssetPromptService $promptService)
    {
        $all = collect($service->worldCatalog());
        $meta = $all->firstWhere('id', $asset);
        abort_unless($meta, 404);

        $operations = $service->operations();
        $currentReference = $service->currentReference($asset, $operations ?? []);
        $models = TrellisGeneration::withTrashed()
            ->currentAssets()
            ->where('avatar_id', $asset)
            ->where('status', 'generated_unqualified')
            ->oldest()
            ->get();

        $completedModel = $request->filled('model')
            ? $models->firstWhere('id', $request->query('model'))
            : $models->last();

        if ($request->filled('model')) {
            abort_unless($completedModel, 404);
        }

        $prompts = $promptService->prompts($meta, []);
        $runs = TrellisGeneration::where('avatar_id', $asset)
            ->latest()
            ->limit(50)
            ->get()
            ->sortBy('created_at')
            ->values();

        $isStatic = in_array($meta['category'] ?? 'environment', ['environment', 'structure'], true)
            && ($meta['subcategory'] ?? '') !== 'critter';

        return response()->view('evolution.battlefield.show', [
            'asset' => $meta,
            'isStatic' => $isStatic,
            'currentReference' => $currentReference,
            'completedModel' => $completedModel,
            'models' => $models,
            'prompts' => $prompts,
            'runs' => $runs,
            'operations' => $operations,
            'computePreference' => $service->computePreference(),
        ])->header('Cache-Control', 'no-store');
    }

    public function generate(Request $request, string $asset, TrellisGenerationService $service)
    {
        $all = collect($service->worldCatalog());
        abort_unless($all->contains('id', $asset), 404);

        $seed = app()->environment('testing') && $request->filled('seed')
            ? (int)$request->input('seed')
            : random_int(0, 2147483647);

        $service->start('user:'.$request->user()->id, $seed, $asset, true);

        return redirect()->back(fallback: route('battlefield.show', $asset))
            ->with('status', "3D generation job queued for {$asset}. Dispatched to Google Colab TRELLIS.2.");
    }
}

