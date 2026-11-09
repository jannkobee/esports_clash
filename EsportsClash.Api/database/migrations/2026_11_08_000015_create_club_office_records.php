<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void{
        Schema::create('club_inbox',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->string('event_key',150);$t->string('kind',30);$t->string('title',180);$t->text('body');$t->json('action')->nullable();$t->timestampTz('occurred_at');$t->timestampTz('deadline_at')->nullable();$t->timestampTz('read_at')->nullable();$t->timestampTz('resolved_at')->nullable();$t->unique(['club_id','event_key']);$t->index(['club_id','read_at','id']);});
        Schema::create('club_weekly_reports',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->date('week');$t->json('report');$t->timestampTz('generated_at');$t->unique(['club_id','week']);});
        Schema::create('player_progress_snapshots',function(Blueprint $t){$t->id();$t->foreignUuid('player_id')->constrained('owned_player_cards');$t->date('week');$t->unsignedInteger('training_xp');$t->json('stats');$t->unsignedSmallInteger('overall');$t->timestampTz('observed_at');$t->unique(['player_id','week']);});
    }
    public function down():void{throw new RuntimeException('Club correspondence and observed development history require a reviewed rollback.');}
};
