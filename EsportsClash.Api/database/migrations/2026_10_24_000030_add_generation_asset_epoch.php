<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void { Schema::table('trellis_generations',fn(Blueprint $table)=>$table->string('asset_epoch',80)->nullable()->index()); }
    public function down():void { Schema::table('trellis_generations',fn(Blueprint $table)=>$table->dropColumn('asset_epoch')); }
};
