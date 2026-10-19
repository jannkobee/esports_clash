<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('avatar_preparation_settings',function(Blueprint $table){$table->id();$table->boolean('enabled')->default(true);$table->timestampsTz();});
        Schema::create('avatar_preparations',function(Blueprint $table){
            $table->uuid('id')->primary();$table->foreignUuid('generation_id')->constrained('trellis_generations');
            $table->string('avatar_id');$table->string('status')->index();$table->json('plan');
            $table->json('state')->nullable();$table->text('error')->nullable();$table->timestampsTz();
        });
    }
    public function down(): void { Schema::dropIfExists('avatar_preparations');Schema::dropIfExists('avatar_preparation_settings'); }
};
