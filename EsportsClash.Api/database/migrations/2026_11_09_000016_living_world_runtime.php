<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table) {
            $table->unsignedInteger('management_epoch')->default(1);
            $table->timestampTz('world_review_at')->nullable();
            $table->index(['is_bot', 'world_review_at', 'id'], 'world_due_clubs');
        });
        Schema::create('living_world_runtime', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->string('management_state', 24);
            $table->timestampTz('retired_at')->nullable();
            $table->unsignedBigInteger('event_cursor')->default(0);
            $table->unsignedBigInteger('news_cursor')->default(0);
            $table->timestampTz('last_tick_at')->nullable();
            $table->timestampTz('last_sync_at')->nullable();
            $table->timestampTz('last_voice_at')->nullable();
            $table->timestampTz('last_media_at')->nullable();
            $table->unsignedBigInteger('media_event_cursor')->default(0);
            $table->json('metrics')->nullable();
            $table->timestampTz('updated_at');
        });
        // Existing worlds migrate in place. No clubs, contracts or queued commitments are removed.
        $bots = DB::table('online_clubs')->where('is_bot', true)->exists();
        DB::table('living_world_runtime')->insert(['id'=>1,
            'management_state'=>$bots?'active':'awaiting_population', 'event_cursor'=>(int)DB::table('club_world_events')->max('id'), 'updated_at'=>now()]);
    }

    public function down(): void
    {
        // Operational history and ownership epochs must survive rollback of application code.
    }
};
