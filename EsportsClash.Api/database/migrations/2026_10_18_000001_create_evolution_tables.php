<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->boolean('is_evolution_admin')->default(false));
        Schema::create('evolution_settings', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('review_hours')->default(48);
            $table->unsignedInteger('training_interval_minutes')->default(360);
            $table->unsignedInteger('next_seed')->default(20001);
            $table->timestampTz('next_training_at')->nullable();
            $table->json('preferences')->nullable();
            $table->timestampsTz();
        });
        Schema::create('evolution_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status')->default('queued')->index();
            $table->json('plan');
            $table->json('progress')->nullable();
            $table->json('result')->nullable();
            $table->text('error')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('balance_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('run_id')->nullable()->unique();
            $table->foreign('run_id')->references('id')->on('evolution_runs');
            $table->string('status')->default('open')->index();
            $table->string('baseline_version');
            $table->json('preferences');
            $table->timestampTz('deadline_at')->index();
            $table->timestampTz('decided_at')->nullable();
            $table->unsignedBigInteger('selected_proposal_id')->nullable();
            $table->string('decided_by')->nullable();
            $table->text('reason')->nullable();
            $table->timestampsTz();
        });
        Schema::create('balance_proposals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('review_id');
            $table->foreign('review_id')->references('id')->on('balance_reviews');
            $table->string('title');
            $table->string('status')->default('pending');
            $table->json('changes');
            $table->json('evidence');
            $table->json('evaluation');
            $table->string('manifest_hash', 64);
            $table->timestampsTz();
        });
        Schema::create('evolution_audits', function (Blueprint $table): void {
            $table->id();
            $table->string('subject_id');
            $table->string('action');
            $table->string('actor');
            $table->json('details');
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evolution_audits');
        Schema::dropIfExists('balance_proposals');
        Schema::dropIfExists('balance_reviews');
        Schema::dropIfExists('evolution_runs');
        Schema::dropIfExists('evolution_settings');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('is_evolution_admin'));
    }
};
