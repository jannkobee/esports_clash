<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\{ClubFixture, OnlineClub};
use App\Services\OnlineService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ClubIdentityController extends Controller
{
    public function update(Request $request, OnlineService $service)
    {
        $club = $service->provision($request->user());
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'min:1', 'max:80'],
            'tag' => ['required', 'string', 'regex:/^[A-Z0-9]{2,12}$/', Rule::unique('online_clubs', 'tag')->ignore($club->id)],
            'identity' => ['required', 'array:nickname,motto,bio,country,city,crest,colors,home_jersey,away_jersey'],
            'identity.nickname' => ['nullable', 'string', 'max:80'],
            'identity.motto' => ['nullable', 'string', 'max:120'],
            'identity.bio' => ['nullable', 'string', 'max:1000'],
            'identity.country' => ['required', 'string', 'size:2', 'regex:/^[A-Z]{2}$/'],
            'identity.city' => ['nullable', 'string', 'max:80'],
            'identity.crest' => ['required', 'array:shape,mark'],
            'identity.crest.shape' => ['required', Rule::in(['shield', 'circle', 'diamond'])],
            'identity.crest.mark' => ['required', Rule::in(['star', 'bolt', 'tower'])],
            'identity.colors' => ['required', 'array:primary,secondary,accent'],
            'identity.colors.*' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'identity.colors.primary' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'identity.colors.secondary' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'identity.colors.accent' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'identity.home_jersey' => ['required', 'array:pattern,crest_position,lettering,number_style'],
            'identity.home_jersey.pattern' => ['required', Rule::in(['solid', 'stripes', 'diagonal'])],
            'identity.away_jersey' => ['required', 'array:pattern,crest_position,lettering,number_style'],
            'identity.away_jersey.pattern' => ['required', Rule::in(['solid', 'stripes', 'diagonal'])],
            'identity.*_jersey.crest_position' => ['sometimes', Rule::in(['left', 'center', 'right'])],
            'identity.*_jersey.lettering' => ['sometimes', Rule::in(['block', 'italic', 'mono'])],
            'identity.*_jersey.number_style' => ['sometimes', Rule::in(['solid', 'outline'])],
        ]);

        try {
            $club = DB::transaction(function () use ($club, $data) {
                $locked = OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();
                if (ClubFixture::awaitingSnapshot($locked->id)) {
                    throw ValidationException::withMessages(['name' => 'A fixture is locking its club identity. Try again shortly.']);
                }
                if ($locked->revision !== $data['revision']) {
                    throw ValidationException::withMessages(['revision' => 'The club changed. Refresh before saving.']);
                }
                if(!app(\App\Services\SupporterMembership::class)->status($locked->user)['active']){
                    foreach(['home_jersey','away_jersey'] as $kit)abort_if($data['identity'][$kit]!==($locked->identity[$kit]??['pattern'=>'solid']),403,'Custom jerseys require Supporter. Existing saved artwork is retained.');
                }
                $data['identity']['assets']=$locked->identity['assets']??[];
                $geography=\App\Models\CompetitionGeography::where('code',$data['identity']['country'])->where('kind','country')->value('id');
                $locked->update(['name' => $data['name'], 'tag' => $data['tag'], 'identity' => $data['identity'], 'geography_id'=>$geography, 'revision' => $locked->revision + 1]);
                return $locked;
            });
        } catch (UniqueConstraintViolationException $exception) {
            if (! OnlineClub::where('tag', $data['tag'])->whereKeyNot($club->id)->exists()) throw $exception;
            throw ValidationException::withMessages(['tag' => 'This club tag is already in use.']);
        }

        return response()->json(['data' => $club]);
    }
}
