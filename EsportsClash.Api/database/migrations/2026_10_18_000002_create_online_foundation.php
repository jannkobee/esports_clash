<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('online_catalogs', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->boolean('active')->default(false)->index();
            $table->json('manifest');
            $table->json('payload');
            $table->timestampsTz();
        });
        Schema::create('owned_player_cards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained();
            $table->string('catalog_id', 64);
            $table->foreign('catalog_id')->references('id')->on('online_catalogs');
            $table->string('definition_id');
            $table->string('grant_key')->unique();
            $table->timestampsTz();
        });
        Schema::create('online_clubs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained();
            $table->string('name', 80);
            $table->json('lineup');
            $table->unsignedInteger('revision')->default(1);
            $table->timestampsTz();
        });
        Schema::create('online_matches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('blue_user_id')->constrained('users');
            $table->foreignId('red_user_id')->constrained('users');
            $table->string('status')->default('allocated')->index();
            $table->json('plan');
            $table->string('plan_hash', 64);
            $table->unsignedInteger('sequence')->default(0);
            $table->json('result')->nullable();
            $table->string('result_hash', 64)->nullable();
            $table->text('error')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('normal_queue_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained();
            $table->string('status')->default('queued')->index();
            $table->string('catalog_id', 64);
            $table->json('lineup');
            $table->string('club_name');
            $table->uuid('match_id')->nullable();
            $table->foreign('match_id')->references('id')->on('online_matches');
            $table->timestampsTz();
        });
        Schema::create('online_stream_grants', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->foreignId('user_id')->constrained();
            $table->uuid('match_id');
            $table->foreign('match_id')->references('id')->on('online_matches');
            $table->timestampTz('expires_at')->index();
            $table->timestampTz('used_at')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        foreach (['online_stream_grants', 'normal_queue_tickets', 'online_matches', 'online_clubs', 'owned_player_cards', 'online_catalogs'] as $table) Schema::dropIfExists($table);
    }
};
