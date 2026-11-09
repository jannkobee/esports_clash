<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
 public function up():void {
  Schema::table('club_tournaments',fn(Blueprint $t)=>$t->dropUnique(['year','tier']));
  // Definition/year/scope already uniquely identifies modern editions. Preserve the old rule only for legacy events.
  if(DB::getDriverName()==='pgsql')DB::statement('CREATE UNIQUE INDEX legacy_tournament_year_tier ON club_tournaments (year,tier) WHERE definition_id IS NULL');
 }
 public function down():void {throw new RuntimeException('Concurrent named editions require a reviewed rollback.');}
};
