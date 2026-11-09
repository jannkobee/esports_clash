<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  Schema::table('users',function(Blueprint $t){$t->boolean('is_game_owner')->default(false);$t->string('supporter_level',16)->default('signal');$t->json('theme_preferences')->nullable();});
  Schema::table('owned_player_cards',function(Blueprint $t){$t->json('presentation')->nullable();$t->timestampTz('name_customized_at')->nullable();$t->timestampTz('profile_customized_at')->nullable();});
  Schema::create('player_presentation_revisions',function(Blueprint $t){$t->id();$t->foreignUuid('player_id')->constrained('owned_player_cards');$t->foreignId('user_id')->constrained('users');$t->json('previous');$t->json('current');$t->timestampTz('created_at');$t->index(['player_id','id']);});
  Schema::create('game_initializations',function(Blueprint $t){$t->string('key',80)->primary();$t->foreignId('owner_user_id')->constrained('users');$t->json('report');$t->timestampTz('completed_at');});
 }
 public function down():void {throw new RuntimeException('Owner admission and identity history require a reviewed rollback.');}
};
