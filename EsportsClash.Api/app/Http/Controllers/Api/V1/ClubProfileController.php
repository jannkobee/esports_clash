<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClubProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ClubProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $profile = $request->user()->clubProfile;

        return response()->json(['data' => $profile ? $this->payload($profile) : null]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'schema_version' => ['nullable', 'integer', 'min:1', 'max:100'],
            'roster' => ['required', 'array', 'min:5', 'max:100'],
            'roster.*.id' => ['required', 'string', 'max:120', 'distinct'],
            'starting_five' => ['required', 'array', 'size:5'],
            'starting_five.*' => ['required', 'string', 'max:120', 'distinct'],
        ]);

        $rosterIds = collect($data['roster'])->pluck('id');
        $missingStarter = collect($data['starting_five'])->first(fn (string $id): bool => ! $rosterIds->contains($id));
        if ($missingStarter) {
            throw ValidationException::withMessages([
                'starting_five' => ['Every starter must be present in the saved roster.'],
            ]);
        }

        $profile = ClubProfile::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'schema_version' => $data['schema_version'] ?? 1,
                'roster' => $data['roster'],
                'starting_five' => $data['starting_five'],
            ],
        );

        return response()->json(['data' => $this->payload($profile)]);
    }

    private function payload(ClubProfile $profile): array
    {
        return [
            'schema_version' => $profile->schema_version,
            'roster' => $profile->roster,
            'starting_five' => $profile->starting_five,
            'updated_at' => $profile->updated_at?->toISOString(),
        ];
    }
}
