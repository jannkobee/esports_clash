<?php

namespace App\Services;

use App\Models\{ClubFixture, ClubTournament, OnlineClub};
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class ClubTournamentService
{
    public function register(int $id, OnlineClub $club, ?int $managementEpoch = null): void
    {
        if (ClubTournament::findOrFail($id)->definition_id) {
            app(CompetitionQualification::class)->enter($id, 'club', $club->id, ['method'=>'open',...($club->is_bot?['bot_fill'=>true]:[])], managementEpoch:$managementEpoch);
            return;
        }
        DB::transaction(function () use ($id, $club, $managementEpoch) {
            $event = ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();
            $club = OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
            if($managementEpoch!==null)abort_unless($club->is_bot && (int)$club->management_epoch===$managementEpoch,409,'Management authority changed.');
            abort_if($event->status !== 'registration' || $event->registration_closes_at->lte(now()), 409, 'Registration has closed.');
            abort_if($club->tier !== $event->tier || ! $club->tag, 422, 'A club identity and matching tier are required.');
            $entries = DB::table('club_tournament_entries')->where('tournament_id', $id);
            if ((clone $entries)->where('club_id', $club->id)->exists()) return;
            if($entries->count()>=4){
                $bot=(clone $entries)->join('online_clubs as bots','bots.id','=','club_tournament_entries.club_id')->where('bots.is_bot',true)->where('source->method','bot_fill')->orderByDesc('club_tournament_entries.id')->select('club_tournament_entries.id')->first();
                abort_unless($bot && !$club->is_bot,409,'Registration is full.');
                DB::table('club_tournament_entries')->where('id',$bot->id)->update(['club_id'=>$club->id,'source'=>json_encode(['method'=>'open','replaced_bot'=>true])]);return;
            }
            DB::table('club_tournament_entries')->insert(['tournament_id' => $id, 'club_id' => $club->id,'source'=>json_encode(['method'=>$club->is_bot?'bot_fill':'open'])]);
            app(WorldActivityService::class)->record("event:$id:entry:$club->id", 'competition', $club, $club->name.' entered '.$event->title().'.', ['tournament_id' => $id]);
        }, 3);
    }

    public function advance(int $id): void
    {
        if (ClubTournament::findOrFail($id)->definition_id) {
            app(CompetitionEngine::class)->advance($id);
            return;
        }
        DB::transaction(function () use ($id) {
            $event = ClubTournament::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($event->status === 'registration' && $event->registration_closes_at->lte(now())) {
                $entries = DB::table('club_tournament_entries')->where('tournament_id', $id)->orderBy('id')->pluck('club_id')->all();
                if (count($entries) > 0 && count($entries) < 4) {
                    $bots = OnlineClub::where('is_bot', true)->where('tier', $event->tier)->whereNotIn('id', $entries)
                        ->orderBy('id')->limit(4 - count($entries))->pluck('id')->all();
                    $entries = [...$entries, ...$bots];
                    if (count($entries) === 4) {
                        DB::table('club_tournament_entries')->insert(array_map(fn ($bot) => ['tournament_id' => $id, 'club_id' => $bot], $bots));
                    }
                }
                if (count($entries) !== 4) {
                    $event->update(['status' => 'cancelled']);
                    return;
                }
                $this->scheduleRound($event, $event->semifinals_at, [[$entries[0], $entries[3]], [$entries[1], $entries[2]]], 1, 'semifinals');
            } elseif ($event->status === 'semifinals') {
                $fixtures = $event->fixtures()->with('match')->orderBy('bracket_slot')->get();
                if ($fixtures->contains(fn ($fixture) => $fixture->hold_reason || $fixture->match?->status === 'failed')) {
                    $event->update(['status' => 'review']);
                } elseif ($fixtures->count() === 2 && $fixtures->every(fn ($fixture) => $fixture->match?->status === 'completed')) {
                    $this->scheduleRound($event, $event->final_at, [[$this->winner($fixtures[0]), $this->winner($fixtures[1])]], 3, 'final');
                }
            } elseif ($event->status === 'final') {
                $final = $event->fixtures()->where('bracket_slot', 3)->with('match')->firstOrFail();
                if ($final->hold_reason || $final->match?->status === 'failed') {
                    $event->update(['status' => 'review']);
                } elseif ($final->match?->status === 'completed') {
                    $winner = $this->winner($final);
                    $runnerUp = $winner === $final->home_club_id ? $final->away_club_id : $final->home_club_id;
                    DB::table('club_money_entries')->insert([
                        ['club_id' => $winner, 'amount' => $event->champion_prize, 'kind' => 'Champion prize', 'reference' => "event:$id:champion", 'created_at' => now()],
                        ['club_id' => $runnerUp, 'amount' => $event->runner_up_prize, 'kind' => 'Runner-up prize', 'reference' => "event:$id:runner-up", 'created_at' => now()],
                    ]);
                    OnlineClub::whereKey($winner)->where('tier', $event->tier)->where('tier', '>', 1)->decrement('tier');
                    $event->update(['status' => 'completed', 'champion_id' => $winner]);
                    $champion = OnlineClub::findOrFail($winner);
                    app(WorldActivityService::class)->record("event:$id:champion", 'competition', $champion, $champion->name.' won '.$event->title().'.', ['tournament_id' => $id, 'amount' => $event->champion_prize, 'currency' => 'PHP']);
                }
            }
        }, 3);
    }

    private function winner(ClubFixture $fixture): int
    {
        return $fixture->match->result['winner'] === 'blue' ? $fixture->home_club_id : $fixture->away_club_id;
    }

    private function scheduleRound(ClubTournament $event, CarbonInterface $kickoff, array $pairs, int $slot, string $status): void
    {
        $ids = array_merge(...$pairs);
        OnlineClub::whereKey($ids)->orderBy('id')->lockForUpdate()->get();
        $schedule = [];
        foreach ($pairs as $offset => [$home, $away]) {
            $start = $kickoff->copy()->addHours($offset);
            $deadline = $start->copy()->subMinutes(15);
            if (ClubFixture::conflicts([$home, $away], $start) || $deadline->lte(now())) {
                $event->update(['status' => 'review']);
                return;
            }
            $schedule[] = ['home_club_id' => $home, 'away_club_id' => $away, 'bracket_slot' => $slot + $offset,
                'competition' => $event->title(), 'kickoff_at' => $start, 'orders_close_at' => $deadline];
        }
        $event->fixtures()->createMany($schedule);
        $event->update(['status' => $status]);
    }
}
