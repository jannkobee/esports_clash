<?php

namespace App\Jobs;

use App\Models\{ClubFixture, OnlineCatalog, OnlineClub};
use App\Services\OnlineService;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LockClubFixture implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Queueable;

    public int $uniqueFor = 120;

    public function __construct(public int $fixtureId) {}

    public function uniqueId(): string { return (string) $this->fixtureId; }

    public function handle(OnlineService $online): void
    {
        DB::transaction(function () use ($online) {
            $catalog = OnlineCatalog::where('active', true)->lockForUpdate()->firstOrFail();
            $fixture = ClubFixture::whereKey($this->fixtureId)->lockForUpdate()->firstOrFail();
            if ($fixture->match_id || $fixture->hold_reason || $fixture->orders_close_at->isFuture()) return;

            app(\App\Services\WorldTalent::class)->assign($fixture);
            if ($fixture->home_national_team_id) {
                try {
                    $national=app(\App\Services\NationalTeamService::class);
                    $blue=$national->lineup($fixture->home_national_team_id,$fixture->tournament_id,$catalog);
                    $red=$national->lineup($fixture->away_national_team_id,$fixture->tournament_id,$catalog);
                    $national->reserve($fixture,[...$blue,...$red]);
                    $home=$fixture->homeNation; $away=$fixture->awayNation;
                    $match=$online->allocate($catalog,null,null,$blue,$red,['blue'=>$home->name,'red'=>$away->name],[
                        'id'=>$fixture->id,'competition'=>$fixture->competition,'kickoff_at'=>$fixture->kickoff_at->toISOString(),
                        'participant_type'=>'national','clubs'=>['blue'=>['id'=>$home->id,'name'=>$home->name],'red'=>['id'=>$away->id,'name'=>$away->name]],
                    ]);
                    $fixture->update(['match_id'=>$match->id]);
                    PollOnlineMatch::dispatch($match->id)->delay($fixture->kickoff_at)->afterCommit();
                } catch (ValidationException|\Symfony\Component\HttpKernel\Exception\HttpException $error) {
                    $fixture->update(['hold_reason'=>$error->getMessage()]);
                }
                return;
            }

            $clubs = OnlineClub::whereKey([$fixture->home_club_id, $fixture->away_club_id])
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $home = $clubs[$fixture->home_club_id];
            $away = $clubs[$fixture->away_club_id];
            try {
                $blue = $this->lineup($online, $catalog, $home, $fixture->home_orders);
                $red = $this->lineup($online, $catalog, $away, $fixture->away_orders);
                app(\App\Services\NationalTeamService::class)->reserve($fixture,[...$blue,...$red]);
            } catch (ValidationException|\Symfony\Component\HttpKernel\Exception\HttpException) {
                $fixture->update(['hold_reason' => 'A club could not field an eligible lineup. The fixture needs review.']);
                return;
            }

            $match = $online->allocate($catalog, $home->user_id, $away->user_id, $blue, $red,
                ['blue' => $home->name, 'red' => $away->name], [
                    'id' => $fixture->id, 'competition' => $fixture->competition,
                    'progression' => \App\Services\CommunityCups::isFun($fixture->tournament_id ? \App\Models\ClubTournament::find($fixture->tournament_id) : null)
                        ? \App\Services\CommunityCups::progression() : ['kind'=>'scheduled','training'=>true,'player_ratings'=>true],
                    'kickoff_at' => $fixture->kickoff_at->toISOString(),
                    'clubs' => ['blue' => $this->identity($home), 'red' => $this->identity($away)],
                ]);
            $fixture->update(['match_id' => $match->id]);
            PollOnlineMatch::dispatch($match->id)->delay($fixture->kickoff_at)->afterCommit();
        }, 3);
    }

    private function lineup(OnlineService $online, OnlineCatalog $catalog, OnlineClub $club, ?array $orders): array
    {
        if ($orders !== null) {
            try {
                return $online->validatedStarters($club->user_id, $orders, $catalog);
            } catch (ValidationException) {
                // A transfer or catalog change may invalidate previously saved orders.
            }
        }
        return $online->validatedStarters($club->user_id, $club->starters ?? $club->lineup, $catalog);
    }

    private function identity(OnlineClub $club): array
    {
        return ['id' => $club->id, 'name' => $club->name, 'tag' => $club->tag,
            'logo'=>$club->identity['assets']['logo']??null, 'crest' => $club->identity['crest'] ?? null, 'colors' => $club->identity['colors'] ?? null,
            'home_jersey' => $club->identity['home_jersey'] ?? null, 'away_jersey' => $club->identity['away_jersey'] ?? null];
    }
}
