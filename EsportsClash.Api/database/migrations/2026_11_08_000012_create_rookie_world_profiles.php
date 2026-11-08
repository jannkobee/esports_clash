<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('owned_player_cards', function (Blueprint $t) {
            $t->json('world_profile')->nullable();
            $t->foreignId('nationality_id')->nullable()->constrained('competition_geographies');
            $t->timestampTz('retired_at')->nullable()->index();
            $t->index(['nationality_id', 'retired_at'], 'world_player_nationality');
        });
        Schema::create('world_player_settings', function (Blueprint $t) {
            $t->id();
            $t->unsignedSmallInteger('profile_version')->default(0);
            $t->timestampTz('activated_at')->nullable();
        });
        DB::table('world_player_settings')->insert(['id' => 1, 'profile_version' => 0]);
        Schema::create('bot_club_plans', function (Blueprint $t) {
            $t->foreignId('club_id')->primary()->constrained('online_clubs');
            $t->json('plan');
            $t->timestampTz('reviewed_at');
        });
        Schema::table('player_national_eligibilities', fn (Blueprint $t) => $t->unsignedBigInteger('verified_by')->nullable()->change());
    }

    public function down(): void
    {
        throw new RuntimeException('Player nationality, profiles and retirement history require a reviewed rollback.');
    }
};
