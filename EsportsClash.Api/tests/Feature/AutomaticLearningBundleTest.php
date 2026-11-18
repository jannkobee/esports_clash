<?php

namespace Tests\Feature;

use App\Services\AutomaticLearningBundle;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class AutomaticLearningBundleTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->directory = sys_get_temp_dir().'/fps-approved-'.bin2hex(random_bytes(6));
        File::ensureDirectoryExists($this->directory);
        config(['automatic_learning.models_path' => $this->directory]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->directory);
        parent::tearDown();
    }

    private function seedUtility(): array
    {
        return json_decode(file_get_contents(base_path('../EsportsClash.Web/src/fps/fps-utility-brain.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    private function bundleBytes(?array $utility = null): string
    {
        $core = '{"version":2,"engine":"'.str_repeat('a', 64).'","navigation":{"version":1,"updates":0,"values":{}},"combat":{"version":1,"updates":0,"values":{}},"movement":{"version":1,"updates":0,"values":{}}';
        return $core.($utility === null ? '' : ',"utility":'.json_encode($utility)).'}'."\n";
    }

    private function approve(string $bytes, ?string $sha = null): string
    {
        $hash = hash('sha256', $bytes);
        file_put_contents($this->directory.'/'.$hash.'.json', $bytes);
        file_put_contents($this->directory.'/active.json', json_encode(['version' => 1, 'bundle' => $hash.'.json', 'sha256' => $sha ?? $hash]));
        return $hash;
    }

    public function test_no_approved_bundle_serves_null(): void
    {
        file_put_contents($this->directory.'/active.json', json_encode(['version' => 1, 'bundle' => null, 'sha256' => null]));
        $this->getJson('/api/v1/automatic-learning/approved')->assertOk()->assertExactJson(['version' => 1, 'bundle' => null]);
    }

    public function test_bundle_without_utility_brain_stays_valid_and_is_served_verbatim(): void
    {
        $bytes = $this->bundleBytes();
        $hash = $this->approve($bytes);
        $response = $this->getJson('/api/v1/automatic-learning/approved')->assertOk();
        $this->assertSame($hash, $response->json('sha256'));
        $this->assertArrayNotHasKey('utility', $response->json('bundle'));
        // Empty JSON objects must not be re-encoded as arrays.
        $this->assertStringContainsString('"values":{}', $response->getContent());
        $this->assertSame(json_decode($bytes, true), $response->json('bundle'));
    }

    public function test_bundle_with_committed_seed_utility_brain_is_served(): void
    {
        $seed = $this->seedUtility();
        $this->assertTrue(app(AutomaticLearningBundle::class)->validUtility($seed));
        $this->approve($this->bundleBytes($seed));
        $response = $this->getJson('/api/v1/automatic-learning/approved')->assertOk();
        $this->assertSame($seed['throws'], $response->json('bundle.utility.throws'));
        $this->assertSame(count($seed['entries']), count($response->json('bundle.utility.entries')));
    }

    public function test_empty_utility_brain_keeps_object_maps(): void
    {
        $this->approve('{"version":2,"engine":"'.str_repeat('b', 64).'","navigation":{},"combat":{},"movement":{},"utility":{"version":1,"revision":0,"throws":0,"successes":0,"entries":{},"spots":{}}}');
        $response = $this->getJson('/api/v1/automatic-learning/approved')->assertOk();
        $this->assertStringContainsString('"entries":{},"spots":{}', $response->getContent());
    }

    public function test_invalid_or_oversized_utility_brains_and_bad_checksums_are_refused(): void
    {
        $seed = $this->seedUtility();
        $wild = $seed;
        $first = array_key_first($wild['entries']);
        $wild['entries'][$first]['aimDx'] = 50;
        $this->approve($this->bundleBytes($wild));
        $this->getJson('/api/v1/automatic-learning/approved')->assertStatus(503);

        $oversized = $seed;
        for ($i = 0; $i < 801; $i++) $oversized['entries']['fontessa:smoke:'.$i.',0,>0,0,'] = $seed['entries'][$first];
        $this->assertFalse(app(AutomaticLearningBundle::class)->validUtility($oversized));
        $this->approve($this->bundleBytes($oversized));
        $this->getJson('/api/v1/automatic-learning/approved')->assertStatus(503);

        $impossible = $seed;
        $impossible['successes'] = $impossible['throws'] + 1;
        $this->assertFalse(app(AutomaticLearningBundle::class)->validUtility($impossible));
        $this->assertFalse(app(AutomaticLearningBundle::class)->validUtility(['version' => 2] + $seed));

        $this->approve($this->bundleBytes($seed), str_repeat('0', 64));
        $this->getJson('/api/v1/automatic-learning/approved')->assertStatus(503);
    }

    public function test_core_models_remain_required(): void
    {
        $validator = app(AutomaticLearningBundle::class);
        $bundle = json_decode($this->bundleBytes(), true);
        $this->assertTrue($validator->valid($bundle));
        unset($bundle['movement']);
        $this->assertFalse($validator->valid($bundle));
        $this->assertFalse($validator->valid(['version' => 1] + json_decode($this->bundleBytes(), true)));
    }
}
