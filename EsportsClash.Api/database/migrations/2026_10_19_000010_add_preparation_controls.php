<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void {Schema::table('avatar_preparations',function(Blueprint $table){$table->json('control')->nullable();$table->foreignUuid('previous_preparation_id')->nullable()->unique()->constrained('avatar_preparations');});}
    public function down():void {Schema::table('avatar_preparations',function(Blueprint $table){$table->dropForeign(['previous_preparation_id']);$table->dropUnique(['previous_preparation_id']);$table->dropColumn(['control','previous_preparation_id']);});}
};
