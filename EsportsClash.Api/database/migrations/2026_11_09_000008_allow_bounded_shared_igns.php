<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
 public function up():void {
  Schema::table('owned_player_cards',fn(Blueprint $t)=>$t->dropUnique(['persona_name']));
  if(DB::getDriverName()==='pgsql'){
   DB::statement('CREATE INDEX player_ign_lookup ON owned_player_cards (LOWER(persona_name))');
   DB::unprepared(<<<'SQL'
CREATE FUNCTION enforce_player_ign_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.persona_name IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(NEW.persona_name), 48139));
 IF (SELECT COUNT(*) FROM owned_player_cards WHERE lower(persona_name)=lower(NEW.persona_name) AND id<>NEW.id) >= 3 THEN
  RAISE EXCEPTION 'This display IGN already has three registered players' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER player_ign_capacity BEFORE INSERT OR UPDATE OF persona_name ON owned_player_cards FOR EACH ROW EXECUTE FUNCTION enforce_player_ign_capacity();
SQL);
  }else Schema::table('owned_player_cards',fn(Blueprint $t)=>$t->index('persona_name','player_ign_lookup'));
 }
 public function down():void {throw new RuntimeException('Shared display IGNs require a reviewed rollback; permanent player IDs remain unique.');}
};
