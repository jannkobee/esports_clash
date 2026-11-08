<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\{Blueprint};
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('owned_player_cards',function(Blueprint $t){
            $t->string('persona_name',100)->nullable()->unique();
            $t->string('original_identity',100)->nullable()->unique();
        });
        Schema::create('club_manager_history',function(Blueprint $t){
            $t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('user_id')->constrained('users');
            $t->string('kind',20);$t->timestampTz('starts_at');$t->timestampTz('ends_at')->nullable();$t->index(['club_id','starts_at']);
        });
    }
    public function down(): void {throw new RuntimeException('World identities must be preserved; use a reviewed data migration.');}
};
