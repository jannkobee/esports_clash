<?php
namespace App\Http\Controllers;

use App\Services\WorldSimulation;
use Illuminate\Http\Request;

class WorldSimulationController extends Controller
{
    public function show(WorldSimulation $world) { return ['data' => $world->snapshot()]; }
    public function operations(Request $request, WorldSimulation $world) {
        abort_unless($request->user()->is_evolution_admin, 403);
        return ['data' => $world->operations()];
    }
    public function dashboard(WorldSimulation $world) {
        return view('evolution.world', ['world' => $world->snapshot(), 'operations' => $world->operations()]);
    }
}
