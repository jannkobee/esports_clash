<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_fixtures', function (Blueprint $table) {
            // Games on one stream of a tournament go on air one after another.
            $table->unsignedSmallInteger('broadcast_stream')->default(0);
            $table->index(['tournament_id', 'broadcast_stream', 'kickoff_at']);
        });
        Schema::table('online_matches', function (Blueprint $table) {
            // When the live broadcast actually starts: kickoff, or later if the previous game ran long.
            $table->timestampTz('on_air_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('online_matches', fn (Blueprint $table) => $table->dropColumn('on_air_at'));
        Schema::table('club_fixtures', function (Blueprint $table) {
            $table->dropIndex(['tournament_id', 'broadcast_stream', 'kickoff_at']);
            $table->dropColumn('broadcast_stream');
        });
    }
};
