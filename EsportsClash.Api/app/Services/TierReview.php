<?php
namespace App\Services;

use App\Models\{ClubFixture, CompetitionGeography, OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Season-end tier review. Division Trials promote their champions every week; at the end of each sponsor
 * season the same number of clubs leave each regional tier downward, so the pyramid keeps its shape and a
 * tier means "plays at this level". Relegation is decided only on verified results in competitions during
 * the season (scrimmages and community cups don't count), then rating, then games played. Clubs promoted
 * during the season and human clubs in their first season are protected. No matches are added, so it
 * costs no simulation capacity.
 */
class TierReview
{
    private array $regionOf = [];

    private function region(?int $geographyId): ?int
    {
        if (! $geographyId) return null;
        if (array_key_exists($geographyId, $this->regionOf)) return $this->regionOf[$geographyId];
        $path = CompetitionGeography::find($geographyId)?->path() ?? [];
        $region = CompetitionGeography::whereIn('id', $path)->where('kind', 'region')->value('id');
        return $this->regionOf[$geographyId] = $region;
    }

    /** @return array{season:string,relegated:int,skipped?:bool} */
    public function run(?CarbonImmutable $now = null): array
    {
        $economy = app(ClubEconomy::class);
        $current = $economy->season($now);
        $previous = $economy->season(CarbonImmutable::parse($current['starts_at'])->setTimezone('Asia/Manila')->subDay());
        $season = $previous['key'];
        if (DB::table('tier_review_runs')->where('season', $season)->exists()) return ['season' => $season, 'relegated' => 0, 'skipped' => true];
        // The first season reviewed is the first one played with relegation announced: earlier seasons are a baseline.
        if (! DB::table('tier_review_runs')->exists()) {
            DB::table('tier_review_runs')->insertOrIgnore(['season' => $season, 'relegated' => 0, 'created_at' => now()]);
            return ['season' => $season, 'relegated' => 0, 'skipped' => true];
        }
        [$from, $to] = [CarbonImmutable::parse($previous['starts_at']), CarbonImmutable::parse($previous['ends_at'])];
        $relegated = 0;
        DB::transaction(function () use ($season, $from, $to, &$relegated) {
            if (! DB::table('tier_review_runs')->insertOrIgnore(['season' => $season, 'relegated' => 0, 'created_at' => now()])) return;
            $promoted = DB::table('club_tier_movements')->whereBetween('earned_at', [$from, $to])->get(['club_id', 'to_tier']);
            $promotedIds = $promoted->pluck('club_id')->all();
            $clubs = OnlineClub::whereBetween('tier', [1, 4])->lockForUpdate()->get();
            $inflow = [];
            foreach ($promoted as $p) {
                $club = $clubs->firstWhere('id', $p->club_id);
                if ($club) $inflow[$this->region($club->geography_id).':'.$p->to_tier] = ($inflow[$this->region($club->geography_id).':'.$p->to_tier] ?? 0) + 1;
            }
            $groups = $clubs->groupBy(fn (OnlineClub $c) => $this->region($c->geography_id).':'.$c->tier);
            foreach ($groups as $key => $group) {
                $count = $inflow[$key] ?? 0;
                if ($count < 1) continue;
                $candidates = $group->reject(fn (OnlineClub $c) => in_array($c->id, $promotedIds, true) || $this->protectedFirstSeason($c, $from))
                    ->map(fn (OnlineClub $c) => ['club' => $c] + $this->record($c, $from, $to))
                    ->sort(fn ($a, $b) => [$a['points'], $a['rating'], $a['games']] <=> [$b['points'], $b['rating'], $b['games']])->values();
                foreach ($candidates->take($count) as $row) {
                    $club = $row['club'];
                    $fromTier = (int) $club->tier;
                    $club->update(['tier' => $fromTier + 1]);
                    DB::table('club_tier_reviews')->insertOrIgnore(['season' => $season, 'club_id' => $club->id, 'from_tier' => $fromTier, 'to_tier' => $fromTier + 1,
                        'record' => json_encode(array_diff_key($row, ['club' => true])), 'created_at' => now()]);
                    app(ClubOffice::class)->notify($club->id, 'relegation:'.$season, 'tier', 'Relegated to Tier '.($fromTier + 1),
                        'The season review moved your club down one tier: '.$row['wins'].' wins and '.$row['losses'].' losses in competitions this season. Win your new tier\'s Division Trials to come back up.',
                        ['type' => 'route', 'route' => 'competitions']);
                    app(WorldActivityService::class)->record('relegation:'.$season.':'.$club->id, 'club', $club, $club->name.' was relegated to Tier '.($fromTier + 1).' in the season review.', ['team_id' => $club->id]);
                    $relegated++;
                }
            }
            DB::table('tier_review_runs')->where('season', $season)->update(['relegated' => $relegated]);
        }, 3);
        return ['season' => $season, 'relegated' => $relegated];
    }

    /** A human manager's first season with their club is protected (new or just taken over). */
    private function protectedFirstSeason(OnlineClub $club, CarbonImmutable $seasonStart): bool
    {
        if ($club->is_bot) return false;
        $since = DB::table('club_manager_history')->where('club_id', $club->id)->whereNull('ends_at')->value('starts_at') ?? $club->created_at;
        return $since && CarbonImmutable::parse($since)->gt($seasonStart);
    }

    /** Verified competition results in the season window (no scrimmages, no community cups). */
    public function record(OnlineClub $club, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $fixtures = ClubFixture::where(fn ($q) => $q->where('home_club_id', $club->id)->orWhere('away_club_id', $club->id))
            ->whereNotNull('tournament_id')->whereNotNull('result_winner')->whereBetween('kickoff_at', [$from, $to])
            ->whereNotIn('tournament_id', DB::table('club_tournaments')->where('accreditation', CommunityCups::ACCREDITATION)->select('id'))->get();
        $wins = $fixtures->filter(fn (ClubFixture $f) => $f->outcomeFor($club->id) === 'win')->count();
        $rating = (float) (DB::table('competition_ratings')->where('system', 'HGR')->where('participant_id', $club->id)->value('score') ?? 0);
        return ['points' => 3 * $wins, 'wins' => $wins, 'losses' => $fixtures->count() - $wins, 'games' => $fixtures->count(), 'rating' => round($rating, 1)];
    }
}
