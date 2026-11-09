<?php

namespace App\Services;

use App\Models\ClubAuction;
use App\Models\ClubFixture;
use App\Models\NormalQueueTicket;
use App\Models\OnlineCatalog;
use App\Models\OnlineClub;
use App\Models\OnlineMatch;
use App\Models\OwnedPlayerCard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class WorldRosterReset
{
    public function report(): array
    {
        $ready = Schema::hasTable('world_player_settings');

        return ['schema_ready' => $ready, 'active_matches' => OnlineMatch::whereIn('status', ['allocated', 'running'])->count(),
            'players' => OwnedPlayerCard::count(), 'legacy_players' => OwnedPlayerCard::whereNotNull('original_identity')->count(),
            'open_auctions' => ClubAuction::where('status', 'open')->count(), 'profiles_enabled' => $ready ? app(WorldPlayerProfiles::class)->enabled() : false];
    }

    public function activate(bool $verifyWorker = true): array
    {
        abort_unless(Schema::hasTable('world_player_settings'), 409, 'Apply the rookie world-profile migration first.');
        if ($verifyWorker) {
            $capability = Http::connectTimeout(3)->timeout(10)->get(rtrim(config('online.worker_url'), '/').'/health')->throw()->json();
            abort_unless(($capability['player_profile_schema'] ?? 0) === WorldPlayerProfiles::VERSION, 409, 'The trusted match worker must support pinned world-player profiles before activation.');
        }

        return DB::transaction(function () {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $state = DB::table('world_player_settings')->where('id', 1)->lockForUpdate()->first();
            if ($state->profile_version === WorldPlayerProfiles::VERSION) {
                return ['already_active' => true];
            }
            abort_if(OnlineMatch::whereIn('status', ['allocated', 'running'])->exists() || NormalQueueTicket::where('status', 'queued')->exists(), 409, 'Finish active matches and matchmaking before resetting rosters.');
            abort_if(ClubFixture::whereNull('match_id')->whereNull('hold_reason')->where('orders_close_at', '<=', now())->exists(), 409, 'Resolve due fixture locks before resetting rosters.');
            abort_if(DB::table('national_squads')->whereIn('tournament_id', DB::table('club_tournaments')->whereIn('status', ['active', 'registration'])->select('id'))->exists(), 409, 'Withdraw active national squad registrations before resetting the player pool.');
            app(CompetitionCalendar::class)->installGeographies();
            DB::table('world_player_settings')->where('id', 1)->update(['profile_version' => WorldPlayerProfiles::VERSION, 'activated_at' => now()]);
            $profiles = app(WorldPlayerProfiles::class);
            $profiles->invalidate();
            $clubIds = OnlineClub::orderBy('id')->lockForUpdate()->pluck('id')->all();
            $refunds = 0;
            foreach (ClubAuction::where('status', 'open')->orderBy('id')->lockForUpdate()->get() as $auction) {
                if ($auction->bidder_id && $auction->bid) {
                    DB::table('club_money_entries')->insertOrIgnore(['club_id' => $auction->bidder_id, 'amount' => $auction->bid, 'kind' => 'Roster reset bid refund', 'reference' => 'rookie-reset:auction:'.$auction->id, 'created_at' => now()]);
                    $refunds++;
                }
                $auction->update(['status' => 'closed', 'active_card_id' => null]);
            }
            $replacements = [];
            $retired = 0;
            $updated = 0;
            foreach (OwnedPlayerCard::withoutGlobalScopes()->whereNull('retired_at')->orderBy('id')->cursor() as $player) {
                if ($player->world_profile && $player->original_identity === null) {
                    continue;
                }
                if ($player->original_identity !== null) {
                    $new = OwnedPlayerCard::firstOrCreate(['grant_key' => 'rookie-reset:'.$player->id], ['id' => (string) Str::uuid(), 'user_id' => $player->user_id, 'catalog_id' => $player->catalog_id, 'definition_id' => $player->definition_id, 'training_xp' => 0]);
                    app(WorldPlayerIdentity::class)->assign($new, $catalog, false, 'starter');
                    $replacements[$player->id] = $new->id;
                    $player->update(['retired_at' => now()]);
                    $retired++;
                    DB::table('competition_audits')->insert(['action' => 'player.legacy-retired', 'subject' => $player->id, 'details' => json_encode(['alias' => $player->persona_name, 'replacement_id' => $new->id]), 'created_at' => now()]);
                } else {
                    if (! $player->world_profile) {
                        app(WorldPlayerIdentity::class)->renameGenerated($player);
                    }
                    $profiles->initialize($player, $catalog, 'world-reset');
                    $updated++;
                }
            }
            foreach (OnlineClub::whereKey($clubIds)->get() as $club) {
                $lineup = $club->lineup;
                foreach ($lineup as &$slot) {
                    $slot['instance_id'] = $replacements[$slot['instance_id']] ?? $slot['instance_id'];
                }unset($slot);
                $starters = $club->starters ?? array_map(
                    fn (array $slot): array => ['instance_id' => $slot['instance_id']],
                    $club->lineup,
                );
                foreach ($starters as &$slot) {
                    $slot['instance_id'] = $replacements[$slot['instance_id']] ?? $slot['instance_id'];
                }unset($slot);
                $club->update(['lineup' => $lineup, 'starters' => $starters, 'revision' => $club->revision + 1]);
            }
            // Only unallocated, still-editable saved orders can be migrated. Historical allocations are immutable.
            ClubFixture::whereNull('match_id')->where('orders_close_at', '>', now())->chunkById(100, function ($fixtures) use ($replacements) {
                foreach ($fixtures as $f) {
                    $changes = [];
                    foreach (['home_orders', 'away_orders'] as $field) {
                        $orders = $f->$field;
                        if (! $orders) {
                            continue;
                        }foreach ($orders as &$slot) {
                            $slot['instance_id'] = $replacements[$slot['instance_id']] ?? $slot['instance_id'];
                        }unset($slot);
                        $changes[$field] = $orders;
                    }if ($changes) {
                        $f->update($changes);
                    }
                }
            });
            $result = ['retired_legacy_players' => $retired, 'new_starters' => count($replacements), 'generated_profiles' => $updated, 'refunded_bids' => $refunds, 'active_players' => OwnedPlayerCard::count()];
            DB::table('competition_audits')->insert(['action' => 'world.rookie-reset', 'subject' => 'world', 'details' => json_encode($result), 'created_at' => now()]);

            return $result;
        }, 3);
    }
}
