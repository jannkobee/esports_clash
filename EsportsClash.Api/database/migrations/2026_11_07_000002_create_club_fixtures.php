<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_matches', function (Blueprint $table): void {
            $table->timestampTz('started_at')->nullable();
            $table->boolean('spectator_ready')->default(false);
        });
        Schema::create('club_fixtures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('home_club_id')->constrained('online_clubs');
            $table->foreignId('away_club_id')->constrained('online_clubs');
            $table->string('competition', 100);
            $table->timestampTz('kickoff_at')->index();
            $table->timestampTz('orders_close_at')->index();
            $table->json('home_orders')->nullable();
            $table->json('away_orders')->nullable();
            $table->foreignUuid('match_id')->nullable()->unique()->constrained('online_matches');
            $table->string('hold_reason')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_fixtures');
        Schema::table('online_matches', function (Blueprint $table): void {
            $table->dropColumn(['started_at', 'spectator_ready']);
        });
    }
};
