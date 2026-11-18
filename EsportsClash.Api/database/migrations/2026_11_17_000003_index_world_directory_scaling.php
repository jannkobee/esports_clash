<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Directory scaling for thousands of players and clubs. The Hexapedia player directory filters by
 * the active catalog and pages in persona-name order; the team directory pages in club-name order.
 * Without these, every page sorted the whole table.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasIndex('owned_player_cards', 'world_player_directory')) {
            Schema::table('owned_player_cards', fn (Blueprint $t) => $t->index(['catalog_id', 'persona_name', 'id'], 'world_player_directory'));
        }
        if (! Schema::hasIndex('online_clubs', 'world_club_directory')) {
            Schema::table('online_clubs', fn (Blueprint $t) => $t->index(['name', 'id'], 'world_club_directory'));
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex('owned_player_cards', 'world_player_directory')) {
            Schema::table('owned_player_cards', fn (Blueprint $t) => $t->dropIndex('world_player_directory'));
        }
        if (Schema::hasIndex('online_clubs', 'world_club_directory')) {
            Schema::table('online_clubs', fn (Blueprint $t) => $t->dropIndex('world_club_directory'));
        }
    }
};
