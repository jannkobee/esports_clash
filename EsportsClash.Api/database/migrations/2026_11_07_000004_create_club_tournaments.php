<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->unsignedTinyInteger('tier')->default(5);
        });
        Schema::create('club_tournaments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('tier');
            $table->unique(['year', 'tier']);
            $table->timestampTz('registration_closes_at');
            $table->timestampTz('semifinals_at');
            $table->timestampTz('final_at');
            $table->bigInteger('champion_prize');
            $table->bigInteger('runner_up_prize');
            $table->string('status')->default('registration')->index();
            $table->foreignId('champion_id')->nullable()->constrained('online_clubs');
            $table->timestampsTz();
        });
        Schema::create('club_tournament_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tournament_id')->constrained('club_tournaments');
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->unique(['tournament_id', 'club_id']);
        });
        Schema::table('club_fixtures', function (Blueprint $table): void {
            $table->foreignId('tournament_id')->nullable()->constrained('club_tournaments');
            $table->unsignedTinyInteger('bracket_slot')->nullable();
            $table->unique(['tournament_id', 'bracket_slot']);
        });
    }

    public function down(): void
    {
        Schema::table('club_fixtures', function (Blueprint $table): void {
            $table->dropUnique(['tournament_id', 'bracket_slot']);
            $table->dropConstrainedForeignId('tournament_id');
            $table->dropColumn('bracket_slot');
        });
        Schema::dropIfExists('club_tournament_entries');
        Schema::dropIfExists('club_tournaments');
        Schema::table('online_clubs', function (Blueprint $table): void { $table->dropColumn('tier'); });
    }
};
