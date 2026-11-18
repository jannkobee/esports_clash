<?php
namespace App\Services;

use App\Billing\{BillingProvider, MockBillingProvider};
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Supporter memberships for money: checkout, monthly renewal, cancel at period end, receipts and reminders.
 * Entitlements stay cosmetic (SupporterMembership): paying never buys money, players, scouting, training,
 * staff or qualification. Until the owner chooses a provider, the mock provider moves no money.
 */
class SupporterBilling
{
    public const PLANS = ['signal', 'beacon'];

    public function provider(): BillingProvider
    {
        return match (config('billing.provider')) {
            default => app(MockBillingProvider::class),
        };
    }

    public function price(string $plan): int
    {
        return (int) (config('billing.prices')[$plan] ?? 0);
    }

    public function desk(User $user): array
    {
        $sub = DB::table('supporter_subscriptions')->where('user_id', $user->id)->first();
        return ['provider' => $this->provider()->name(), 'test_mode' => $this->provider()->isTest(), 'currency' => config('billing.currency'),
            'prices' => array_combine(self::PLANS, array_map(fn ($p) => $this->price($p), self::PLANS)),
            'subscription' => $sub ? ['plan' => $sub->plan, 'status' => $sub->status, 'current_period_end' => $sub->current_period_end, 'cancel_at_period_end' => (bool) $sub->cancel_at_period_end] : null,
            'payments' => DB::table('supporter_payments')->where('user_id', $user->id)->orderByDesc('id')->limit(24)
                ->get(['id', 'plan', 'amount', 'currency', 'status', 'period_start', 'period_end', 'reference', 'created_at'])];
    }

    public function checkout(User $user, string $plan): array
    {
        abort_unless(in_array($plan, self::PLANS, true), 422, 'Choose Signal or Beacon.');
        abort_if((bool) $user->is_game_owner || (bool) $user->is_evolution_admin, 409, 'Your account already has a permanent membership.');
        $id = (string) Str::uuid();
        DB::table('supporter_checkouts')->where('user_id', $user->id)->where('status', 'pending')->update(['status' => 'cancelled', 'updated_at' => now()]);
        DB::table('supporter_checkouts')->insert(['id' => $id, 'user_id' => $user->id, 'plan' => $plan, 'amount' => $this->price($plan), 'currency' => config('billing.currency'),
            'provider' => $this->provider()->name(), 'status' => 'pending', 'expires_at' => now()->addMinutes(30), 'created_at' => now(), 'updated_at' => now()]);
        return ['checkout_id' => $id, 'url' => $this->provider()->checkoutUrl($id), 'test_mode' => $this->provider()->isTest(), 'amount' => $this->price($plan), 'plan' => $plan];
    }

    public function checkoutDetails(User $user, string $id): array
    {
        $c = DB::table('supporter_checkouts')->where('id', $id)->where('user_id', $user->id)->first();
        abort_unless($c, 404);
        return ['id' => $c->id, 'plan' => $c->plan, 'amount' => (int) $c->amount, 'currency' => $c->currency, 'status' => $c->status, 'expires_at' => $c->expires_at, 'test_mode' => $this->provider()->isTest()];
    }

    /**
     * A provider confirmed (or declined) a checkout. Idempotent: a paid checkout is applied once. A new
     * period starts at the later of now and the current paid end, so paying early never loses days.
     */
    public function completeCheckout(string $id, bool $paid, ?string $providerRef = null): array
    {
        return DB::transaction(function () use ($id, $paid, $providerRef) {
            $c = DB::table('supporter_checkouts')->where('id', $id)->lockForUpdate()->first();
            abort_unless($c, 404);
            if ($c->status === 'paid') return ['status' => 'paid'];
            abort_unless($c->status === 'pending', 409, 'This checkout is no longer open.');
            if (CarbonImmutable::parse($c->expires_at)->isPast()) {
                DB::table('supporter_checkouts')->where('id', $id)->update(['status' => 'expired', 'updated_at' => now()]);
                abort(409, 'This checkout expired. Start again from the Supporter studio.');
            }
            if (! $paid) {
                DB::table('supporter_checkouts')->where('id', $id)->update(['status' => 'declined', 'updated_at' => now()]);
                return ['status' => 'declined'];
            }
            $user = User::lockForUpdate()->findOrFail($c->user_id);
            $start = CarbonImmutable::now('UTC')->max($user->supporter_until ? CarbonImmutable::parse($user->supporter_until) : CarbonImmutable::now('UTC'));
            $end = $start->addMonthNoOverflow();
            $user->forceFill(['supporter_until' => $end, 'supporter_level' => $c->plan])->save();
            DB::table('supporter_checkouts')->where('id', $id)->update(['status' => 'paid', 'paid_at' => now(), 'updated_at' => now()]);
            DB::table('supporter_subscriptions')->updateOrInsert(['user_id' => $user->id], ['plan' => $c->plan, 'status' => 'active', 'provider' => $c->provider,
                'provider_ref' => $providerRef, 'current_period_end' => $end, 'cancel_at_period_end' => false, 'failed_attempts' => 0, 'created_at' => now(), 'updated_at' => now()]);
            $reference = 'checkout:'.$id;
            DB::table('supporter_payments')->insertOrIgnore(['user_id' => $user->id, 'checkout_id' => $id, 'plan' => $c->plan, 'amount' => $c->amount, 'currency' => $c->currency,
                'provider' => $c->provider, 'reference' => $reference, 'status' => 'paid', 'period_start' => $start, 'period_end' => $end, 'created_at' => now()]);
            app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'billing:'.$reference, 'Receipt: '.ucfirst($c->plan).' membership',
                [ucfirst($c->plan).' is active until '.$end->setTimezone('Asia/Manila')->format('j M Y').'. It renews monthly; you can cancel at any time in the Supporter studio.',
                 'Amount: ₱'.number_format($c->amount / 100, 2).($this->provider()->isTest() ? ' (test payment: no money was charged).' : '.')], 'Supporter studio', 'supporter-studio');
            return ['status' => 'paid', 'period_end' => $end->toIso8601String()];
        }, 3);
    }

    public function cancel(User $user, bool $cancel): void
    {
        $updated = DB::table('supporter_subscriptions')->where('user_id', $user->id)->where('status', 'active')->update(['cancel_at_period_end' => $cancel, 'updated_at' => now()]);
        abort_unless($updated, 409, 'There is no active paid membership.');
    }

    /** Renew due memberships, end cancelled ones, and send reminders. @return array{renewed:int,ended:int,failed:int,reminded:int} */
    public function tick(): array
    {
        $counts = ['renewed' => 0, 'ended' => 0, 'failed' => 0, 'reminded' => 0];
        foreach (DB::table('supporter_subscriptions')->where('status', 'active')->where('current_period_end', '<=', now()->addHour())->limit(500)->get() as $sub) {
            DB::transaction(function () use ($sub, &$counts) {
                $s = DB::table('supporter_subscriptions')->where('id', $sub->id)->lockForUpdate()->first();
                if ($s->status !== 'active' || CarbonImmutable::parse($s->current_period_end)->gt(now()->addHour())) return;
                $user = User::lockForUpdate()->find($s->user_id);
                if (! $user) return;
                if ($s->cancel_at_period_end) {
                    DB::table('supporter_subscriptions')->where('id', $s->id)->update(['status' => 'ended', 'updated_at' => now()]);
                    $counts['ended']++;
                    return;
                }
                $start = CarbonImmutable::parse($s->current_period_end);
                $key = 'renewal:'.$s->id.':'.$start->format('Ymd');
                $ref = $this->provider()->chargeRenewal($user->id, $s->plan, $this->price($s->plan), (string) config('billing.currency'), $key);
                if ($ref === null) {
                    $attempts = $s->failed_attempts + 1;
                    DB::table('supporter_subscriptions')->where('id', $s->id)->update(['failed_attempts' => $attempts, 'status' => $attempts >= 3 ? 'past_due' : 'active',
                        'current_period_end' => $attempts >= 3 ? $s->current_period_end : now()->addDay(), 'updated_at' => now()]);
                    app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'billing:failed:'.$key.':'.$attempts, 'Your Supporter renewal did not go through',
                        [$attempts >= 3 ? 'We could not renew your membership after three attempts, so it has ended. Your saved artwork and settings are kept for when you rejoin.' : 'We will try again tomorrow. Your membership stays active meanwhile.'], 'Supporter studio', 'supporter-studio');
                    $counts['failed']++;
                    return;
                }
                $end = $start->addMonthNoOverflow();
                $user->forceFill(['supporter_until' => $end, 'supporter_level' => $s->plan])->save();
                DB::table('supporter_subscriptions')->where('id', $s->id)->update(['current_period_end' => $end, 'failed_attempts' => 0, 'provider_ref' => $ref, 'updated_at' => now()]);
                DB::table('supporter_payments')->insertOrIgnore(['user_id' => $user->id, 'checkout_id' => null, 'plan' => $s->plan, 'amount' => $this->price($s->plan), 'currency' => config('billing.currency'),
                    'provider' => $s->provider, 'reference' => $key, 'status' => 'paid', 'period_start' => $start, 'period_end' => $end, 'created_at' => now()]);
                app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'billing:'.$key, 'Receipt: '.ucfirst($s->plan).' renewed',
                    ['Your membership renewed until '.$end->setTimezone('Asia/Manila')->format('j M Y').'.', 'Amount: ₱'.number_format($this->price($s->plan) / 100, 2).($this->provider()->isTest() ? ' (test payment: no money was charged).' : '.')], 'Supporter studio', 'supporter-studio');
                $counts['renewed']++;
            }, 3);
        }
        $days = (int) config('billing.reminder_days', 3);
        // Trials and cancelled memberships about to end: say exactly what changes.
        foreach (User::whereNotNull('supporter_trial_ends_at')->whereBetween('supporter_trial_ends_at', [now(), now()->addDays($days)])->limit(500)->get() as $user) {
            if (DB::table('supporter_subscriptions')->where('user_id', $user->id)->where('status', 'active')->exists()) continue;
            if (app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'billing:trial-ending:'.CarbonImmutable::parse($user->supporter_trial_ends_at)->format('Ymd'), 'Your Beacon trial ends soon',
                ['Your free Beacon month ends on '.CarbonImmutable::parse($user->supporter_trial_ends_at)->setTimezone('Asia/Manila')->format('j M Y').'.',
                 'After that, interface themes return to Cinder and new crest, jersey and player-presentation edits need a membership. Everything you saved stays attached to your club and players.',
                 'Keep Signal or Beacon from the Supporter studio. It is cosmetic only: it never affects matches, money or players.'], 'Keep my membership', 'supporter-studio')) $counts['reminded']++;
        }
        foreach (DB::table('supporter_subscriptions')->where('status', 'active')->where('cancel_at_period_end', true)->whereBetween('current_period_end', [now(), now()->addDays($days)])->limit(500)->get() as $sub) {
            $user = User::find($sub->user_id);
            if ($user && app(ManagerMail::class)->send($user, ManagerMail::ACCOUNT, 'billing:cancel-ending:'.$sub->id.':'.CarbonImmutable::parse($sub->current_period_end)->format('Ymd'), 'Your Supporter membership ends soon',
                ['Your cancelled '.ucfirst($sub->plan).' membership ends on '.CarbonImmutable::parse($sub->current_period_end)->setTimezone('Asia/Manila')->format('j M Y').'. Resume it any time before then from the Supporter studio.'], 'Supporter studio', 'supporter-studio')) $counts['reminded']++;
        }
        return $counts;
    }
}
