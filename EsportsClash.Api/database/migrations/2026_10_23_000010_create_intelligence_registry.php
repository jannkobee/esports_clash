<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('intelligence_seed_reservations', function(Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('run_id')->unique(); $t->unsignedBigInteger('first_seed')->unique();
            $t->unsignedInteger('count'); $t->json('receipt'); $t->timestamps();
        });
        Schema::create('intelligence_policies', function(Blueprint $t) {
            $t->string('id',64)->primary(); $t->uuid('run_id')->nullable()->index();
            $t->string('source_hash',64); $t->json('policy'); $t->json('evidence'); $t->timestamps();
        });
        Schema::create('intelligence_releases', function(Blueprint $t) {
            $t->id(); $t->string('policy_id',64)->nullable(); $t->string('previous_policy_id',64)->nullable();
            $t->string('actor'); $t->string('reason'); $t->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('intelligence_releases'); Schema::dropIfExists('intelligence_policies');
        Schema::dropIfExists('intelligence_seed_reservations');
    }
};
