<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('player_career_records', function (Blueprint $table): void {
            $table->double('adr')->nullable();
            $table->double('headshot_rate')->nullable();
            $table->json('fps_stats')->nullable();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('FPS career statistics are historical records and require an explicit reviewed rollback.');
    }
};
