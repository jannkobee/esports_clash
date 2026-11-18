<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supporter billing behind a provider interface (a mock provider until a real one is chosen): checkouts,
 * one subscription per account with renewal and cancel-at-period-end, and a payment record for receipts.
 * Membership itself stays on users.supporter_until / supporter_level, as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supporter_checkouts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('plan', 16);
            $table->bigInteger('amount');
            $table->string('currency', 3);
            $table->string('provider', 24);
            $table->string('status', 16)->default('pending');
            $table->timestampTz('expires_at');
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'status']);
        });
        Schema::create('supporter_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('plan', 16);
            $table->string('status', 16);
            $table->string('provider', 24);
            $table->string('provider_ref', 100)->nullable();
            $table->timestampTz('current_period_end');
            $table->boolean('cancel_at_period_end')->default(false);
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestampsTz();
            $table->index(['status', 'current_period_end']);
        });
        Schema::create('supporter_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('checkout_id')->nullable();
            $table->string('plan', 16);
            $table->bigInteger('amount');
            $table->string('currency', 3);
            $table->string('provider', 24);
            $table->string('reference', 120)->unique();
            $table->string('status', 16);
            $table->timestampTz('period_start');
            $table->timestampTz('period_end');
            $table->timestampTz('created_at');
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supporter_payments');
        Schema::dropIfExists('supporter_subscriptions');
        Schema::dropIfExists('supporter_checkouts');
    }
};
