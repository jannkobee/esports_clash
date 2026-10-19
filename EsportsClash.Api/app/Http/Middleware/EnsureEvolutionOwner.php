<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureEvolutionOwner
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->user()?->is_evolution_admin, 403, 'Evolution controls require the designated owner account.');
        $response=$next($request);
        $response->headers->set('Cache-Control', 'no-store, private');
        return $response;
    }
}
