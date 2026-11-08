<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->string('tag', 12)->nullable()->unique();
            $table->json('identity')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('online_clubs', function (Blueprint $table): void {
            $table->dropUnique(['tag']);
            $table->dropColumn(['tag', 'identity']);
        });
    }
};
