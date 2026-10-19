<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void { Schema::table('avatar_preparations',fn(Blueprint $table)=>$table->json('progress')->nullable()); }
    public function down(): void { Schema::table('avatar_preparations',fn(Blueprint $table)=>$table->dropColumn('progress')); }
};
