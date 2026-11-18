<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Finished-match experience submitted for a club lineage (append-only, one row per lineage and match).
 * The learning worker pulls these rows and applies them with the same learners it uses in training.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('fps_lineage_experience', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lineage_id')->constrained('fps_team_lineages');
            $table->string('match_ref', 64);
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->char('sha256', 64);
            $table->longText('payload');
            $table->timestampTz('created_at');
            $table->unique(['lineage_id', 'match_ref']);
        });
        $driver = DB::getDriverName();
        foreach (['UPDATE', 'DELETE'] as $operation) {
            $name = 'fps_lineage_experience_no_'.strtolower($operation);
            if ($driver === 'sqlite') {
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON fps_lineage_experience BEGIN SELECT RAISE(ABORT, 'fps_lineage_experience is append-only'); END;");
            } elseif ($driver === 'mysql' || $driver === 'mariadb') {
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON fps_lineage_experience FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fps_lineage_experience is append-only';");
            } elseif ($driver === 'pgsql') {
                DB::unprepared("CREATE OR REPLACE FUNCTION {$name}() RETURNS trigger AS \$\$ BEGIN RAISE EXCEPTION 'fps_lineage_experience is append-only'; END; \$\$ LANGUAGE plpgsql;");
                DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON fps_lineage_experience FOR EACH ROW EXECUTE FUNCTION {$name}();");
            }
        }
    }

    public function down(): void {}
};
