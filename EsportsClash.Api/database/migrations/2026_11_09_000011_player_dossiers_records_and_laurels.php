<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::table('owned_player_cards',fn(Blueprint $t)=>$t->json('personal_details')->nullable());
  Schema::create('player_record_receipts',function(Blueprint $t){$t->uuid('match_id')->primary();$t->string('result_hash',64);$t->unsignedInteger('players');$t->timestampTz('captured_at');});
  Schema::create('player_career_records',function(Blueprint $t){
   $t->id();$t->foreignUuid('player_id')->constrained('owned_player_cards');$t->uuid('match_id');$t->unsignedBigInteger('fixture_id');$t->unsignedBigInteger('tournament_id')->nullable();$t->unsignedBigInteger('club_id')->nullable();
   $t->string('player_name',80);$t->string('club_name',100);$t->string('competition',180);$t->string('role',40);$t->string('scope',20);$t->boolean('won');$t->boolean('match_mvp');$t->decimal('rating',4,2)->nullable();$t->double('duration_seconds');
   foreach(['kills','deaths','assists','cs','gold','damage'] as $stat)$t->double($stat);
   $t->timestampTz('played_at');$t->string('result_hash',64);$t->unique(['match_id','player_id']);$t->index(['player_id','scope','played_at']);$t->index(['scope','played_at','player_id']);
  });
  Schema::create('annual_award_editions',function(Blueprint $t){$t->unsignedInteger('year')->primary();$t->string('name');$t->string('status',24)->default('nominations');$t->timestampTz('ceremony_at');$t->timestampTz('evidence_through');$t->string('formula',80);$t->json('rules');$t->timestampTz('calculated_at')->nullable();$t->timestampTz('awarded_at')->nullable();});
  Schema::create('annual_award_entries',function(Blueprint $t){$t->id();$t->unsignedInteger('year');$t->string('category',40);$t->unsignedSmallInteger('position');$t->foreignUuid('player_id')->constrained('owned_player_cards');$t->string('player_name',80);$t->double('score');$t->json('evidence');$t->unique(['year','category','position']);$t->index(['player_id','year']);});
 }
 public function down():void {throw new RuntimeException('Career and award history requires an explicit reviewed rollback.');}
};
