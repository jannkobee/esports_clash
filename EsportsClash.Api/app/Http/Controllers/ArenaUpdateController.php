<?php
namespace App\Http\Controllers;
use App\Services\ArenaUpdates;
use Illuminate\Http\Request;

class ArenaUpdateController extends Controller
{
    public function store(Request $r, ArenaUpdates $updates) {
        abort_unless($r->user()->is_evolution_admin,403);
        $v=$r->validate(['version'=>'required|string|max:60|unique:arena_update_bulletins,version','title'=>'required|string|max:180',
            'category'=>'required|in:balance,content,maintenance','status'=>'required|in:announced,released','body'=>'required|string|min:30|max:8000',
            'implementation_ref'=>'nullable|required_if:status,released|string|max:200','release_confirmed'=>'accepted_if:status,released']);
        unset($v['release_confirmed']);$updates->publish($r->user(),$v);
        return $r->expectsJson()?response()->json(['message'=>'Arena announcement published.'],201):redirect()->route('world.dashboard')->with('status','Arena announcement published to The Wire.');
    }
}
