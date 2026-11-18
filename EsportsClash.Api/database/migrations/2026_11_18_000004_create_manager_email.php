<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real email for human managers: per-category preferences with a one-click unsubscribe token, and a log
 * that sends each event at most once (the inbox event key is the de-duplication key).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manager_email_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('categories');
            $table->string('unsubscribe_token', 64)->unique();
            $table->timestamps();
        });
        Schema::create('manager_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('category', 24);
            $table->string('event_key', 191);
            $table->string('subject', 200);
            $table->string('status', 16)->default('queued');
            $table->timestampTz('created_at');
            $table->unique(['user_id', 'event_key']);
            $table->index(['category', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_emails');
        Schema::dropIfExists('manager_email_preferences');
    }
};
