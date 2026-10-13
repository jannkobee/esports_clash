<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('match_version')->default(1);
            $table->unsignedBigInteger('match_seed');
            $table->enum('winner', ['blue', 'red']);
            $table->unsignedInteger('duration_seconds');
            $table->unsignedSmallInteger('blue_kills')->default(0);
            $table->unsignedSmallInteger('red_kills')->default(0);
            $table->json('report');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_reports');
    }
};
