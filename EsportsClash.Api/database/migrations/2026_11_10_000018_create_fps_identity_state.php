<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fps_player_identities', function (Blueprint $table) {
            $table->foreignUuid('player_id')->primary()->constrained('owned_player_cards');
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->json('dna');
            $table->string('legacy_primary', 60)->nullable();
            $table->string('legacy_secondary', 60)->nullable();
            $table->string('personality_id', 60)->nullable();
            $table->string('specialty_id', 60)->nullable();
            $table->json('development');
            $table->timestampsTz();
        });
        Schema::create('fps_team_systems', function (Blueprint $table) {
            $table->foreignId('club_id')->primary()->constrained('online_clubs');
            $table->unsignedInteger('revision')->default(1);
            $table->json('gameplan');
            $table->json('culture');
            $table->timestampsTz();
        });
        Schema::create('fps_player_relationships', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('player_id')->constrained('owned_player_cards');
            $table->foreignUuid('teammate_id')->constrained('owned_player_cards');
            $table->json('relationship');
            $table->unsignedInteger('observations')->default(0);
            $table->timestampTz('updated_at');
            $table->unique(['player_id', 'teammate_id']);
        });
    }
    public function down(): void { /* Identity and relationship history is retained. */ }
};
