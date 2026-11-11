<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\OnlineService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class FpsTacticalSystemController extends Controller
{
    private const DEFAULT_PLAN = ['tempo'=>.5,'structure'=>.5,'aggression'=>.5,'preparation'=>.5,'freedom'=>.5,'economy'=>.5];

    public function show(Request $request, OnlineService $online)
    {
        abort_unless(Schema::hasTable('fps_team_systems'), 503, 'Tactical system storage is not installed.');
        $club=$online->provision($request->user());
        $row=DB::table('fps_team_systems')->where('club_id',$club->id)->first();
        $coach=app(\App\Services\FpsIdentityEngine::class)->coach($club);
        return ['data'=>['revision'=>(int)($row?->revision ?? 0), 'gameplan'=>$row ? json_decode($row->gameplan,true) : self::DEFAULT_PLAN,
            'instructions'=>$row?->instructions ? json_decode($row->instructions,true) : (object)[], 'coach'=>$coach,
            'culture'=>$row ? json_decode($row->culture,true) : self::DEFAULT_PLAN,'active'=>app(\App\Services\FpsIdentityEngine::class)->enabled()]];
    }

    public function update(Request $request, OnlineService $online)
    {
        abort_unless(Schema::hasTable('fps_team_systems'), 503, 'Tactical system storage is not installed.');
        $rules=['revision'=>['required','integer','min:0'],'gameplan'=>['required','array:tempo,structure,aggression,preparation,freedom,economy']];
        foreach (array_keys(self::DEFAULT_PLAN) as $key) $rules['gameplan.'.$key]=['required','numeric','between:0,1'];
        $rules['instructions']=['sometimes','array','max:30'];
        $rules['instructions.*']=['array:role,instruction,training'];
        $rules['instructions.*.role']=['nullable','in:entry,caller,sniper,support,lurker,anchor,trade'];
        $rules['instructions.*.instruction']=['required','in:balanced,hold,initiative,support'];
        $rules['instructions.*.training']=['sometimes','in:system,specialty,entry,caller,sniper,support,lurker,anchor,trade'];
        $data=$request->validate($rules);
        $club=$online->provision($request->user());
        $owned=\App\Models\OwnedPlayerCard::where('user_id',$request->user()->id)->pluck('id')->all();
        foreach (array_keys($data['instructions']??[]) as $id) abort_unless(in_array($id,$owned,true),422,'Instructions require a current owned player.');
        return DB::transaction(function () use ($club,$data) {
            // Lock the existing club row even before the first system row exists.
            DB::table('online_clubs')->where('id',$club->id)->lockForUpdate()->first();
            $row=DB::table('fps_team_systems')->where('club_id',$club->id)->first();
            abort_if((int)($row?->revision ?? 0)!==(int)$data['revision'],409,'Tactical system changed in another session. Reload before saving.');
            $plan=[];
            foreach (array_keys(self::DEFAULT_PLAN) as $key) $plan[$key]=(float)$data['gameplan'][$key];
            $revision=(int)($row?->revision ?? 0)+1;
            $instructions=$data['instructions']??($row?->instructions ? json_decode($row->instructions,true) : []);
            DB::table('fps_team_systems')->updateOrInsert(['club_id'=>$club->id],['revision'=>$revision,'gameplan'=>json_encode($plan,JSON_THROW_ON_ERROR),'instructions'=>json_encode($instructions,JSON_THROW_ON_ERROR),'culture'=>$row?->culture ?? json_encode(self::DEFAULT_PLAN,JSON_THROW_ON_ERROR),'created_at'=>$row?->created_at ?? now(),'updated_at'=>now()]);
            return ['data'=>['revision'=>$revision,'gameplan'=>$plan,'instructions'=>(object)$instructions,'coach'=>app(\App\Services\FpsIdentityEngine::class)->coach($club),'culture'=>json_decode($row?->culture??json_encode(self::DEFAULT_PLAN),true),'active'=>app(\App\Services\FpsIdentityEngine::class)->enabled()]];
        });
    }
}
