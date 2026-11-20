<?php

namespace App\Services;

use App\Models\OnlineMatch;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use JsonException;
use RuntimeException;

final class FpsOfficialLearning
{
    public const LINEAGE_PREFIX = 'worker:official-club-';

    public function __construct(private FpsLineageStore $store, private AutomaticLearningBundle $bundles) {}

    /** Pin model bytes at allocation so a promotion or rollback cannot change an allocated fixture. */
    public function pin(string $map, array $clubs): array
    {
        $learning = [];
        try {
            if ($approved = $this->bundles->approved()) {
                $bundle = json_decode($approved['bytes'], false, 512, JSON_THROW_ON_ERROR);
                if (isset($bundle->playbooks)) {
                    $book = $bundle->playbooks->{$map} ?? null;
                    $bundle->playbooks = $book ? (object) [$map => $book] : (object) [];
                }
                // Keep allocations within the online worker's 2 MiB request budget. Very large
                // utility checkpoints use the engine's shipped seed brain in official matches.
                if (isset($bundle->utility) && strlen(json_encode($bundle->utility, JSON_THROW_ON_ERROR)) > 512 * 1024) {
                    unset($bundle->utility);
                }
                $learning['approved_bundle_json'] = json_encode($bundle, JSON_THROW_ON_ERROR);
                $learning['approved_sha256'] = $approved['sha256'];
            }
        } catch (HttpException|JsonException $error) {
            report($error);
        }

        foreach ($clubs as $side => $clubId) {
            $opponent = $clubs[$side === 'blue' ? 'red' : 'blue'] ?? null;
            $key = self::LINEAGE_PREFIX.$clubId;
            $input = ['lineage' => $key, 'opponentId' => $opponent ? 'club:'.$opponent : null];
            if ($lineage = $this->store->find($key)) {
                $state = $this->store->state($lineage, 'bundle');
                if ($state['current']) {
                    try {
                        $model = json_decode($this->store->payload($state['current']), false, 512, JSON_THROW_ON_ERROR);
                        $input['version'] = (int) $state['current']->version;
                        $input['sha256'] = $state['current']->sha256;
                        if (isset($model->playbooks->{$map})) {
                            $input['playbook_json'] = json_encode($model->playbooks->{$map}, JSON_THROW_ON_ERROR);
                        }
                        if (isset($model->opponents)) {
                            $opponents = clone $model->opponents;
                            $seen = $opponents->opponents->{$input['opponentId']} ?? null;
                            $opponents->opponents = $seen ? (object) [$input['opponentId'] => $seen] : (object) [];
                            $input['opponents_json'] = json_encode($opponents, JSON_THROW_ON_ERROR);
                        }
                    } catch (JsonException|RuntimeException $error) {
                        report($error);
                    }
                }
            }
            $learning['team_playbooks'][$side] = $input;
        }
        return $learning;
    }

    /** Called inside the settlement transaction, after the worker result has passed match validation. */
    public function record(OnlineMatch $match, array $report): void
    {
        foreach ($match->plan['fps_learning']['team_playbooks'] ?? [] as $side => $input) {
            $experience = $report['playbookExperience'][$side] ?? null;
            if ($experience === null) continue;
            $rounds = $experience['rounds'] ?? null;
            $observed = $experience['observed'] ?? null;
            if (! is_array($rounds) || ! array_is_list($rounds) || count($rounds) !== $report['totalRounds']
                || ! is_array($observed) || ! array_is_list($observed) || count($observed) !== ($input['opponentId'] ? count($rounds) : 0)) {
                throw ValidationException::withMessages(['result' => 'Invalid official playbook experience.']);
            }
            $rows = [];
            foreach ($rounds as $index => $played) {
                $round = $index + 1;
                $attackTeam = $round <= 30 ? ($round <= 15 ? 'red' : 'blue') : (intdiv($round - 31, 3) % 2 === 0 ? 'red' : 'blue');
                $role = $attackTeam === $side ? 'attack' : 'defense';
                $won = $report['roundResults'][$index]['winnerTeam'] === $side;
                $id = $played['playId'] ?? null;
                if (($played['side'] ?? null) !== $role || ($played['won'] ?? null) !== $won || ! is_string($id)
                    || ! preg_match('/^(seed|v):[a-z0-9_]{1,40}$/D', $id)) {
                    throw ValidationException::withMessages(['result' => 'Official playbook experience disagrees with the round result.']);
                }
                $row = ['round' => $round, 'side' => $role, 'play_id' => $id, 'won' => $won];
                if (str_starts_with($id, 'v:') && is_array($played['variant'] ?? null)) $row['variant'] = $played['variant'];
                if ($opponent = $input['opponentId']) {
                    $seen = $observed[$index]['seen'] ?? [];
                    $row['opponent'] = $opponent;
                    $row['observed'] = [
                        'opponentAttacked' => $attackTeam !== $side,
                        'earlyRush' => ($seen['earlyRush'] ?? null) === true,
                        'slowDefault' => ($seen['slowDefault'] ?? null) === true,
                        'heavyUtility' => ($seen['heavyUtility'] ?? null) === true,
                        'saved' => ($seen['saved'] ?? null) === true,
                        'passiveAnchors' => ($seen['passiveAnchors'] ?? null) === true,
                    ];
                    if ($attackTeam !== $side && in_array($report['roundResults'][$index]['plantedSite'] ?? null, ['A', 'B'], true)) {
                        $row['observed']['plantSite'] = $report['roundResults'][$index]['plantedSite'];
                    }
                    if (in_array($seen['firstBlood'] ?? null, ['A', 'B', 'Mid'], true)) $row['observed']['firstBlood'] = $seen['firstBlood'];
                }
                $rows[] = $row;
            }
            $payload = json_encode(['map' => $report['mapId'], 'rounds' => $rows], JSON_THROW_ON_ERROR);
            $lineage = $this->store->lineage($input['lineage'], (int) substr($input['lineage'], strlen(self::LINEAGE_PREFIX)));
            DB::table('fps_lineage_experience')->insertOrIgnore([
                'lineage_id' => $lineage->id, 'match_ref' => $match->id, 'user_id' => null,
                'sha256' => hash('sha256', $payload), 'payload' => $payload, 'created_at' => now(),
            ]);
        }
    }
}
