<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
    public function up():void{
        Schema::create('club_staff_contracts',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->string('role',32);$t->string('name',80);$t->string('candidate_key',100);$t->json('ratings');$t->unsignedBigInteger('weekly_salary');$t->unsignedBigInteger('signing_fee');$t->timestampTz('starts_at');$t->timestampTz('ends_at');$t->timestampTz('terminated_at')->nullable();$t->string('status',20)->default('active');$t->index(['club_id','status','ends_at']);});
        Schema::table('club_staff',function(Blueprint $t){$t->json('founding_profile')->nullable();$t->foreignId('contract_id')->nullable()->constrained('club_staff_contracts');});
        DB::table('club_staff')->orderBy('id')->chunkById(200,function($rows){foreach($rows as $r)DB::table('club_staff')->where('id',$r->id)->update(['founding_profile'=>json_encode(['name'=>$r->name,'ratings'=>json_decode($r->ratings,true)])]);});
    }
    public function down():void{throw new RuntimeException('Signed staff terms and salaries must be retained.');}
};
