<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only learned-model history per team lineage. Rows are never updated or deleted: "current"
 * is derived from the latest promote/rollback event. Database triggers enforce immutability.
 */
return new class extends Migration {
    private const IMMUTABLE = ['fps_team_lineages', 'fps_model_versions', 'fps_lineage_events'];

    public function up(): void
    {
        Schema::create('fps_team_lineages', function (Blueprint $table) {
            $table->id();
            $table->string('lineage_key', 120)->unique();
            $table->foreignId('club_id')->nullable()->constrained('online_clubs');
            $table->string('map_scope', 40)->default('*');
            $table->string('label', 120)->nullable();
            $table->timestampTz('created_at');
        });
        Schema::create('fps_model_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lineage_id')->constrained('fps_team_lineages');
            $table->string('kind', 32);
            $table->unsignedInteger('version');
            $table->foreignId('parent_id')->nullable()->constrained('fps_model_versions');
            $table->char('sha256', 64);
            $table->longText('payload')->nullable();
            $table->string('payload_path', 200)->nullable();
            $table->unsignedBigInteger('bytes');
            $table->string('origin', 32);
            $table->json('metrics')->nullable();
            $table->timestampTz('created_at');
            $table->unique(['lineage_id', 'kind', 'version']);
            $table->index(['lineage_id', 'kind', 'sha256']);
        });
        Schema::create('fps_lineage_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lineage_id')->constrained('fps_team_lineages');
            $table->string('kind', 32);
            $table->string('action', 16);
            $table->foreignId('version_id')->nullable()->constrained('fps_model_versions');
            $table->string('reason', 240);
            $table->string('actor', 80);
            $table->timestampTz('created_at');
            $table->index(['lineage_id', 'kind', 'id']);
        });
        $driver = DB::getDriverName();
        foreach (self::IMMUTABLE as $table) {
            foreach (['UPDATE', 'DELETE'] as $operation) {
                $name = "{$table}_no_".strtolower($operation);
                if ($driver === 'sqlite') {
                    DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON {$table} BEGIN SELECT RAISE(ABORT, '{$table} is append-only'); END;");
                } elseif ($driver === 'mysql' || $driver === 'mariadb') {
                    DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON {$table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$table} is append-only';");
                } elseif ($driver === 'pgsql') {
                    DB::unprepared("CREATE OR REPLACE FUNCTION {$name}() RETURNS trigger AS \$\$ BEGIN RAISE EXCEPTION '{$table} is append-only'; END; \$\$ LANGUAGE plpgsql;");
                    DB::unprepared("CREATE TRIGGER {$name} BEFORE {$operation} ON {$table} FOR EACH ROW EXECUTE FUNCTION {$name}();");
                }
            }
        }
    }

    /** Learned history is retained; this migration is intentionally not reversible. */
    public function down(): void {}
};
