<?php
namespace App\Services;

use App\Models\{CompetitionGeography, OnlineCatalog, OnlineClub, OwnedPlayerCard};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Scouting the manager directs. The manager briefs a scout with a position need and, optionally, a region;
 * after a short search the scout returns three prospects with uncertain whole 1–10 estimates (a better scout
 * narrows the ranges). Signing one creates the player; passing ends the assignment. Prospects are original
 * rookies (no private state is shown), their nationality is generated within the region, never chosen.
 */
class ScoutingAssignments
{
    public const COST = 150_000;
    public const SEARCH_HOURS = 48;
    public const SHORTLIST_DAYS = 7;
    /** Position needs and the attributes a scout looks for. */
    public const NEEDS = [
        'awper' => ['Sniper (AWPer)', ['sniping', 'positioning']], 'entry' => ['Entry fragger', ['entry', 'rifling']],
        'igl' => ['In-game leader', ['shotcalling', 'utility']], 'support' => ['Support rifler', ['utility', 'rifling']],
        'anchor' => ['Site anchor', ['positioning', 'rifling']], 'lurker' => ['Lurker', ['positioning', 'entry']],
        'rifler' => ['Rifler', ['rifling', 'entry']],
    ];

    /** Scout quality 1–10: the club's appointed scout, or the founding scouting arrangement (5). */
    public function quality(OnlineClub $club): int
    {
        $ratings = DB::table('club_staff_contracts')->where('club_id', $club->id)->where('role', 'scout')->where('status', 'active')
            ->where('ends_at', '>', now())->orderByDesc('id')->value('ratings');
        $values = array_values(json_decode($ratings ?? '[]', true) ?: []);
        return $values ? max(1, min(10, (int) round(array_sum($values) / count($values)))) : 5;
    }

    public function regions()
    {
        return CompetitionGeography::where('kind', 'region')->where('eligible', true)->orderBy('name')->get(['id', 'name']);
    }

    public function desk(OnlineClub $club): array
    {
        $this->refresh($club);
        return ['needs' => array_map(fn ($n) => $n[0], self::NEEDS), 'regions' => $this->regions(), 'cost' => self::COST, 'search_hours' => self::SEARCH_HOURS,
            'scout_quality' => $this->quality($club),
            'assignments' => DB::table('scouting_assignments')->where('club_id', $club->id)->orderByDesc('id')->limit(10)->get()->map(fn ($a) => $this->present($a))->all()];
    }

    private function present(object $a): array
    {
        $list = json_decode($a->shortlist ?? 'null', true);
        return ['id' => $a->id, 'need' => $a->need, 'need_label' => self::NEEDS[$a->need][0] ?? $a->need, 'region_id' => $a->region_id, 'status' => $a->status,
            'scout_quality' => (int) $a->scout_quality, 'ready_at' => $a->ready_at, 'expires_at' => $a->expires_at, 'signed_player_id' => $a->signed_player_id,
            // Only estimates leave the server; the prospects' exact attributes stay private until signed.
            'shortlist' => is_array($list) ? array_map(fn ($p) => array_intersect_key($p, array_flip(['index', 'name', 'age', 'nationality', 'estimates', 'wage'])), $list) : null];
    }

    public function start(OnlineClub $club, string $need, ?int $regionId): void
    {
        abort_unless(isset(self::NEEDS[$need]), 422, 'Choose a position need.');
        if ($regionId !== null) abort_unless($this->regions()->contains('id', $regionId), 422, 'Choose an eligible region.');
        DB::transaction(function () use ($club, $need, $regionId) {
            OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            abort_if(DB::table('scouting_assignments')->where('club_id', $club->id)->whereIn('status', ['searching', 'ready'])->exists(), 409, 'Your scout is already on an assignment.');
            $market = app(ClubMarketService::class);
            abort_if($market->balance($club->id) < self::COST, 422, 'Insufficient available money.');
            $id = DB::table('scouting_assignments')->insertGetId(['club_id' => $club->id, 'need' => $need, 'region_id' => $regionId, 'cost' => self::COST,
                'scout_quality' => $this->quality($club), 'status' => 'searching', 'ready_at' => now()->addHours(self::SEARCH_HOURS), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('club_money_entries')->insert(['club_id' => $club->id, 'amount' => -self::COST, 'kind' => 'Scouting assignment', 'reference' => 'scouting:'.$id, 'created_at' => now()]);
        }, 3);
    }

    /** Turn finished searches into shortlists and expire unanswered ones (lazy, and from the hourly job). */
    public function refresh(?OnlineClub $club = null): int
    {
        $q = DB::table('scouting_assignments')->where(fn ($q) => $q->where(fn ($q) => $q->where('status', 'searching')->where('ready_at', '<=', now()))
            ->orWhere(fn ($q) => $q->where('status', 'ready')->where('expires_at', '<=', now())));
        if ($club) $q->where('club_id', $club->id);
        $changed = 0;
        foreach ($q->limit(200)->get() as $a) {
            if ($a->status === 'ready') { DB::table('scouting_assignments')->where('id', $a->id)->where('status', 'ready')->update(['status' => 'expired', 'updated_at' => now()]); $changed++; continue; }
            $shortlist = $this->shortlist($a);
            if (DB::table('scouting_assignments')->where('id', $a->id)->where('status', 'searching')->update(['status' => 'ready', 'shortlist' => json_encode($shortlist),
                'expires_at' => now()->addDays(self::SHORTLIST_DAYS), 'updated_at' => now()])) {
                $changed++;
                app(ClubOffice::class)->notify($a->club_id, 'scouting:'.$a->id.':ready', 'market', 'Your scout\'s shortlist is ready',
                    'Three '.strtolower(self::NEEDS[$a->need][0] ?? 'player').' prospects to review. Sign one within '.self::SHORTLIST_DAYS.' days.', ['type' => 'route', 'route' => 'market?tab=scouting']);
            }
        }
        return $changed;
    }

    /** Three original rookie prospects, stronger in the need's attributes, with estimates as whole-level ranges. */
    private function shortlist(object $a): array
    {
        $countries = app(WorldPlayerProfiles::class)->countries();
        if ($a->region_id) $countries = $countries->filter(fn ($c) => in_array($a->region_id, $c->path(), true))->values();
        $arch = app(FpsPlayerArchitecture::class);
        $focus = self::NEEDS[$a->need][1] ?? [];
        $width = $a->scout_quality >= 9 ? 0 : ($a->scout_quality >= 7 ? 1 : 2);
        $out = [];
        for ($i = 0; $i < 3; $i++) {
            $hex = hash('sha256', 'scouting:'.$a->id.':'.$i);
            $n = fn (int $o, int $min, int $max) => $min + (hexdec(substr($hex, $o * 2 % 60, 2)) % ($max - $min + 1));
            $stats = [];
            foreach (WorldPlayerProfiles::ATTRIBUTES as $k => $key) $stats[$key] = $n($k + 1, (int) config('world_players.starter_min'), (int) config('world_players.starter_max'));
            foreach ($focus as $j => $key) $stats[$key] = min(48, $stats[$key] + $n(10 + $j, 6, 12));
            $potential = $n(14, (int) config('world_players.potential_min'), (int) config('world_players.potential_max'));
            $range = function (float $value, int $o) use ($arch, $width, $n): array {
                $level = $arch->scale10($value);
                $low = $width === 0 ? 0 : $n($o, 0, $width);
                return ['low' => max(1, $level - $low), 'high' => min(10, $level + ($width - $low))];
            };
            $estimates = ['overall' => $range(array_sum($stats) / count($stats), 20)];
            foreach ($focus as $j => $key) $estimates[$key] = $range($stats[$key], 21 + $j);
            $estimates['potential'] = $range($potential, 24);
            $country = $countries->isNotEmpty() ? $countries[$n(25, 0, $countries->count() - 1)] : null;
            $out[] = ['index' => $i, 'name' => app(PlayerIgnGenerator::class)->generate('scouting:'.$a->id.':'.$i), 'age' => $n(26, 18, 21),
                'nationality' => $country ? ['id' => $country->id, 'code' => $country->code, 'name' => $country->name] : null,
                'stats' => $stats, 'potential' => $potential, 'wage' => WorldPlayerProfiles::wageFor($stats) * 100, 'estimates' => $estimates];
        }
        return $out;
    }

    public function sign(OnlineClub $club, int $id, int $index): OwnedPlayerCard
    {
        return DB::transaction(function () use ($club, $id, $index) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $a = DB::table('scouting_assignments')->where('id', $id)->where('club_id', $club->id)->lockForUpdate()->first();
            abort_unless($a && $a->status === 'ready' && CarbonImmutable::parse($a->expires_at)->isFuture(), 409, 'This shortlist is no longer available.');
            $prospect = collect(json_decode($a->shortlist, true))->firstWhere('index', $index);
            abort_unless($prospect, 422, 'Choose one of the three prospects.');
            $owned = OwnedPlayerCard::where('user_id', $club->user_id)->pluck('definition_id')->all();
            $template = collect($catalog->payload['cards'])->first(fn ($c) => ! in_array($c['id'], $owned, true)) ?? $catalog->payload['cards'][0];
            $name = $prospect['name'];
            $taken = OwnedPlayerCard::withoutGlobalScopes()->whereRaw('LOWER(persona_name) = ?', [strtolower($name)]);
            $card = OwnedPlayerCard::create(['id' => (string) Str::uuid(), 'user_id' => $club->user_id, 'catalog_id' => $catalog->id, 'definition_id' => $template['id'],
                'grant_key' => 'scouting:'.$id, ...((clone $taken)->count() < 3 && ! (clone $taken)->where('user_id', $club->user_id)->exists() ? ['persona_name' => $name] : [])]);
            app(WorldPlayerIdentity::class)->assign($card, $catalog, false, 'scouting', $prospect['nationality']['id'] ?? null);
            $card->refresh();
            if (is_array($card->world_profile)) {
                $card->world_profile = array_replace($card->world_profile, ['stats' => $prospect['stats'], 'potential' => $prospect['potential'], 'source' => 'scouting',
                    'wage' => WorldPlayerProfiles::wageFor($prospect['stats']), 'birth_date' => now('UTC')->startOfDay()->subYears($prospect['age'])->subDays(120)->toDateString()]);
                $card->save();
            }
            DB::table('scouting_assignments')->where('id', $id)->update(['status' => 'signed', 'signed_player_id' => $card->id, 'updated_at' => now()]);
            app(WorldActivityService::class)->record('scouting:'.$id.':signed', 'recruitment', $club, $club->name.' signed '.($card->persona_name ?? 'a prospect').' after a scouting assignment.', ['player_id' => $card->id, 'player_instance_id' => $card->id]);
            return $card;
        }, 3);
    }

    public function pass(OnlineClub $club, int $id): void
    {
        DB::table('scouting_assignments')->where('id', $id)->where('club_id', $club->id)->whereIn('status', ['ready', 'searching'])->update(['status' => 'passed', 'updated_at' => now()]);
    }
}
