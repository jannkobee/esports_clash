<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Club economy reviews: when a club's debt warning started (for the dismissal of an inactive manager deep in
 * debt), and the record of each manager dismissal. Sponsor season budgets use the existing sponsor ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table) {
            $table->timestampTz('debt_warned_at')->nullable();
            $table->timestampTz('dismissal_warned_at')->nullable();
        });
        Schema::create('manager_dismissals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->foreignId('user_id')->constrained('users');
            $table->bigInteger('cash_at_dismissal');
            $table->bigInteger('debt_limit');
            $table->timestampTz('last_seen_at')->nullable();
            $table->timestampTz('warned_at');
            $table->timestampTz('dismissed_at');
            $table->index(['user_id', 'dismissed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_dismissals');
        Schema::table('online_clubs', function (Blueprint $table) {
            $table->dropColumn(['debt_warned_at', 'dismissal_warned_at']);
        });
    }
};
