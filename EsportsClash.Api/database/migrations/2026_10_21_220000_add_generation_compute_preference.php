<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('avatar_evolution_settings', function (Blueprint $table) {
            $table->string('generation_compute_preference', 16)->default('google');
        });
    }

    public function down(): void
    {
        Schema::table('avatar_evolution_settings', function (Blueprint $table) {
            $table->dropColumn('generation_compute_preference');
        });
    }
};
