<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void {
        Schema::table('online_clubs',fn(Blueprint $t)=>$t->index(['is_bot','id'],'world_bot_cursor'));
        Schema::table('owned_player_cards',fn(Blueprint $t)=>$t->index(['user_id','catalog_id'],'world_contract_catalog'));
        Schema::table('player_national_eligibilities',fn(Blueprint $t)=>$t->index(['geography_id','player_id'],'national_eligible_pool'));
        Schema::table('competition_results',fn(Blueprint $t)=>$t->index(['tournament_id','id'],'competition_verified_results'));
    }
    public function down():void {
        Schema::table('online_clubs',fn(Blueprint $t)=>$t->dropIndex('world_bot_cursor'));
        Schema::table('owned_player_cards',fn(Blueprint $t)=>$t->dropIndex('world_contract_catalog'));
        Schema::table('player_national_eligibilities',fn(Blueprint $t)=>$t->dropIndex('national_eligible_pool'));
        Schema::table('competition_results',fn(Blueprint $t)=>$t->dropIndex('competition_verified_results'));
    }
};
