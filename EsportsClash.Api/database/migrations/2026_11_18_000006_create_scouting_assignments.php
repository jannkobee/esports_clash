<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Scouting the manager directs: a brief (position need and region), a paid search, then a shortlist of
 * three prospects with uncertain 1–10 estimates. Prospects become players only when signed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scouting_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->string('need', 24);
            $table->foreignId('region_id')->nullable()->constrained('competition_geographies');
            $table->bigInteger('cost');
            $table->unsignedTinyInteger('scout_quality');
            $table->string('status', 16)->default('searching');
            $table->json('shortlist')->nullable();
            $table->uuid('signed_player_id')->nullable();
            $table->timestampTz('ready_at');
            $table->timestampTz('expires_at')->nullable();
            $table->timestampsTz();
            $table->index(['club_id', 'status']);
            $table->index(['status', 'ready_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scouting_assignments');
    }
};
