<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void {
        Schema::create('avatar_equipment_generations',function(Blueprint $table){
            $table->uuid('id')->primary();$table->string('avatar_id');$table->string('slot');
            $table->string('status')->index();$table->json('plan');$table->json('state')->nullable();
            $table->text('error')->nullable();$table->timestamp('installed_at')->nullable();$table->timestamps();
            $table->index(['avatar_id','slot','created_at']);
        });
        Schema::table('avatar_preparations',fn(Blueprint $table)=>$table->timestamp('artifacts_deleted_at')->nullable());
    }
    public function down():void {
        Schema::table('avatar_preparations',fn(Blueprint $table)=>$table->dropColumn('artifacts_deleted_at'));
        Schema::dropIfExists('avatar_equipment_generations');
    }
};
