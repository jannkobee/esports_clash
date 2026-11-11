<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fps_identity_settings', function (Blueprint $t) {
            $t->unsignedTinyInteger('id')->primary();
            $t->boolean('enabled')->default(false);
        });
        \Illuminate\Support\Facades\DB::table('fps_identity_settings')->insert(['id'=>1,'enabled'=>false]);
        Schema::table('fps_team_systems', function (Blueprint $t) {
            $t->json('instructions')->nullable();
            $t->string('coach_key', 160)->nullable();
        });
        Schema::create('fps_identity_applications', function (Blueprint $t) {
            $t->uuid('match_id')->primary();
            $t->foreign('match_id')->references('id')->on('online_matches');
            $t->timestampTz('created_at');
        });
    }
    public function down(): void { /* Career evidence is retained. */ }
};
