<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('avatar_component_inventories', function (Blueprint $table) {
            $table->string('avatar_id',80)->primary();
            $table->unsignedInteger('version')->default(0);
            $table->json('components');
            $table->timestamps();
        });
        Schema::create('avatar_component_revisions', function (Blueprint $table) {
            $table->id(); $table->string('avatar_id',80); $table->unsignedInteger('version');
            $table->json('components'); $table->unsignedBigInteger('created_by'); $table->timestamp('created_at');
            $table->unique(['avatar_id','version']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('avatar_component_revisions');
        Schema::dropIfExists('avatar_component_inventories');
    }
};
