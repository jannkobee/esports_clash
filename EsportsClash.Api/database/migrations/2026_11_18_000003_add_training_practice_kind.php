<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Reserve practice XP from scrimmages is recorded separately from the ten allocated players' match XP. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_training_sessions', function (Blueprint $table) {
            $table->string('kind', 12)->default('match');
        });
    }

    public function down(): void
    {
        Schema::table('club_training_sessions', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
