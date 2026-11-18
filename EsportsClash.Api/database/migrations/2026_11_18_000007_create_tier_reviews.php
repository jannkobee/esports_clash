<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Season-end tier review: clubs can be relegated as well as promoted. One run per season (idempotent), and
 * one record per club moved, with the verified results it was decided on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tier_review_runs', function (Blueprint $table) {
            $table->id();
            $table->string('season', 24)->unique();
            $table->unsignedInteger('relegated')->default(0);
            $table->timestampTz('created_at');
        });
        Schema::create('club_tier_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('season', 24);
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->unsignedTinyInteger('from_tier');
            $table->unsignedTinyInteger('to_tier');
            $table->json('record');
            $table->timestampTz('created_at');
            $table->unique(['season', 'club_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_tier_reviews');
        Schema::dropIfExists('tier_review_runs');
    }
};
