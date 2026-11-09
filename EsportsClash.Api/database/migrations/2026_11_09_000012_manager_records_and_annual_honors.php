<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::create('manager_match_records',function(Blueprint $t){
   $t->id();$t->foreignId('result_id')->constrained('competition_results');$t->uuid('match_id');$t->foreignId('manager_user_id')->constrained('users');$t->foreignId('club_id')->constrained('online_clubs');$t->unsignedBigInteger('opponent_id');$t->unsignedBigInteger('tournament_id');$t->unsignedBigInteger('fixture_id');
   $t->string('manager_name',100);$t->string('club_name',100);$t->boolean('won');$t->boolean('counted');foreach(['rating_before','rating_after','score_before','score_after'] as $field)$t->double($field);$t->string('result_hash',64);$t->timestampTz('played_at');
   $t->unique(['result_id','club_id']);$t->index(['manager_user_id','played_at']);$t->index(['counted','played_at']);
  });
  Schema::create('manager_award_entries',function(Blueprint $t){$t->id();$t->unsignedInteger('year');$t->string('category',40);$t->unsignedSmallInteger('position');$t->foreignId('manager_user_id')->constrained('users');$t->string('manager_name',100);$t->double('score');$t->json('evidence');$t->unique(['year','category','position']);$t->index(['manager_user_id','year']);});
 }
 public function down():void {throw new RuntimeException('Manager performance and annual honors need a reviewed rollback.');}
};
