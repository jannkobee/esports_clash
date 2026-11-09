<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_player_match_ratings', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('match_id')->constrained('online_matches');
            $table->foreignUuid('card_id')->constrained('owned_player_cards');
            $table->foreignId('club_id')->nullable()->constrained('online_clubs')->nullOnDelete();
            $table->string('club_name', 80);
            $table->string('competition', 100);
            $table->boolean('won');
            $table->decimal('rating', 4, 2);
            $table->json('performance');
            $table->timestampTz('created_at');
            $table->unique(['match_id', 'card_id']);
            $table->index(['card_id', 'created_at']);
        });

        Schema::create('scrimmage_queue_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('club_id')->unique()->constrained('online_clubs')->cascadeOnDelete();
            $table->unsignedTinyInteger('tier');
            $table->decimal('rating', 5, 2);
            $table->json('lineup');
            $table->string('club_name', 80);
            $table->string('status', 20)->default('queued')->index();
            $table->foreignId('fixture_id')->nullable()->constrained('club_fixtures')->nullOnDelete();
            $table->timestampsTz();
            $table->index(['status', 'tier', 'created_at']);
        });

        Schema::create('club_trade_proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('proposer_id')->constrained('online_clubs');
            $table->foreignId('recipient_id')->constrained('online_clubs');
            $table->json('offered_player_ids');
            $table->json('requested_player_ids');
            $table->bigInteger('offered_cash')->default(0);
            $table->bigInteger('requested_cash')->default(0);
            $table->json('comparison');
            $table->string('status', 20)->default('pending')->index();
            $table->timestampTz('expires_at')->index();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();
            $table->index(['recipient_id', 'status', 'expires_at']);
            $table->index(['proposer_id', 'status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_trade_proposals');
        Schema::dropIfExists('scrimmage_queue_tickets');
        Schema::dropIfExists('club_player_match_ratings');
    }
};
