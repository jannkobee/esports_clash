<?php

namespace App\Http\Controllers;

use App\Services\GameModes;
use Illuminate\Http\Request;

class GameModeController extends Controller
{
    public function manifest(GameModes $modes) { return response()->json(['data' => $modes->state()])->header('Cache-Control', 'no-store'); }
    public function index(GameModes $modes) { return view('evolution.game-modes', ['modes' => $modes->state()]); }
    public function update(Request $request, GameModes $modes)
    {
        $data = $request->validate(['moba_enabled' => 'required|boolean']);
        $modes->configure((bool) $data['moba_enabled']);
        return back()->with('status', 'Game-mode availability saved. Existing matches and historical recordings are preserved.');
    }
}
