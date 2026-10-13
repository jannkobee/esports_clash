<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->json('roster');
            $table->json('starting_five');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_profiles');
    }
};
