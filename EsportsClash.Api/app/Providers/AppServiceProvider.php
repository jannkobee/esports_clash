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
        //
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
