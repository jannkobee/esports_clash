<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('competition_geographies', function (Blueprint $t) {
            $t->id(); $t->string('code', 20)->unique(); $t->string('name', 100);
            $t->string('kind', 20); $t->foreignId('parent_id')->nullable()->constrained('competition_geographies');
            $t->string('timezone', 64)->default('UTC'); $t->boolean('eligible')->default(true);
            $t->index(['parent_id', 'kind']);
        });
        Schema::table('online_clubs', function (Blueprint $t) {
            $t->foreignId('geography_id')->nullable()->constrained('competition_geographies');
        });
        Schema::create('competition_organizers', function (Blueprint $t) {
            $t->id(); $t->foreignId('user_id')->nullable()->constrained('users');
            $t->string('slug', 100)->unique(); $t->string('name', 100); $t->string('category', 24)->default('community');
            $t->string('status', 24)->default('pending')->index(); $t->json('branding')->nullable(); $t->timestampsTz();
        });
        Schema::create('competition_definitions', function (Blueprint $t) {
            $t->id(); $t->foreignId('organizer_id')->constrained('competition_organizers');
            $t->string('slug', 100)->unique(); $t->string('name', 100); $t->string('category', 40);
            $t->string('participant_type', 16)->default('club'); $t->boolean('official')->default(false);
            $t->boolean('ranked')->default(false); $t->string('status', 20)->default('draft')->index();
            $t->unsignedInteger('version')->default(1); $t->json('rules'); $t->json('schedule');
            $t->json('sponsors')->nullable(); $t->timestampsTz();
        });
        Schema::create('national_teams', function (Blueprint $t) {
            $t->id(); $t->foreignId('geography_id')->unique()->constrained('competition_geographies');
            $t->string('name', 100); $t->string('flag', 16)->nullable(); $t->json('tactics')->nullable(); $t->timestampsTz();
        });
        Schema::create('national_manager_terms', function (Blueprint $t) {
            $t->id(); $t->foreignId('national_team_id')->constrained('national_teams');
            $t->foreignId('user_id')->constrained('users'); $t->string('status', 20)->default('applied');
            $t->text('statement')->nullable(); $t->timestampTz('starts_at')->nullable(); $t->timestampTz('ends_at')->nullable();
            $t->timestampTz('last_active_at')->nullable(); $t->timestampsTz(); $t->index(['national_team_id', 'status']);
        });
        Schema::create('player_national_eligibilities', function (Blueprint $t) {
            $t->id(); $t->foreignUuid('player_id')->constrained('owned_player_cards');
            $t->foreignId('geography_id')->constrained('competition_geographies');
            $t->string('evidence', 255); $t->foreignId('verified_by')->constrained('users'); $t->timestampTz('verified_at');
            $t->unique(['player_id', 'geography_id']);
        });
        Schema::create('player_international_commitments', function (Blueprint $t) {
            $t->foreignUuid('player_id')->primary()->constrained('owned_player_cards');
            $t->foreignId('national_team_id')->constrained('national_teams'); $t->timestampTz('committed_at');
        });
        Schema::table('club_tournaments', function (Blueprint $t) {
            $t->unsignedTinyInteger('tier')->nullable()->change();
            $t->foreignId('definition_id')->nullable()->constrained('competition_definitions');
            $t->string('scope', 80)->nullable(); $t->string('name', 100)->nullable();
            $t->string('participant_type', 16)->default('club'); $t->unsignedSmallInteger('capacity')->default(4);
            $t->unsignedInteger('rules_version')->default(1); $t->json('regulations')->nullable();
            $t->json('qualification')->nullable(); $t->json('sponsors')->nullable();
            $t->boolean('ranked')->default(false); $t->string('accreditation', 24)->default('unranked');
            $t->timestampTz('registration_opens_at')->nullable(); $t->timestampTz('starts_at')->nullable();
            $t->timestampTz('ends_at')->nullable(); $t->timestampTz('frozen_at')->nullable();
            $t->foreignId('national_champion_id')->nullable()->constrained('national_teams');
            $t->unique(['definition_id', 'year', 'scope']); $t->index(['year', 'participant_type', 'status']);
        });
        Schema::table('club_tournament_entries', function (Blueprint $t) {
            $t->unsignedBigInteger('club_id')->nullable()->change();
            $t->foreignId('national_team_id')->nullable()->constrained('national_teams');
            $t->string('status', 20)->default('accepted'); $t->unsignedInteger('seed')->default(0);
            $t->json('source')->nullable(); $t->json('geography_path')->nullable();
            $t->unique(['tournament_id', 'national_team_id']);
            $t->index(['tournament_id', 'status', 'seed']);
        });
        Schema::create('competition_stages', function (Blueprint $t) {
            $t->id(); $t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->unsignedSmallInteger('position'); $t->string('format', 24); $t->string('status', 20)->default('pending');
            $t->json('rules'); $t->json('state'); $t->unique(['tournament_id', 'position']);
        });
        Schema::table('club_fixtures', function (Blueprint $t) {
            $t->unsignedBigInteger('home_club_id')->nullable()->change(); $t->unsignedBigInteger('away_club_id')->nullable()->change();
            $t->unsignedInteger('bracket_slot')->nullable()->change();
            $t->foreignId('home_national_team_id')->nullable()->constrained('national_teams');
            $t->foreignId('away_national_team_id')->nullable()->constrained('national_teams');
            $t->foreignId('stage_id')->nullable()->constrained('competition_stages');
            $t->foreignId('home_entry_id')->nullable()->constrained('club_tournament_entries');
            $t->foreignId('away_entry_id')->nullable()->constrained('club_tournament_entries');
            $t->unsignedSmallInteger('round')->nullable(); $t->string('group_key', 12)->nullable();
            $t->index(['stage_id', 'round']); $t->index(['home_club_id', 'kickoff_at']);
            $t->index(['away_club_id', 'kickoff_at']); $t->index(['home_national_team_id', 'kickoff_at']);
            $t->index(['away_national_team_id', 'kickoff_at']);
        });
        Schema::table('online_matches', function (Blueprint $t) {
            $t->unsignedBigInteger('blue_user_id')->nullable()->change(); $t->unsignedBigInteger('red_user_id')->nullable()->change();
        });
        Schema::create('national_squads', function (Blueprint $t) {
            $t->id(); $t->foreignId('national_team_id')->constrained('national_teams');
            $t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->json('lineup'); $t->json('tactics')->nullable(); $t->string('captain_id', 36)->nullable();
            $t->timestampTz('locked_at')->nullable(); $t->timestampsTz(); $t->unique(['national_team_id', 'tournament_id']);
        });
        Schema::create('national_squad_players', function (Blueprint $t) {
            $t->id(); $t->foreignId('squad_id')->constrained('national_squads');
            $t->foreignUuid('player_id')->constrained('owned_player_cards'); $t->unique(['squad_id', 'player_id']);
        });
        Schema::create('competition_player_reservations', function (Blueprint $t) {
            $t->id(); $t->foreignUuid('player_id')->constrained('owned_player_cards');
            $t->foreignId('fixture_id')->constrained('club_fixtures');
            $t->timestampTz('starts_at'); $t->timestampTz('ends_at'); $t->unique(['fixture_id', 'player_id']);
            $t->index(['player_id', 'starts_at', 'ends_at']);
        });
        Schema::create('competition_results', function (Blueprint $t) {
            $t->id(); $t->foreignId('fixture_id')->unique()->constrained('club_fixtures');
            $t->foreignUuid('match_id')->unique()->constrained('online_matches');
            $t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->foreignId('winner_entry_id')->constrained('club_tournament_entries');
            $t->foreignId('loser_entry_id')->constrained('club_tournament_entries');
            $t->string('result_hash', 64); $t->timestampTz('verified_at');
        });
        Schema::create('competition_ratings', function (Blueprint $t) {
            $t->id(); $t->string('system', 8); $t->unsignedBigInteger('participant_id');
            $t->foreignId('geography_id')->nullable()->constrained('competition_geographies');
            $t->json('geography_path')->nullable();
            $t->double('rating')->default(1500); $t->double('deviation')->default(350); $t->double('volatility')->default(0.06);
            $t->double('achievement')->default(0); $t->double('score')->default(0); $t->unsignedInteger('games')->default(0);
            $t->timestampTz('last_played_at')->nullable(); $t->unique(['system', 'participant_id']);
            $t->index(['system', 'score', 'participant_id']); $t->index(['system', 'geography_id', 'score']);
        });
        Schema::create('competition_rating_events', function (Blueprint $t) {
            $t->id(); $t->foreignId('result_id')->constrained('competition_results');
            $t->string('system', 8); $t->unsignedBigInteger('participant_id'); $t->unsignedBigInteger('opponent_id');
            $t->json('before'); $t->json('after'); $t->timestampTz('created_at');
            $t->unique(['result_id', 'participant_id']); $t->index(['system', 'participant_id', 'opponent_id', 'created_at']);
        });
        Schema::create('competition_ranking_snapshots', function (Blueprint $t) {
            $t->id(); $t->string('system', 8); $t->string('purpose', 120)->unique();
            $t->json('rules'); $t->timestampTz('frozen_at'); $t->timestampTz('completed_at')->nullable();
        });
        Schema::create('competition_ranking_snapshot_rows', function (Blueprint $t) {
            $t->id(); $t->foreignId('snapshot_id')->constrained('competition_ranking_snapshots');
            $t->unsignedBigInteger('participant_id'); $t->unsignedInteger('position'); $t->double('score');
            $t->json('geography_path'); $t->unique(['snapshot_id', 'participant_id']); $t->unique(['snapshot_id', 'position']);
        });
        Schema::create('competition_invitations', function (Blueprint $t) {
            $t->id(); $t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->string('slot_key', 80); $t->string('participant_type', 16); $t->unsignedBigInteger('participant_id');
            $t->unsignedInteger('attempt')->default(1); $t->string('status', 20)->default('pending');
            $t->json('source'); $t->timestampTz('expires_at'); $t->timestampsTz();
            $t->unique(['tournament_id', 'slot_key', 'attempt']); $t->unique(['tournament_id', 'participant_type', 'participant_id']);
            $t->index(['status', 'expires_at']);
        });
        Schema::create('competition_circuit_points', function (Blueprint $t) {
            $t->id(); $t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->foreignId('club_id')->constrained('online_clubs'); $t->unsignedSmallInteger('year');
            $t->unsignedInteger('points'); $t->string('achievement', 40); $t->unique(['tournament_id', 'club_id']);
            $t->index(['year', 'club_id']);
        });
        Schema::create('international_appearances', function (Blueprint $t) {
            $t->id(); $t->foreignId('result_id')->constrained('competition_results');
            $t->foreignUuid('player_id')->constrained('owned_player_cards');
            $t->foreignId('national_team_id')->constrained('national_teams'); $t->boolean('won');
            $t->unique(['result_id', 'player_id']);
        });
        Schema::create('competition_audits', function (Blueprint $t) {
            $t->id(); $t->foreignId('user_id')->nullable()->constrained('users');
            $t->string('action', 80); $t->string('subject', 120); $t->json('details'); $t->timestampTz('created_at')->index();
        });
        Schema::create('competition_windows', function (Blueprint $t) {
            $t->id(); $t->string('name', 100); $t->unsignedSmallInteger('year')->index();
            $t->timestampTz('starts_at')->index(); $t->timestampTz('ends_at')->index();
            $t->unique(['year','name']);
        });
        Schema::create('competition_settings', function (Blueprint $t) {
            $t->id(); $t->json('settings'); $t->timestampsTz();
        });
    }

    public function down(): void
    {
        // This migration adds permanent historical records. A rollback must be reviewed
        // as a data migration; never silently delete live editions, call-ups or ratings.
        throw new RuntimeException('Global competition history requires an explicit reviewed rollback.');
    }
};
