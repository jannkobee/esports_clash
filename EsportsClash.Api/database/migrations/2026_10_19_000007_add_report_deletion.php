<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{Schema,DB};
return new class extends Migration {
    public function up():void {
        foreach(['evolution_runs','trellis_generations','avatar_preparations','avatar_evolution_runs']as $name)Schema::table($name,fn(Blueprint $table)=>$table->softDeletesTz());
        DB::table('avatar_preparation_settings')->update(['enabled'=>false]);
        DB::table('avatar_evolution_settings')->update(['enabled'=>false]);
    }
    public function down():void {foreach(['evolution_runs','trellis_generations','avatar_preparations','avatar_evolution_runs']as $name)Schema::table($name,fn(Blueprint $table)=>$table->dropSoftDeletes());}
};
