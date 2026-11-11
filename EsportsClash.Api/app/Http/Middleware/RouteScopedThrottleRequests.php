<?php

namespace App\Http\Middleware;

use Illuminate\Routing\Middleware\ThrottleRequests;

/**
 * Scope route throttles to the matched route method and URI so polling
 * endpoints never exhaust auth or mutation rate-limit budgets.
 */
class RouteScopedThrottleRequests extends ThrottleRequests
{
    protected function resolveRequestSignature($request)
    {
        $signature = parent::resolveRequestSignature($request);
        $route = $request->route();

        if (! $route) {
            return $signature;
        }

        $scoped = implode(',', $route->methods()).'|'.$route->uri().'|'.$signature;

        return static::$shouldHashKeys ? sha1($scoped) : $scoped;
    }
}
