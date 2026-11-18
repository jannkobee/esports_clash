<?php

use App\Models\OnlineMatch;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fixture-level facts a manager reads at a glance: the map (announced when orders open), the verified
 * outcome and round score (copied at settlement, so lists never load whole match results) and optional
 * per-fixture tactical plans. Additive; existing settled fixtures are backfilled only from verified results.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_fixtures', function (Blueprint $table) {
            $table->string('map_id', 40)->nullable();
            $table->string('result_winner', 8)->nullable();
            $table->json('result_score')->nullable();
            $table->json('home_plan')->nullable();
            $table->json('away_plan')->nullable();
        });
        DB::table('club_fixtures')->whereNotNull('match_id')->orderBy('id')->select(['id', 'match_id'])->chunkById(200, function ($rows) {
            foreach ($rows as $row) {
                $match = OnlineMatch::find($row->match_id);
                $winner = $match?->verifiedWinner();
                if ($winner === null) continue;
                DB::table('club_fixtures')->where('id', $row->id)->update(['result_winner' => $winner,
                    'result_score' => ($score = $match->finalScore()) ? json_encode($score + ['map' => $match->result['report']['mapId'] ?? null, 'map_name' => $match->result['report']['mapName'] ?? null]) : null,
                    'map_id' => $match->plan['fps']['map_id'] ?? null]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('club_fixtures', function (Blueprint $table) {
            $table->dropColumn(['map_id', 'result_winner', 'result_score', 'home_plan', 'away_plan']);
        });
    }
};
