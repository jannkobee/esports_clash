<?php
namespace App\Services;

use App\Models\{ClubTournament, OnlineClub};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Every club competition with open places invites every eligible club automatically: no manager has to
 * remember to look. Human managers get an inbox invitation (and an email) with Enter and Decline; bot clubs
 * keep entering through their own management reviews. An invitation never enters a club by itself, and
 * entering still runs the normal eligibility, roster and registration checks.
 */
class CompetitionAutoInvites
{
    public const KIND = 'entry';

    /** Editions open for entry by open registration (invite-only editions keep their own invitations). */
    public function openEditions(int $limit = 60)
    {
        return ClubTournament::where('participant_type', 'club')->where('status', 'registration')->whereNotNull('definition_id')
            ->where('registration_closes_at', '>', now())->where(fn ($q) => $q->whereNull('registration_opens_at')->orWhere('registration_opens_at', '<=', now()))
            ->orderBy('registration_closes_at')->limit($limit)->get()
            ->filter(fn (ClubTournament $e) => collect($e->qualification ?? [])->contains(fn ($p) => ($p['method'] ?? null) === 'open'))->values();
    }

    /** Can this club enter now? Same checks as CompetitionQualification::eligible, without throwing. */
    public function eligible(ClubTournament $edition, OnlineClub $club): bool
    {
        try { app(CompetitionQualification::class)->eligible($edition, 'club', $club->id); } catch (\Throwable) { return false; }
        $entered = DB::table('club_tournament_entries')->where('tournament_id', $edition->id)->where('club_id', $club->id)->whereIn('status', ['accepted', 'pending'])->exists();
        $full = DB::table('club_tournament_entries')->where('tournament_id', $edition->id)->where('status', 'accepted')->count() >= (int) $edition->capacity;
        return ! $entered && ! $full;
    }

    public function key(ClubTournament $edition): string { return 'entry:'.$edition->id; }

    /** Invite every eligible human club to every open edition; resolve invitations that no longer apply. */
    public function tick(): int
    {
        $sent = 0;
        $editions = $this->openEditions();
        $office = app(ClubOffice::class);
        OnlineClub::where('is_bot', false)->whereNotNull('tag')->orderBy('id')->chunkById(200, function ($clubs) use ($editions, $office, &$sent) {
            foreach ($clubs as $club) foreach ($editions as $edition) {
                if (! $this->eligible($edition, $club)) continue;
                $closes = CarbonImmutable::parse($edition->registration_closes_at);
                $before = DB::table('club_inbox')->where('club_id', $club->id)->where('event_key', $this->key($edition))->exists();
                $office->notify($club->id, $this->key($edition), self::KIND, 'You are invited: '.($edition->name ?? 'a competition'),
                    'Your club is eligible. Registration closes '.$closes->setTimezone('Asia/Manila')->format('D j M, H:i').' Manila. Enter or decline from your inbox or the week calendar.',
                    ['type' => 'entry_invitation', 'id' => $edition->id, 'route' => 'competitions'], $closes);
                if (! $before) $sent++;
            }
        });
        // Closed registrations, full fields and clubs that entered no longer need their invitation.
        foreach (DB::table('club_inbox')->where('kind', self::KIND)->whereNull('resolved_at')->limit(2000)->get(['id', 'club_id', 'action']) as $row) {
            $id = json_decode($row->action ?? '{}', true)['id'] ?? null;
            $edition = $id ? ClubTournament::find($id) : null;
            $club = OnlineClub::find($row->club_id);
            if (! $edition || ! $club || $edition->status !== 'registration' || CarbonImmutable::parse($edition->registration_closes_at)->isPast() || ! $this->eligible($edition, $club))
                DB::table('club_inbox')->where('id', $row->id)->update(['resolved_at' => now()]);
        }
        return $sent;
    }

    /** Decline: the invitation is resolved and not sent again for this edition. */
    public function decline(OnlineClub $club, int $editionId): void
    {
        DB::table('club_inbox')->where('club_id', $club->id)->where('event_key', 'entry:'.$editionId)->update(['resolved_at' => now(), 'read_at' => DB::raw('COALESCE(read_at, CURRENT_TIMESTAMP)')]);
    }

    /**
     * The club's week at a glance: open invitations to answer, the community cup, fixtures this week and the
     * fixed weekly beats (Monday payroll and training, Wednesday 18:00 entry deadlines, Friday first rounds).
     */
    public function week(OnlineClub $club): array
    {
        $tz = 'Asia/Manila';
        $start = CarbonImmutable::now($tz)->startOfWeek();
        $invitations = [];
        foreach ($this->openEditions() as $edition) {
            $declined = DB::table('club_inbox')->where('club_id', $club->id)->where('event_key', $this->key($edition))->whereNotNull('resolved_at')->exists();
            if ($declined || ! $this->eligible($edition, $club)) continue;
            $invitations[] = ['id' => $edition->id, 'name' => $edition->name, 'tier' => $edition->tier, 'closes_at' => $edition->registration_closes_at,
                'starts_at' => $edition->starts_at, 'champion_prize' => (int) $edition->champion_prize, 'ranked' => (bool) $edition->ranked];
        }
        $entered = DB::table('club_tournament_entries as x')->join('club_tournaments as t', 't.id', '=', 'x.tournament_id')->where('x.club_id', $club->id)
            ->where('x.status', 'accepted')->whereNotIn('t.status', ['completed', 'cancelled'])->orderBy('t.starts_at')->limit(10)
            ->get(['t.id', 't.name', 't.starts_at', 't.status']);
        $cup = DB::getSchemaBuilder()->hasTable('community_cup_invitations') ? DB::table('community_cup_invitations')->where('club_id', $club->id)->orderByDesc('id')->first(['id', 'status', 'week_id']) : null;
        $beats = [
            ['at' => $start->setTime(0, 5)->utc()->toIso8601String(), 'label' => 'Weekly payroll and training are posted'],
            ['at' => $start->addDays(2)->setTime(18, 0)->utc()->toIso8601String(), 'label' => 'Division Trials and community cup answers close'],
            ['at' => $start->addDays(4)->setTime(18, 0)->utc()->toIso8601String(), 'label' => 'First rounds of the week begin'],
        ];
        // The season ends with the sponsor top-up and the tier review (promotion and relegation).
        $season = app(ClubEconomy::class)->season();
        $beats[] = ['at' => $season['ends_at'], 'label' => 'Season ends: tier review (relegation) and new sponsor budgets'];
        return ['week_starts_at' => $start->utc()->toIso8601String(), 'invitations' => $invitations, 'entered' => $entered, 'community_cup' => $cup, 'beats' => $beats];
    }
}
