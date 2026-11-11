<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OwnedPlayerCard;
use App\Services\FpsIdentityProfiles;
use App\Services\OnlineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FpsIdentityController extends Controller
{
    public function index(Request $request, FpsIdentityProfiles $profiles, OnlineService $online)
    {
        abort_unless(Schema::hasTable('fps_player_identities'),503,'Identity storage is not installed.');
        $ids=OwnedPlayerCard::where('user_id',$request->user()->id)->pluck('id');
        $club=$online->provision($request->user());
        $plan=DB::table('fps_team_systems')->where('club_id',$club->id)->value('gameplan');
        $plan=$plan ? json_decode($plan,true,512,JSON_THROW_ON_ERROR) : ['aggression'=>.5,'structure'=>.5,'preparation'=>.5,'freedom'=>.5];
        $coach=app(\App\Services\FpsIdentityEngine::class)->coach($club);
        $relationships=DB::table('fps_player_relationships')->whereIn('player_id',$ids)->whereIn('teammate_id',$ids)->get();
        $chemistry=$relationships->isEmpty()?'unestablished':($relationships->avg(fn($r)=>json_decode($r->relationship,true)['trust']??.5)>.7?'established':'developing');
        return ['data'=>DB::table('fps_player_identities')->whereIn('player_id',$ids)->get()->map(fn($row)=>[...$profiles->scouting($row,$plan,$coach['profile']),'team_chemistry'=>$chemistry])->values()];
    }

    public function prepare(Request $request, OnlineService $online, FpsIdentityProfiles $profiles)
    {
        abort_unless(Schema::hasTable('fps_player_identities'),503,'Identity storage is not installed.');
        $online->provision($request->user());
        $catalog=$online->activeCatalog();
        $templates=collect($catalog->payload['cards'])->keyBy('id');
        $players=OwnedPlayerCard::where('user_id',$request->user()->id)->where('catalog_id',$catalog->id)->get();
        DB::transaction(function () use ($players,$templates,$profiles) {
            foreach ($players as $player) {
                $definition=$templates->get($player->definition_id);
                if (is_array($definition)) $profiles->initialize($player,app(\App\Services\WorldPlayerProfiles::class)->definition($player,$definition));
            }
        });
        return $this->index($request,$profiles,$online);
    }
}
