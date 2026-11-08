<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_friendly_invites', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('home_club_id')->constrained('online_clubs');
            $table->foreignId('away_club_id')->constrained('online_clubs');
            $table->timestampTz('kickoff_at');
            $table->unique(['home_club_id', 'away_club_id', 'kickoff_at'], 'club_invite_kickoff_unique');
            $table->foreignId('fixture_id')->nullable()->unique()->constrained('club_fixtures');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_friendly_invites');
    }
};
