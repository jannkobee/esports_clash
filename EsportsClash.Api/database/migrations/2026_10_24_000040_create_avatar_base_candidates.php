<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void { Schema::create('avatar_base_candidates',function(Blueprint $table){$table->uuid('id')->primary();$table->string('avatar_id')->index();$table->string('asset_epoch',80);$table->string('status');$table->json('report');$table->json('artifacts');$table->timestamps();}); }
    public function down():void { Schema::dropIfExists('avatar_base_candidates'); }
};
