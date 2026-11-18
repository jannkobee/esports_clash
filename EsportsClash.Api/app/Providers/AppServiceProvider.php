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
        $this->app->scoped(\App\Services\FpsIdentityEngine::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Account emails link to the game's own pages (the API has no web pages of its own).
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(fn ($user, string $token) =>
            app(\App\Services\ManagerMail::class)->frontendUrl('reset-password?token='.urlencode($token).'&email='.urlencode($user->getEmailForPasswordReset())));
        \Illuminate\Auth\Notifications\VerifyEmail::createUrlUsing(fn ($user) => \Illuminate\Support\Facades\URL::temporarySignedRoute('api.verification.verify',
            now()->addDays(3), ['id' => $user->getKey(), 'hash' => sha1($user->getEmailForVerification())]));
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
