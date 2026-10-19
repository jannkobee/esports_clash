<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('avatar_evolution_settings', function (Blueprint $table) {
            $table->boolean('autonomous')->default(true);
            $table->timestampTz('maintenance_at')->nullable();
        });
        Schema::table('avatar_evolution_runs', function (Blueprint $table) {
            $table->timestampTz('artifacts_deleted_at')->nullable();
        });
        Schema::table('avatar_visual_releases', function (Blueprint $table) {
            $table->unsignedBigInteger('previous_release_id')->nullable();
            $table->string('source_sha256',64)->nullable();
            $table->string('health_status')->default('pending')->index();
            $table->unsignedInteger('health_failures')->default(0);
            $table->timestampTz('last_checked_at')->nullable();
            $table->timestampTz('quarantined_at')->nullable();
            $table->json('health_report')->nullable();
            $table->text('rollback_reason')->nullable();
        });
        Schema::create('avatar_visual_health_signals', function (Blueprint $table) {
            $table->id(); $table->foreignId('release_id')->constrained('avatar_visual_releases');
            $table->string('kind'); $table->unsignedInteger('count')->default(1);
            $table->timestampsTz(); $table->unique(['release_id','kind']);
        });
        // Existing run states, plans and evidence remain byte-for-byte intact.
        // The new engine treats v1 runs as historical; it never publishes them.
    }
    public function down(): void
    {
        Schema::dropIfExists('avatar_visual_health_signals');
        Schema::table('avatar_visual_releases', fn(Blueprint $table) => $table->dropColumn([
            'previous_release_id','source_sha256','health_status','health_failures','last_checked_at','quarantined_at','health_report','rollback_reason']));
        Schema::table('avatar_evolution_runs', fn(Blueprint $table) => $table->dropColumn('artifacts_deleted_at'));
        Schema::table('avatar_evolution_settings', fn(Blueprint $table) => $table->dropColumn(['autonomous','maintenance_at']));
    }
};
