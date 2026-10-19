<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::create('trellis_generations',function(Blueprint $table){
            $table->uuid('id')->primary();$table->string('avatar_id');$table->string('status')->index();
            $table->json('plan');$table->json('state')->nullable();$table->text('error')->nullable();$table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('trellis_generations'); }
};
