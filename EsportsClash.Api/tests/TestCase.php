<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    private ?string $equipmentTestRoot=null;
    public function createApplication()
    {
        // Docker populates $_SERVER as well as getenv(). Override every adapter
        // before application bootstrap and before RefreshDatabase can run.
        foreach (['APP_ENV' => 'testing', 'APP_KEY' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:',
            'DB_URL' => '', 'CACHE_STORE' => 'array', 'QUEUE_CONNECTION' => 'sync', 'SESSION_DRIVER' => 'array'] as $key => $value) {
            putenv($key.'='.$value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
        $app = parent::createApplication();
        // Tests must never read or replace an owner's installed equipment.
        $this->equipmentTestRoot??=sys_get_temp_dir().'/teamfight-test-equipment-'.bin2hex(random_bytes(8));
        $app['config']->set('avatars.weapon_path',$this->equipmentTestRoot);
        if ($app['config']->get('database.default') !== 'sqlite'
            || $app['config']->get('database.connections.sqlite.database') !== ':memory:') {
            throw new \LogicException('Refusing to run tests against a persistent database.');
        }
        return $app;
    }
    protected function tearDown():void
    {
        if($this->equipmentTestRoot&&dirname($this->equipmentTestRoot)===sys_get_temp_dir()&&str_starts_with(basename($this->equipmentTestRoot),'teamfight-test-equipment-'))
            \Illuminate\Support\Facades\File::deleteDirectory($this->equipmentTestRoot);
        parent::tearDown();
    }
}
