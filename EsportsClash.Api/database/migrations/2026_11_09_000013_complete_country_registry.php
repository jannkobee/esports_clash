<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up():void {
  // AF/AS/AM and NA/SA were already geography codes. Country codes must coexist without changing their IDs.
  Schema::table('competition_geographies',function(Blueprint $t){$t->dropUnique(['code']);$t->unique(['kind','code']);});
  app(\App\Services\CompetitionCalendar::class)->installGeographies();
 }
 public function down():void {throw new RuntimeException('Country identities and their references require a reviewed rollback.');}
};
