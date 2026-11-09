<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::table('users',function(Blueprint $t){$t->timestampTz('supporter_trial_ends_at')->nullable();$t->timestampTz('supporter_until')->nullable();});
  Schema::create('club_identity_assets',function(Blueprint $t){$t->uuid('id')->primary();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('user_id')->constrained('users');$t->string('kind',20);$t->string('path');$t->string('mime',32);$t->string('sha256',64);$t->unsignedSmallInteger('width');$t->unsignedSmallInteger('height');$t->timestampTz('created_at');$t->index(['club_id','kind']);});
  Schema::create('club_tier_movements',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('tournament_id')->constrained('club_tournaments');$t->unsignedTinyInteger('from_tier');$t->unsignedTinyInteger('to_tier');$t->timestampTz('earned_at');$t->unique(['club_id','tournament_id']);});
  Schema::table('world_media_personalities',fn(Blueprint $t)=>$t->json('profile')->nullable());
  Schema::create('fixture_talent_assignments',function(Blueprint $t){$t->id();$t->foreignId('fixture_id')->constrained('club_fixtures');$t->foreignId('talent_id')->constrained('world_media_personalities');$t->string('role',30);$t->timestampTz('assigned_at');$t->unique(['fixture_id','role']);$t->index(['talent_id','fixture_id']);});
 }
 public function down():void {throw new RuntimeException('Supporter media, talent appointments and earned tier records require a reviewed rollback.');}
};
