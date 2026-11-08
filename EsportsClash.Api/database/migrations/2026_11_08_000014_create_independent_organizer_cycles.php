<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
return new class extends Migration {
    public function up():void{
        \Illuminate\Support\Facades\Schema::create('world_organizer_cycles',function(Blueprint $t){$t->id();$t->string('cycle',30)->unique();$t->foreignId('tournament_id')->nullable()->constrained('club_tournaments');$t->string('status',30);$t->text('reason')->nullable();$t->timestampTz('created_at');});
        \Illuminate\Support\Facades\Schema::create('world_sponsor_ledger',function(Blueprint $t){$t->id();$t->foreignId('organizer_id')->constrained('competition_organizers');$t->foreignId('tournament_id')->nullable()->constrained('club_tournaments');$t->string('reference',120)->unique();$t->string('kind',40);$t->bigInteger('amount');$t->timestampTz('created_at');});
    }
    public function down():void{throw new RuntimeException('Organizer funding records are retained.');}
};
