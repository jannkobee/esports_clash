<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void{Schema::create('competition_year_records',function(Blueprint $t){
        $t->unsignedSmallInteger('year')->primary();$t->string('status',20)->default('active');
        $t->foreignId('club_snapshot_id')->nullable()->constrained('competition_ranking_snapshots');
        $t->foreignId('national_snapshot_id')->nullable()->constrained('competition_ranking_snapshots');
        $t->json('achievements')->nullable();$t->timestampTz('finalized_at')->nullable();
    });}
    public function down():void{throw new RuntimeException('Annual competition records must be retained.');}
};
