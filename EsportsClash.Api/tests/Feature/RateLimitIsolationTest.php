<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RateLimitIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_polling_does_not_exhaust_login_throttle_and_trusted_proxy_isolates_clients(): void
    {
        $owner = User::factory()->create(['password' => 'valid-test-password']);
        $proxyHeaders = [
            'REMOTE_ADDR' => '172.25.0.16',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.10',
            'HTTP_X_FORWARDED_PROTO' => 'http',
        ];

        for ($i = 0; $i < 8; $i++) {
            $this->withServerVariables($proxyHeaders)->getJson('/api/v1/game-modes')->assertOk();
            $this->withServerVariables($proxyHeaders)->getJson('/api/v1/world/revision')->assertOk();
        }

        // A user opening the app should still be able to log in immediately without 429.
        $this->withServerVariables($proxyHeaders)
            ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'valid-test-password'])
            ->assertOk()
            ->assertJsonStructure(['token']);

        // Repeated wrong logins from one forwarded client IP hit 429 on the 6th attempt.
        for ($i = 0; $i < 4; $i++) {
            $this->withServerVariables($proxyHeaders)
                ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'wrong'])
                ->assertStatus(422);
        }

        $this->withServerVariables($proxyHeaders)
            ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'wrong'])
            ->assertStatus(429);

        // A second client behind the same reverse proxy keeps an independent budget.
        $this->withServerVariables([
            'REMOTE_ADDR' => '172.25.0.16',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.20',
            'HTTP_X_FORWARDED_PROTO' => 'http',
        ])
            ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'valid-test-password'])
            ->assertOk();
    }

    public function test_untrusted_proxy_cannot_spoof_forwarded_ip_to_bypass_throttle(): void
    {
        $owner = User::factory()->create(['password' => 'valid-test-password']);

        for ($i = 0; $i < 5; $i++) {
            $this->withServerVariables([
                'REMOTE_ADDR' => '198.51.100.5',
                'HTTP_X_FORWARDED_FOR' => "192.0.2.{$i}",
            ])
                ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'wrong'])
                ->assertStatus(422);
        }

        $this->withServerVariables([
            'REMOTE_ADDR' => '198.51.100.5',
            'HTTP_X_FORWARDED_FOR' => '192.0.2.99',
        ])
            ->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'valid-test-password'])
            ->assertStatus(429);
    }
}
