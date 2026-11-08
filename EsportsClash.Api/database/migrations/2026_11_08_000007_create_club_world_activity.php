<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('club_world_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_key', 180)->unique();
            $table->string('kind', 40)->index();
            $table->foreignId('actor_club_id')->nullable()->constrained('online_clubs')->nullOnDelete();
            $table->string('message', 500);
            $table->json('payload');
            $table->timestampTz('occurred_at')->index();
        });
        Schema::create('club_world_turns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->timestampTz('window_at');
            $table->timestampTz('completed_at');
            $table->json('summary');
            $table->unique(['club_id', 'window_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_world_turns');
        Schema::dropIfExists('club_world_events');
    }
};
