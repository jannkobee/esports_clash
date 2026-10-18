<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('avatar_evolution_settings', function (Blueprint $table) {
            $table->id(); $table->boolean('enabled')->default(true);
            $table->unsignedInteger('interval_minutes')->default(60);
            $table->unsignedInteger('candidates_per_cycle')->default(5);
            $table->unsignedInteger('generations')->default(1);
            $table->unsignedInteger('max_pending')->default(8);
            $table->unsignedInteger('storage_gib')->default(4);
            $table->json('avatar_ids');
            $table->unsignedInteger('cursor')->default(0);
            $table->timestampTz('next_cycle_at')->nullable();
            $table->timestampTz('heartbeat_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('avatar_evolution_runs', function (Blueprint $table) {
            $table->uuid('id')->primary(); $table->string('avatar_id');
            $table->string('status')->default('queued')->index();
            $table->json('plan'); $table->json('report')->nullable();
            $table->json('decisions')->nullable(); $table->string('manifest_hash',64)->nullable();
            $table->text('error')->nullable(); $table->timestampsTz();
        });
        Schema::create('avatar_visual_releases', function (Blueprint $table) {
            $table->id(); $table->string('avatar_id'); $table->string('variant');
            $table->unsignedInteger('version'); $table->uuid('run_id');
            $table->foreign('run_id')->references('id')->on('avatar_evolution_runs');
            $table->string('candidate_id'); $table->string('file');
            $table->string('sha256',64); $table->boolean('active')->default(true)->index();
            $table->json('validation'); $table->string('approved_by'); $table->timestampsTz();
            $table->unique(['avatar_id','variant','version']);
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('avatar_visual_releases'); Schema::dropIfExists('avatar_evolution_runs');
        Schema::dropIfExists('avatar_evolution_settings');
    }
};
