<?php
namespace App\Services;

use App\Models\{OnlineCatalog, OnlineClub, OnlineMatch, OwnedPlayerCard, User};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The money side of running a club, reviewed on a schedule:
 *  - Sponsors are dynamic: every four-week sponsor season their capital is topped up to a published target
 *    that grows with the number of active clubs (finite capital, never an open-ended mint), and they make
 *    funded offers to clubs on their own, priced by tier, verified results and exposure.
 *  - Debt has consequences: a club in debt is warned; a manager who is both deep in debt and inactive gets
 *    a final warning by email and, if nothing changes within the grace period, is dismissed by the board.
 *    The club passes to an AI caretaker and keeps its players, history and fixtures; the manager can start
 *    again with a new club. An active manager is never dismissed for debt alone.
 */
class ClubEconomy
{
    /** Deep debt: below minus the larger of ₱10,000 or eight weeks of wages (centavos). */
    public const DEBT_LIMIT_FLOOR = 1_000_000;
    public const DEBT_LIMIT_WEEKS = 8;
    /** Inactive: the manager has not opened the club for this many days. */
    public const INACTIVE_DAYS = 21;
    /** Days between the final warning and dismissal. */
    public const GRACE_DAYS = 7;
    /** Sponsor season length and capital target (₱80,000 per sponsor plus ₱4,000 per active club). */
    public const SEASON_WEEKS = 4;
    public const SPONSOR_BASE_CAPITAL = 8_000_000;
    public const SPONSOR_CAPITAL_PER_ACTIVE_CLUB = 400_000;

    public function debtLimit(OnlineClub $club): int
    {
        return max(self::DEBT_LIMIT_FLOOR, self::DEBT_LIMIT_WEEKS * app(ClubMarketService::class)->weeklyWages($club));
    }

    public function seasonKey(?CarbonImmutable $at = null): string
    {
        $at ??= CarbonImmutable::now('Asia/Manila');
        $week = (int) floor($at->startOfWeek()->getTimestamp() / (7 * 86400));
        return 'S'.intdiv($week, self::SEASON_WEEKS);
    }

    /** @return array{key:string,starts_at:string,ends_at:string} */
    public function season(?CarbonImmutable $at = null): array
    {
        $at ??= CarbonImmutable::now('Asia/Manila');
        $week = (int) floor($at->startOfWeek()->getTimestamp() / (7 * 86400));
        $first = intdiv($week, self::SEASON_WEEKS) * self::SEASON_WEEKS;
        $start = CarbonImmutable::createFromTimestamp($first * 7 * 86400, 'UTC')->setTimezone('Asia/Manila')->startOfWeek();
        return ['key' => $this->seasonKey($at), 'starts_at' => $start->utc()->toIso8601String(), 'ends_at' => $start->addWeeks(self::SEASON_WEEKS)->utc()->toIso8601String()];
    }

    /** What the board watches, for the Finances page. */
    public function board(OnlineClub $club, int $available): array
    {
        $deal = DB::table('world_sponsor_deals as d')->join('world_sponsors as s', 's.id', '=', 'd.sponsor_id')->where('d.club_id', $club->id)
            ->whereIn('d.status', ['active', 'offered'])->orderByDesc('d.id')->first(['d.id', 'd.status', 'd.weekly_amount', 'd.reserved_amount', 'd.paid_amount', 'd.ends_at', 'd.expires_at', 's.name']);
        return ['season' => $this->season(), 'debt_limit' => $this->debtLimit($club), 'in_debt' => $available < 0,
            'debt_warned_at' => $club->debt_warned_at, 'dismissal_warned_at' => $club->dismissal_warned_at,
            'dismissal_at' => $club->dismissal_warned_at ? CarbonImmutable::parse($club->dismissal_warned_at)->addDays(self::GRACE_DAYS)->toIso8601String() : null,
            'inactive_days' => self::INACTIVE_DAYS, 'grace_days' => self::GRACE_DAYS,
            'sponsorship' => $deal ? ['id' => $deal->id, 'status' => $deal->status, 'sponsor' => $deal->name, 'weekly' => (int) $deal->weekly_amount,
                'remaining' => max(0, (int) $deal->reserved_amount - (int) $deal->paid_amount), 'ends_at' => $deal->ends_at, 'expires_at' => $deal->expires_at] : null];
    }

    public function activeClubs(): int
    {
        return (int) DB::table('online_clubs')->where(fn ($q) => $q->whereIn('user_id', OnlineMatch::where('status', 'completed')->where('completed_at', '>=', now()->subDays(28))->select('blue_user_id'))
            ->orWhereIn('user_id', OnlineMatch::where('status', 'completed')->where('completed_at', '>=', now()->subDays(28))->select('red_user_id')))->count();
    }

    /** Top each sponsor up to this season's target once per season. Returns the total added (centavos). */
    public function refillSponsors(): int
    {
        $sponsors = app(WorldSponsorships::class);
        $sponsors->install();
        $season = $this->seasonKey();
        $target = self::SPONSOR_BASE_CAPITAL + self::SPONSOR_CAPITAL_PER_ACTIVE_CLUB * $this->activeClubs();
        $added = 0;
        foreach (DB::table('world_sponsors')->orderBy('id')->get() as $s) {
            $topUp = max(0, $target - $sponsors->balance($s->id));
            if ($topUp > 0 && DB::table('world_sponsor_entries')->insertOrIgnore(['sponsor_id' => $s->id, 'reference' => 'sponsor:'.$s->slug.':season:'.$season,
                'kind' => 'Season budget', 'amount' => $topUp, 'created_at' => now()])) $added += $topUp;
        }
        return $added;
    }

    /** Sponsors approach clubs without a deal (once per club per season). Human clubs answer in Staff → sponsorships. */
    public function offerSponsors(int $limit = 200): int
    {
        $season = $this->seasonKey();
        $offered = 0;
        $busy = DB::table('world_sponsor_deals')->whereNotNull('active_club_key')->pluck('club_id')->all();
        // Bot clubs take sponsorships through their own business reviews (WorldBusinessEngine).
        foreach (OnlineClub::where('is_bot', false)->whereNotIn('id', $busy)->whereNotNull('tag')->orderBy('id')->limit($limit)->get() as $club) {
            try {
                $before = DB::table('world_sponsor_deals')->where('request_key', 'sponsor:'.$club->id.':season:'.$season)->exists();
                app(WorldSponsorships::class)->offer($club, 'season:'.$season);
                if (! $before) $offered++;
            } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                // No funded sponsor sees enough exposure yet: try again next season.
            }
        }
        return $offered;
    }

    /** Daily review of human clubs' debt. @return array{warned:int,final:int,dismissed:int,lifted:int} */
    public function reviewDebt(): array
    {
        $counts = ['warned' => 0, 'final' => 0, 'dismissed' => 0, 'lifted' => 0];
        $market = app(ClubMarketService::class);
        $office = app(ClubOffice::class);
        OnlineClub::where('is_bot', false)->orderBy('id')->chunkById(100, function ($clubs) use (&$counts, $market, $office) {
            foreach ($clubs as $club) {
                $cash = $market->balance($club->id);
                if ($cash >= 0) {
                    if ($club->debt_warned_at || $club->dismissal_warned_at) {
                        $club->update(['debt_warned_at' => null, 'dismissal_warned_at' => null]);
                        $office->notify($club->id, 'debt-cleared:'.now('Asia/Manila')->toDateString(), 'debt', 'Your club is out of debt', 'The board has withdrawn its warning. Keep enough cash for at least four weeks of wages.', ['type' => 'route', 'route' => 'finances']);
                        $counts['lifted']++;
                    }
                    continue;
                }
                $limit = $this->debtLimit($club);
                $money = fn (int $v) => '₱'.number_format(abs($v) / 100, 0);
                if (! $club->debt_warned_at) {
                    $club->update(['debt_warned_at' => now()]);
                    $office->notify($club->id, 'debt:'.$club->id.':'.now('Asia/Manila')->format('o-W'), 'debt', 'Your club is in debt',
                        'Your club owes '.$money($cash).'. Wages keep being charged. If the debt passes '.$money($limit).' while you are away for '.self::INACTIVE_DAYS.' days, the board will dismiss you. Sell a player, end a staff contract or accept a sponsorship.',
                        ['type' => 'route', 'route' => 'finances']);
                    $counts['warned']++;
                }
                $seen = $club->manager_seen_at ? CarbonImmutable::parse($club->manager_seen_at) : null;
                $inactive = ! $seen || $seen->lt(now()->subDays(self::INACTIVE_DAYS));
                if ($cash > -$limit || ! $inactive) {
                    if ($club->dismissal_warned_at) {
                        $club->update(['dismissal_warned_at' => null]);
                        $office->notify($club->id, 'dismissal-lifted:'.now()->format('Y-m-d-H'), 'debt', 'The board has withdrawn its final warning', $inactive ? 'Your debt is back within the limit.' : 'You are managing the club again. Bring the debt under control.', ['type' => 'route', 'route' => 'finances']);
                        $counts['lifted']++;
                    }
                    continue;
                }
                if (! $club->dismissal_warned_at) {
                    $club->update(['dismissal_warned_at' => now()]);
                    $deadline = now()->addDays(self::GRACE_DAYS);
                    $office->notify($club->id, 'dismissal-warning:'.$club->id.':'.now()->toDateString(), 'dismissal', 'Final warning: the board will dismiss you',
                        'Your club owes '.$money($cash).', past the board\'s limit of '.$money($limit).', and you have not managed the club for '.self::INACTIVE_DAYS.' days. Sign in and act before '.$deadline->setTimezone('Asia/Manila')->format('D j M, H:i').' Manila, or the board will hand the club to a caretaker.',
                        ['type' => 'route', 'route' => 'finances'], $deadline);
                    $counts['final']++;
                } elseif (CarbonImmutable::parse($club->dismissal_warned_at)->lte(now()->subDays(self::GRACE_DAYS))) {
                    if ($this->dismiss($club, $cash, $limit)) $counts['dismissed']++;
                }
            }
        });
        return $counts;
    }

    /** Hand the club to an AI caretaker. Players, history, fixtures and finances stay with the club. */
    public function dismiss(OnlineClub $club, int $cash, int $limit): bool
    {
        $user = User::find($club->user_id);
        if (! $user) return false;
        $done = DB::transaction(function () use ($club, $user, $cash, $limit) {
            OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            if ($club->is_bot || $club->user_id !== $user->id) return false;
            // Never mid-match: try again at the next review.
            if (OnlineMatch::whereIn('status', ['allocated', 'running'])->where(fn ($q) => $q->where('blue_user_id', $user->id)->orWhere('red_user_id', $user->id))->exists()) return false;
            $identity = app(WorldClubIdentity::class)->make('caretaker:'.$club->id);
            $caretaker = User::create(['name' => $identity['manager'] ?? 'Club caretaker', 'email' => Str::lower(Str::random(24)).'@world.hexatrick.invalid', 'password' => Str::random(64)]);
            OwnedPlayerCard::where('user_id', $user->id)->update(['user_id' => $caretaker->id]);
            foreach (['normal_queue_tickets' => 'cancelled', 'scrimmage_queue_tickets' => 'left'] as $table => $status)
                if (DB::getSchemaBuilder()->hasTable($table)) DB::table($table)->where('user_id', $user->id)->where('status', 'queued')->update(['status' => $status, 'updated_at' => now()]);
            $warned = $club->dismissal_warned_at;
            $club->update(['user_id' => $caretaker->id, 'is_bot' => true, 'revision' => $club->revision + 1, 'debt_warned_at' => null, 'dismissal_warned_at' => null]);
            DB::table('online_clubs')->where('id', $club->id)->increment('management_epoch');
            DB::table('club_manager_history')->where('club_id', $club->id)->whereNull('ends_at')->update(['ends_at' => now()]);
            DB::table('club_manager_history')->insert(['club_id' => $club->id, 'user_id' => $caretaker->id, 'kind' => 'bot', 'starts_at' => now()]);
            DB::table('manager_dismissals')->insert(['club_id' => $club->id, 'user_id' => $user->id, 'cash_at_dismissal' => $cash, 'debt_limit' => $limit,
                'last_seen_at' => $club->manager_seen_at, 'warned_at' => $warned ?? now(), 'dismissed_at' => now()]);
            app(WorldActivityService::class)->record('club:'.$club->id.':dismissed:'.$user->id, 'club', $club, $club->name.' dismissed its manager after a long absence with the club deep in debt.', ['team_id' => $club->id]);
            return true;
        }, 3);
        if ($done) app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'dismissed:'.$club->id, 'The board of '.$club->name.' has dismissed you',
            ['Your club owed '.'₱'.number_format(abs($cash) / 100, 0).', past the board\'s limit, and you had not managed it for '.self::INACTIVE_DAYS.' days after the final warning.',
             'The club, its players and its history continue under a caretaker. Your account, Supporter membership and records are kept.',
             'Sign in to start again with a new club.'], 'Start a new club', 'club-home');
        return (bool) $done;
    }
}
