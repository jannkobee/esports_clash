<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
    public function up():void{
        Schema::table('online_clubs',fn(Blueprint $t)=>$t->date('office_report_cursor')->nullable());
        Schema::table('competition_invitations',fn(Blueprint $t)=>$t->timestampTz('issued_at')->nullable());
        Schema::create('competition_invitation_history',function(Blueprint $t){
            $t->id();$t->foreignId('invitation_id')->constrained('competition_invitations');$t->foreignId('tournament_id')->constrained('club_tournaments');
            $t->string('slot_key',80);$t->unsignedInteger('attempt');$t->string('participant_type',16);$t->unsignedBigInteger('participant_id');
            $t->string('status',20);$t->json('source');$t->timestampTz('issued_at');$t->timestampTz('expires_at');$t->timestampTz('recorded_at');
            $t->unique(['tournament_id','slot_key','attempt','status'],'invitation_history_transition_unique');$t->index(['invitation_id','id']);
        });
        DB::table('competition_invitations')->orderBy('id')->chunkById(200,function($rows){foreach($rows as $r){
            DB::table('competition_invitations')->where('id',$r->id)->update(['issued_at'=>$r->created_at]);
            DB::table('competition_invitation_history')->insert(['invitation_id'=>$r->id,'tournament_id'=>$r->tournament_id,'slot_key'=>$r->slot_key,'attempt'=>$r->attempt,
                'participant_type'=>$r->participant_type,'participant_id'=>$r->participant_id,'status'=>$r->status,'source'=>$r->source,'issued_at'=>$r->created_at,'expires_at'=>$r->expires_at,'recorded_at'=>now()]);
        }});
    }
    public function down():void{throw new RuntimeException('Invitation responses and report recovery cursors require a reviewed rollback.');}
};
