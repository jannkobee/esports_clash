<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureEvolutionOwner
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless($request->user()?->is_evolution_admin, 403, 'Evolution controls require the designated owner account.');
        return $next($request)->header('Cache-Control', 'no-store, private');
    }
}
