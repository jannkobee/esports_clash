<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->boolean('is_bot')->default(false);
            $table->timestampTz('academy_opened_at')->nullable();
        });
        Schema::table('owned_player_cards', function (Blueprint $table): void {
            $table->unsignedInteger('training_xp')->default(0);
        });
        Schema::create('club_training_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('match_id')->constrained('online_matches');
            $table->foreignUuid('card_id')->constrained('owned_player_cards');
            $table->unique(['match_id', 'card_id']);
            $table->unsignedInteger('xp');
            $table->timestampTz('processed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_training_sessions');
        Schema::table('owned_player_cards', function (Blueprint $table): void { $table->dropColumn('training_xp'); });
        Schema::table('online_clubs', function (Blueprint $table): void { $table->dropColumn(['is_bot', 'academy_opened_at']); });
    }
};
