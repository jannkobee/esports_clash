<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(\App\Services\WorldPlayerProfiles::class);
        $this->app->scoped(\App\Services\WorldAgents::class);
        $this->app->scoped(\App\Services\WorldCareers::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->bound('auth')) {
            try {
                $guard = \Illuminate\Support\Facades\Auth::guard('web');
                if ($guard instanceof \Illuminate\Auth\SessionGuard) {
                    $guard->setRememberDuration(52560000);
                }
            } catch (\Throwable) {
            }
        }
    }
}
