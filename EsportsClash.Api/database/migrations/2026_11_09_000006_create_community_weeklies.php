<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up():void {
        Schema::create('community_cup_weeks',function(Blueprint $t){
            $t->id();$t->date('week')->unique();$t->timestampTz('invites_close_at');$t->timestampTz('starts_at');$t->timestampTz('ends_at');$t->string('status',20)->default('inviting');$t->timestampsTz();
        });
        Schema::create('community_cup_invitations',function(Blueprint $t){
            $t->id();$t->foreignId('week_id')->constrained('community_cup_weeks');$t->foreignId('club_id')->constrained('online_clubs');$t->unsignedTinyInteger('tier');$t->string('status',20)->default('invited');$t->timestampTz('responded_at')->nullable();$t->foreignId('tournament_id')->nullable()->constrained('club_tournaments');$t->timestampsTz();
            $t->unique(['week_id','club_id']);$t->index(['week_id','tier','status','id']);$t->index(['club_id','id']);
        });
        Schema::create('community_cup_rewards',function(Blueprint $t){
            $t->id();$t->foreignId('tournament_id')->constrained('club_tournaments');$t->foreignId('club_id')->constrained('online_clubs');$t->string('place',20);$t->string('badge',80);$t->timestampTz('awarded_at');$t->unique(['tournament_id','club_id']);$t->index(['club_id','id']);
        });
        Schema::table('club_tournaments',function(Blueprint $t){$t->index(['accreditation','scope'],'community_pod_lookup');});
    }
    public function down():void {Schema::table('club_tournaments',fn(Blueprint $t)=>$t->dropIndex('community_pod_lookup'));Schema::dropIfExists('community_cup_rewards');Schema::dropIfExists('community_cup_invitations');Schema::dropIfExists('community_cup_weeks');}
};
