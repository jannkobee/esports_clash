<?php
namespace App\Services;

use App\Models\{OnlineClub, User};
use App\Notifications\ManagerMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Real email to human managers, by category. Account email (password reset, verification, billing,
 * dismissal) always goes out; every other category can be switched off. Each event is sent at most once.
 * Bot clubs and their placeholder addresses never receive email. Messages never contain another club's
 * private orders or any private player state.
 */
class ManagerMail
{
    public const CATEGORIES = [
        'results' => ['Match results', 'The score and a link to the report when your match is settled.'],
        'orders' => ['Order deadlines', 'A reminder when a fixture\'s orders are open, before they close.'],
        'competitions' => ['Competitions', 'Invitations, scrimmage requests, promotion and relegation.'],
        'market' => ['Transfers and offers', 'Trades, auctions you lead or lose, and sponsorship offers.'],
        'club' => ['Club warnings', 'Debt warnings, contract endings and new player levels.'],
    ];
    /** Always sent (cannot be switched off): access to the account and the club itself. */
    public const ACCOUNT = 'account';
    /** Inbox kinds that also email, and their category. Kinds not listed stay in the inbox only. */
    public const INBOX_KINDS = ['result' => 'results', 'orders' => 'orders', 'invitation' => 'competitions', 'entry' => 'competitions', 'tier' => 'competitions', 'scrimmage' => 'competitions',
        'competition' => 'competitions', 'fixture' => 'competitions', 'market' => 'market', 'finance' => 'market', 'staff' => 'club',
        'training' => 'club', 'debt' => 'club', 'membership' => self::ACCOUNT, 'dismissal' => self::ACCOUNT];

    public function frontendUrl(string $hash = ''): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/'.($hash !== '' ? '#'.ltrim($hash, '#') : '');
    }

    /** @return array{categories:array<string,bool>,token:string} */
    public function preferences(User $user): array
    {
        $row = DB::table('manager_email_preferences')->where('user_id', $user->id)->first();
        if (! $row) {
            $token = Str::random(48);
            DB::table('manager_email_preferences')->insertOrIgnore(['user_id' => $user->id, 'categories' => json_encode(array_fill_keys(array_keys(self::CATEGORIES), true)),
                'unsubscribe_token' => $token, 'created_at' => now(), 'updated_at' => now()]);
            $row = DB::table('manager_email_preferences')->where('user_id', $user->id)->first();
        }
        $saved = json_decode($row->categories, true) ?: [];
        return ['categories' => array_map(fn ($key) => (bool) ($saved[$key] ?? true), array_combine(array_keys(self::CATEGORIES), array_keys(self::CATEGORIES))), 'token' => $row->unsubscribe_token];
    }

    public function update(User $user, array $categories): array
    {
        $current = $this->preferences($user)['categories'];
        foreach ($categories as $key => $on) if (array_key_exists($key, self::CATEGORIES)) $current[$key] = (bool) $on;
        DB::table('manager_email_preferences')->where('user_id', $user->id)->update(['categories' => json_encode($current), 'updated_at' => now()]);
        return $this->preferences($user);
    }

    /** One-click unsubscribe from a category (or from everything optional) by the token in each email. */
    public function unsubscribe(string $token, ?string $category): bool
    {
        $row = DB::table('manager_email_preferences')->where('unsubscribe_token', $token)->first();
        if (! $row) return false;
        $saved = json_decode($row->categories, true) ?: [];
        foreach (array_keys(self::CATEGORIES) as $key) if ($category === null || $category === $key) $saved[$key] = false;
        DB::table('manager_email_preferences')->where('id', $row->id)->update(['categories' => json_encode($saved), 'updated_at' => now()]);
        return true;
    }

    public static function emailable(?User $user): bool
    {
        return $user !== null && $user->email && ! str_ends_with(strtolower($user->email), '.invalid')
            && ! OnlineClub::where('user_id', $user->id)->where('is_bot', true)->exists();
    }

    /**
     * Send one email for an event (de-duplicated by key). Returns true when queued.
     * @param string[] $lines
     */
    public function send(User $user, string $category, string $key, string $subject, array $lines, ?string $actionText = null, ?string $actionHash = null): bool
    {
        if (! Schema::hasTable('manager_emails') || ! self::emailable($user)) return false;
        $prefs = $this->preferences($user);
        if ($category !== self::ACCOUNT && ! ($prefs['categories'][$category] ?? false)) return false;
        if (! DB::table('manager_emails')->insertOrIgnore(['user_id' => $user->id, 'category' => $category, 'event_key' => Str::limit($key, 190, ''),
            'subject' => Str::limit($subject, 200, ''), 'status' => 'queued', 'created_at' => now()])) return false;
        $unsubscribe = $category === self::ACCOUNT ? null : rtrim((string) config('app.url'), '/').'/api/v1/notifications/unsubscribe/'.$prefs['token'].'?category='.$category;
        $user->notify(new ManagerMessage($subject, $lines, $actionText, $actionHash !== null ? $this->frontendUrl($actionHash) : null,
            $this->frontendUrl('settings?section=email'), $unsubscribe));
        return true;
    }

    /** Email the human manager of a club about an inbox event, when its kind emails. */
    public function forInbox(int $clubId, string $key, string $kind, string $title, string $body, array $action = []): void
    {
        $category = self::INBOX_KINDS[$kind] ?? null;
        if ($category === null) return;
        $club = OnlineClub::find($clubId);
        if (! $club || $club->is_bot) return;
        $user = User::find($club->user_id);
        if (! $user) return;
        $route = $action['route'] ?? null;
        $hash = match ($action['type'] ?? null) {
            'match' => 'match-centre?match='.($action['id'] ?? ''),
            'tournament_invitation' => 'competitions',
            default => is_string($route) ? $route : 'club-home',
        };
        $this->send($user, $category, 'inbox:'.$clubId.':'.$key, $title, [$body], 'Open Hexatrick', $hash);
    }
}
