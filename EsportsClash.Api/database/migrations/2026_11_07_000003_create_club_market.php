<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_money_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('club_id')->constrained('online_clubs');
            $table->bigInteger('amount');
            $table->string('kind');
            $table->string('reference')->unique();
            $table->timestampTz('created_at');
        });
        Schema::create('club_auctions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('seller_id')->constrained('online_clubs');
            $table->foreignUuid('card_id')->constrained('owned_player_cards');
            $table->foreignUuid('active_card_id')->nullable()->unique()->constrained('owned_player_cards');
            $table->foreignId('bidder_id')->nullable()->constrained('online_clubs');
            $table->bigInteger('opening_bid');
            $table->bigInteger('bid')->nullable();
            $table->timestampTz('closes_at')->index();
            $table->string('status')->default('open')->index();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_auctions');
        Schema::dropIfExists('club_money_entries');
    }
};
