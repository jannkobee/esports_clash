<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->json('starters')->nullable();
        });

        Schema::create('club_staff', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('club_id')->constrained('online_clubs')->cascadeOnDelete();
            $table->string('role', 32);
            $table->string('name', 80);
            $table->json('ratings');
            $table->timestampsTz();
            $table->unique(['club_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_staff');
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->dropColumn('starters');
        });
    }
};
