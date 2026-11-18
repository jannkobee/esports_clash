<?php

namespace Tests\Feature;

use App\Services\FpsLineageStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FpsLineageStoreTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-writer-token-0123456789abcdef0123';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['automatic_learning.writer_token' => self::TOKEN]);
    }

    private function bundle(int $updates = 0): string
    {
        return '{"version":2,"engine":"'.str_repeat('b', 64).'","navigation":{"version":1,"updates":'.$updates.',"values":{}},"combat":{"version":1,"updates":0,"values":{}},"movement":{"version":1,"updates":0,"values":{}}}';
    }

    private function writer(string $uri, array $body, ?string $token = self::TOKEN)
    {
        return $this->withHeaders($token === null ? [] : ['Authorization' => 'Bearer '.$token])->postJson($uri, $body);
    }

    public function test_versions_and_events_are_append_only_at_the_database_level(): void
    {
        $store = app(FpsLineageStore::class);
        $lineage = $store->lineage('worker:alpha');
        $version = $store->append($lineage, 'bundle', $this->bundle(), 'worker');
        $store->event($lineage, 'bundle', 'promote', (int) $version->id, 'first', 'test');
        foreach (['fps_model_versions', 'fps_lineage_events', 'fps_team_lineages'] as $table) {
            $this->assertThrows(fn () => DB::table($table)->update(['created_at' => now()]), \Throwable::class);
            $this->assertThrows(fn () => DB::table($table)->delete(), \Throwable::class);
        }
        $this->assertSame(1, DB::table('fps_model_versions')->count());
    }

    public function test_promotion_rollback_and_pause_fold_from_history_without_losing_versions(): void
    {
        $store = app(FpsLineageStore::class);
        $lineage = $store->lineage('club:7', null);
        $first = $store->append($lineage, 'bundle', $this->bundle(1), 'worker');
        $second = $store->append($lineage, 'bundle', $this->bundle(2), 'worker', (int) $first->id);
        $this->assertSame(2, (int) $second->version);
        $this->assertSame((int) $first->id, (int) $store->append($lineage, 'bundle', $this->bundle(1), 'worker')->id, 'identical bytes reuse the version');
        $store->event($lineage, 'bundle', 'promote', (int) $first->id, 'a', 't');
        $store->event($lineage, 'bundle', 'promote', (int) $second->id, 'b', 't');
        $this->assertSame(2, (int) $store->state($lineage, 'bundle')['current']->version);
        $store->event($lineage, 'bundle', 'rollback', (int) $first->id, 'regressed', 't');
        $state = $store->state($lineage, 'bundle');
        $this->assertSame(1, (int) $state['current']->version);
        $this->assertSame(2, $state['versions'], 'rollback keeps every version');
        $store->event($lineage, 'bundle', 'pause', null, 'owner pause', 'owner');
        $this->assertTrue($store->state($lineage, 'bundle')['paused']);
        $third = $store->append($lineage, 'bundle', $this->bundle(3), 'worker');
        $this->expectException(\RuntimeException::class);
        $store->event($lineage, 'bundle', 'rollback', (int) $third->id, 'never promoted', 't');
    }

    public function test_large_payloads_are_file_backed_and_verified(): void
    {
        $store = app(FpsLineageStore::class);
        $lineage = $store->lineage('worker:big');
        $bytes = '{"version":2,"engine":"'.str_repeat('c', 64).'","navigation":{"pad":"'.str_repeat('x', FpsLineageStore::INLINE_MAX_BYTES).'"},"combat":{},"movement":{}}';
        $version = $store->append($lineage, 'bundle', $bytes, 'worker');
        $this->assertNull($version->payload);
        $this->assertSame($bytes, $store->payload($version));
        Storage::disk('local')->put($version->payload_path, str_replace('xx', 'yy', $bytes));
        $this->expectException(\RuntimeException::class);
        $store->payload($version);
    }

    public function test_worker_writes_need_the_token_and_reads_serve_current_bytes_verbatim(): void
    {
        $uri = '/api/v1/fps/lineages/worker:blue';
        $this->writer($uri.'/versions', ['kind' => 'bundle', 'payload' => $this->bundle(), 'origin' => 'worker'], null)->assertUnauthorized();
        $this->writer($uri.'/versions', ['kind' => 'bundle', 'payload' => $this->bundle(), 'origin' => 'worker'], str_repeat('z', 40))->assertUnauthorized();
        $this->writer($uri.'/versions', ['kind' => 'bundle', 'payload' => '{"version":1}', 'origin' => 'worker'])->assertStatus(422);
        $this->writer($uri.'/versions', ['kind' => 'bundle', 'payload' => $this->bundle(4), 'origin' => 'worker', 'promote' => true])->assertCreated()->assertJsonPath('version', 1);
        $body = $this->get($uri.'/current')->assertOk()->getContent();
        $this->assertStringContainsString('"payload":'.$this->bundle(4), $body, 'empty objects stay objects');
        $this->getJson($uri.'/history')->assertOk()->assertJsonPath('kinds.bundle.current', 1)->assertJsonPath('kinds.bundle.versions', 1);
        $this->getJson('/api/v1/fps/lineages/worker:none/current')->assertOk()->assertJsonPath('kinds', []);
        $this->getJson('/api/v1/fps/lineages/bad key/current')->assertNotFound();
        $this->writer($uri.'/events', ['kind' => 'bundle', 'action' => 'rollback', 'version' => 9, 'reason' => 'x'])->assertStatus(422);
    }

    public function test_registry_controls_the_approved_bundle_and_keeps_rollback_history(): void
    {
        $directory = sys_get_temp_dir().'/fps-registry-'.bin2hex(random_bytes(5));
        File::ensureDirectoryExists($directory);
        config(['automatic_learning.models_path' => $directory]);
        try {
            file_put_contents($directory.'/active.json', json_encode(['version' => 1, 'bundle' => null, 'sha256' => null]));
            $hashes = [];
            foreach ([1, 2] as $n) {
                $bytes = $this->bundle($n)."\n";
                $hash = hash('sha256', $bytes);
                file_put_contents($directory.'/'.$hash.'.json', $bytes);
                $hashes[$n] = $hash;
            }
            $events = [
                ['action' => 'promote', 'bundle' => $hashes[1].'.json', 'sha256' => $hashes[1]],
                ['action' => 'promote', 'bundle' => $hashes[2].'.json', 'sha256' => $hashes[2]],
            ];
            file_put_contents($directory.'/registry.json', json_encode(['version' => 1, 'events' => $events]));
            $this->getJson('/api/v1/automatic-learning/approved')->assertOk()->assertJsonPath('sha256', $hashes[2]);
            $events[] = ['action' => 'rollback', 'bundle' => $hashes[1].'.json', 'sha256' => $hashes[1]];
            file_put_contents($directory.'/registry.json', json_encode(['version' => 1, 'events' => $events]));
            $this->getJson('/api/v1/automatic-learning/approved')->assertOk()->assertJsonPath('sha256', $hashes[1]);
            $events[] = ['action' => 'rollback', 'bundle' => str_repeat('d', 64).'.json', 'sha256' => str_repeat('d', 64)];
            file_put_contents($directory.'/registry.json', json_encode(['version' => 1, 'events' => $events]));
            $this->getJson('/api/v1/automatic-learning/approved')->assertStatus(503);
        } finally {
            File::deleteDirectory($directory);
        }
    }
}
