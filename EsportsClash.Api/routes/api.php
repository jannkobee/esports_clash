<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClubProfileController;
use App\Http\Controllers\Api\V1\MatchReportController;
use App\Http\Controllers\Api\V1\EvolutionController;
use App\Http\Controllers\Api\V1\OnlineController;

Route::post('/internal/online/authorize-stream', [OnlineController::class, 'authorizeStream'])->middleware('throttle:120,1');

Route::prefix('v1')->group(function (): void {
    Route::get('/automatic-learning/approved', [\App\Http\Controllers\AutomaticLearningController::class, 'show'])->middleware('throttle:60,1');
    Route::prefix('fps/lineages/{key}')->where(['key' => '(club:[0-9]{1,18}|worker:[a-z0-9-]{1,60}|exhibition:[a-z0-9-]{1,60})'])->controller(\App\Http\Controllers\FpsLineageController::class)->group(function (): void {
        Route::get('/current', 'current')->middleware('throttle:120,1');
        Route::get('/history', 'history')->middleware('throttle:60,1');
        Route::post('/versions', 'append')->middleware('throttle:120,1');
        Route::post('/events', 'event')->middleware('throttle:60,1');
        Route::post('/experience', 'submit')->middleware(['auth:sanctum', 'throttle:10,1']);
    });
    Route::get('/fps/lineage-experience', [\App\Http\Controllers\FpsLineageController::class, 'pending'])->middleware('throttle:60,1');
    Route::get('/game-modes', [\App\Http\Controllers\GameModeController::class, 'manifest'])->middleware('throttle:90,1');
    Route::get('/world/simulation', [\App\Http\Controllers\WorldSimulationController::class, 'show'])->middleware('throttle:60,1');
    Route::get('/world/operations', [\App\Http\Controllers\WorldSimulationController::class, 'operations'])->middleware(['auth:sanctum','throttle:30,1']);
    Route::get('/world/accounts',[\App\Http\Controllers\Api\V1\WireAccountController::class,'index'])->middleware('throttle:60,1');
    Route::get('/world/accounts/{id}',[\App\Http\Controllers\Api\V1\WireAccountController::class,'show'])->whereNumber('id')->middleware('throttle:60,1');
    Route::get('/world/owned-accounts',[\App\Http\Controllers\Api\V1\WireAccountController::class,'owned'])->middleware('auth:sanctum');
    Route::post('/world/arena-updates',[\App\Http\Controllers\ArenaUpdateController::class,'store'])->middleware(['auth:sanctum','throttle:6,1']);
    Route::get('/world/revision',\App\Http\Controllers\Api\V1\WorldRevisionController::class)->middleware('throttle:90,1');
    Route::get('/club-media/{id}',[\App\Http\Controllers\Api\V1\ClubMediaController::class,'show'])->whereUuid('id');
    Route::prefix('world')->controller(\App\Http\Controllers\Api\V1\WorldMediaController::class)->middleware('throttle:90,1')->group(function(){
        Route::get('/news','feed');Route::get('/news/{id}/comments','comments')->whereNumber('id');
        Route::get('/broadcasts','broadcasts');Route::get('/launch','launch');Route::get('/launch/{id}','launchReport')->whereNumber('id');
        Route::get('/reports/{id}','report')->whereNumber('id');
        Route::middleware('auth:sanctum')->group(function(){
            Route::post('/news/{id}/report','flag')->whereNumber('id')->middleware('throttle:10,1');
            Route::get('/moderation','moderation');Route::post('/moderation/{id}','review')->whereNumber('id')->middleware('throttle:30,1');
            Route::post('/news','publish')->middleware('throttle:5,1');Route::delete('/news/{id}','hidePost')->whereNumber('id');
            Route::post('/news/{id}/comments','comment')->whereNumber('id')->middleware('throttle:15,1');
            Route::delete('/comments/{id}','hideComment')->whereNumber('id');Route::post('/broadcasts/{id}/presence','presence')->whereUuid('id');
        });
    });
    Route::prefix('competitions')->controller(\App\Http\Controllers\Api\V1\CompetitionController::class)->middleware('throttle:90,1')->group(function () {
        Route::get('/', 'index'); Route::get('/rankings','rankings'); Route::get('/geography','geography');
        Route::get('/directory', [\App\Http\Controllers\Api\V1\CompetitionController::class, 'directory']);
        Route::get('/editions/{id}','show')->whereNumber('id'); Route::get('/nations/{id}','nation')->whereNumber('id');
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/mine','mine'); Route::get('/organizer-editions','organizerEditions'); Route::post('/editions/{id}/enter','enter')->whereNumber('id');
            Route::post('/invitations/{id}','invitation')->whereNumber('id');
            Route::post('/nations/{id}/applications','applyManager')->whereNumber('id');
            Route::put('/nations/{id}/squad','squad')->whereNumber('id'); Route::post('/nations/{id}/resign','resign')->whereNumber('id');
            Route::post('/organizers','organizer'); Route::post('/definitions','definition'); Route::post('/definitions/{id}/editions','edition')->whereNumber('id');
            Route::put('/definitions/{id}','reviseDefinition')->whereNumber('id');
            Route::get('/admin','adminIndex'); Route::put('/admin/settings','configure'); Route::post('/admin/moderation','moderation');
            Route::post('/admin/geography','createGeography'); Route::post('/admin/nationalities','verifyNationality'); Route::post('/admin/initialize','initialize');
            Route::post('/admin/populate','populate'); Route::post('/editions/{id}/qualifiers','qualifiers')->whereNumber('id'); Route::post('/editions/{id}/funding','funding')->whereNumber('id');
            Route::post('/editions/{id}/wildcards','wildcard')->whereNumber('id'); Route::get('/editions/{id}/invitation-slots','invitationSlots')->whereNumber('id'); Route::post('/editions/{id}/withdraw','withdraw')->whereNumber('id');
        });
    });
    Route::get('/avatarpedia', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'index'])->middleware('throttle:60,1');
    Route::get('/avatarpedia/awards',[\App\Http\Controllers\Api\V1\PlayerRecordsController::class,'awards'])->middleware('throttle:60,1');
    Route::get('/avatarpedia/players/{id}/records',[\App\Http\Controllers\Api\V1\PlayerRecordsController::class,'records'])->whereUuid('id')->middleware('throttle:60,1');
    Route::get('/avatarpedia/teams/{id}/games',[\App\Http\Controllers\Api\V1\AvatarpediaController::class,'teamGames'])->whereNumber('id')->middleware('throttle:90,1');
    Route::get('/avatarpedia/world', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'world'])->middleware('throttle:60,1');
    Route::get('/avatarpedia/search', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'search'])->middleware('throttle:60,1');
    Route::get('/avatarpedia/directory/{kind}', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'directory'])->middleware('throttle:60,1');
    Route::get('/avatarpedia/articles/{kind}/{id}', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'article'])->middleware('throttle:60,1');
    // Compatibility for saved links and older clients. Both names read the same projections.
    Route::get('/clashbook', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'index'])->middleware('throttle:60,1');
    Route::get('/avatars/{avatar}/components', [\App\Http\Controllers\AvatarComponentController::class,'summary']);
    Route::get('/game-content', [\App\Http\Controllers\GameContentController::class,'manifest']);
    Route::get('/game-content/images/{file}', [\App\Http\Controllers\GameContentController::class,'imageFile'])->name('catalog.image');
    Route::get('/intelligence-policy', [\App\Http\Controllers\IntelligenceController::class,'manifest']);
    Route::get('/avatar-visuals',[\App\Http\Controllers\AvatarEvolutionController::class,'manifest']);
    Route::post('/avatar-visuals/health',[\App\Http\Controllers\AvatarEvolutionController::class,'signal'])->middleware('throttle:10,1');
    Route::get('/avatar-visuals/assets/{release}/{hash}.glb',[\App\Http\Controllers\AvatarEvolutionController::class,'published'])->whereNumber('release')->where('hash','[a-f0-9]{64}')->middleware('throttle:120,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
    Route::get('/auth/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])->whereNumber('id')->middleware(['signed', 'throttle:10,1'])->name('api.verification.verify');
    Route::get('/notifications/unsubscribe/{token}', function (Request $request, string $token) {
        $category = $request->query('category');
        $ok = app(\App\Services\ManagerMail::class)->unsubscribe($token, is_string($category) && array_key_exists($category, \App\Services\ManagerMail::CATEGORIES) ? $category : null);
        return redirect()->away(app(\App\Services\ManagerMail::class)->frontendUrl('settings?section=email&unsubscribed='.($ok ? '1' : '0')));
    })->middleware('throttle:20,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/online/careers',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'index'])->middleware('throttle:30,1');
        Route::get('/online/careers/search',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'search'])->middleware('throttle:30,1');
        Route::post('/online/careers/players/{id}/offer',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'player'])->whereUuid('id')->middleware('throttle:10,1');
        Route::post('/online/careers/players/{id}/retire',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'retire'])->whereUuid('id')->middleware('throttle:5,1');
        Route::post('/online/careers/players/{id}/release',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'release'])->whereUuid('id')->middleware('throttle:5,1');
        Route::post('/online/careers/agreements/{id}',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'respond'])->whereNumber('id')->middleware('throttle:20,1');
        Route::post('/online/careers/vacancies',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'vacancy'])->middleware('throttle:5,1');
        Route::post('/online/careers/office/{id}/release',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'releaseOffice'])->whereNumber('id')->middleware('throttle:5,1');
        Route::post('/online/careers/vacancies/{id}/offer',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'staff'])->whereNumber('id')->middleware('throttle:10,1');
        Route::post('/online/careers/vacancies/{id}/close',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'closeVacancy'])->whereNumber('id')->middleware('throttle:10,1');
        Route::post('/online/careers/sponsors',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'sponsor'])->middleware('throttle:5,1');
        Route::post('/online/careers/sponsors/{id}',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'sponsorResponse'])->whereNumber('id')->middleware('throttle:10,1');
        Route::put('/online/careers/delegation',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'delegate'])->middleware('throttle:10,1');
        Route::post('/online/careers/recommendations/{id}',[\App\Http\Controllers\Api\V1\WorldCareerController::class,'recommendation'])->whereNumber('id')->middleware('throttle:10,1');
        Route::get('/online', [OnlineController::class, 'index']);
        Route::post('/online/staff/hire',[\App\Http\Controllers\Api\V1\ClubStaffController::class,'hire'])->middleware('throttle:10,1');
        Route::post('/online/staff/release',[\App\Http\Controllers\Api\V1\ClubStaffController::class,'release'])->middleware('throttle:10,1');
        Route::get('/online/staff', [\App\Http\Controllers\Api\V1\ClubStaffController::class, 'index']);
        Route::post('/avatarpedia/events/{id}/register', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'register'])->whereNumber('id')->middleware('throttle:10,1');
        Route::post('/clashbook/events/{id}/register', [\App\Http\Controllers\Api\V1\AvatarpediaController::class, 'register'])->whereNumber('id')->middleware('throttle:10,1');
        Route::put('/online/club', [OnlineController::class, 'update']);
        Route::get('/online/fps-identities', [\App\Http\Controllers\Api\V1\FpsIdentityController::class, 'index']);
        Route::post('/online/fps-identities/prepare', [\App\Http\Controllers\Api\V1\FpsIdentityController::class, 'prepare'])->middleware('throttle:5,1');
        Route::get('/online/fps-system', [\App\Http\Controllers\Api\V1\FpsTacticalSystemController::class, 'show']);
        Route::put('/online/fps-system', [\App\Http\Controllers\Api\V1\FpsTacticalSystemController::class, 'update'])->middleware('throttle:20,1');
        Route::put('/online/club/identity', [\App\Http\Controllers\Api\V1\ClubIdentityController::class, 'update']);
        Route::post('/online/club/media',[\App\Http\Controllers\Api\V1\ClubMediaController::class,'upload'])->middleware('throttle:10,1');
        Route::get('/online/office/inbox',[\App\Http\Controllers\Api\V1\ClubOfficeController::class,'inbox']);
        Route::put('/online/office/inbox/read',[\App\Http\Controllers\Api\V1\ClubOfficeController::class,'read']);
        Route::get('/online/office/reports',[\App\Http\Controllers\Api\V1\ClubOfficeController::class,'reports']);
        Route::get('/online/billing', fn (Request $request) => ['data' => app(\App\Services\SupporterBilling::class)->desk($request->user())]);
        Route::post('/online/billing/checkout', function (Request $request) {
            $v = $request->validate(['plan' => ['required', 'in:signal,beacon']]);
            return ['data' => app(\App\Services\SupporterBilling::class)->checkout($request->user(), $v['plan'])];
        })->middleware('throttle:10,1');
        Route::get('/online/billing/checkout/{id}', fn (Request $request, string $id) => ['data' => app(\App\Services\SupporterBilling::class)->checkoutDetails($request->user(), $id)])->whereUuid('id');
        // Mock provider only: the in-app test page confirms or declines a test payment. A real provider confirms by webhook.
        Route::post('/online/billing/checkout/{id}/mock', function (Request $request, string $id) {
            abort_unless(app(\App\Services\SupporterBilling::class)->provider()->isTest(), 404);
            $v = $request->validate(['result' => ['required', 'in:paid,declined']]);
            $billing = app(\App\Services\SupporterBilling::class);
            $billing->checkoutDetails($request->user(), $id);
            return ['data' => $billing->completeCheckout($id, $v['result'] === 'paid', 'mock_'.substr(hash('sha256', $id), 0, 24))];
        })->whereUuid('id')->middleware('throttle:10,1');
        Route::post('/online/billing/cancel', function (Request $request) {
            $v = $request->validate(['cancel' => ['required', 'boolean']]);
            app(\App\Services\SupporterBilling::class)->cancel($request->user(), (bool) $v['cancel']);
            return ['data' => app(\App\Services\SupporterBilling::class)->desk($request->user())];
        })->middleware('throttle:10,1');
        Route::get('/online/scouting', fn (Request $request) => ['data' => app(\App\Services\ScoutingAssignments::class)->desk(app(\App\Services\OnlineService::class)->provision($request->user()))]);
        Route::post('/online/scouting', function (Request $request) {
            $v = $request->validate(['need' => ['required', 'string', 'max:24'], 'region_id' => ['nullable', 'integer']]);
            $club = app(\App\Services\OnlineService::class)->provision($request->user());
            app(\App\Services\ScoutingAssignments::class)->start($club, $v['need'], $v['region_id'] ?? null);
            return response()->noContent();
        })->middleware('throttle:10,1');
        Route::post('/online/scouting/{id}/sign', function (Request $request, int $id) {
            $v = $request->validate(['index' => ['required', 'integer', 'between:0,2']]);
            $card = app(\App\Services\ScoutingAssignments::class)->sign(app(\App\Services\OnlineService::class)->provision($request->user()), $id, $v['index']);
            return ['data' => ['player_id' => $card->id, 'name' => $card->persona_name]];
        })->whereNumber('id')->middleware('throttle:10,1');
        Route::post('/online/scouting/{id}/pass', function (Request $request, int $id) {
            app(\App\Services\ScoutingAssignments::class)->pass(app(\App\Services\OnlineService::class)->provision($request->user()), $id);
            return response()->noContent();
        })->whereNumber('id')->middleware('throttle:10,1');
        Route::get('/online/week', fn (Request $request) => ['data' => app(\App\Services\CompetitionAutoInvites::class)->week(app(\App\Services\OnlineService::class)->provision($request->user()))]);
        Route::post('/online/invitations/{id}/decline', function (Request $request, int $id) {
            app(\App\Services\CompetitionAutoInvites::class)->decline(app(\App\Services\OnlineService::class)->provision($request->user()), $id);
            return response()->noContent();
        })->whereNumber('id')->middleware('throttle:30,1');
        Route::get('/online/fixtures', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'index']);
        Route::get('/online/history',\App\Http\Controllers\Api\V1\ClubHistoryController::class);
        Route::post('/online/fixtures/invites', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'invite'])->middleware('throttle:10,1');
        Route::post('/online/fixtures/invites/{id}/accept', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'accept'])->whereNumber('id')->middleware('throttle:20,1');
        Route::get('/online/market', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'index']);
        Route::get('/online/market/auctions',[\App\Http\Controllers\Api\V1\ClubMarketController::class,'auctions']);
        Route::get('/online/finances', [\App\Http\Controllers\Api\V1\ClubFinanceController::class, 'index']);
        Route::get('/online/supporter',[\App\Http\Controllers\Api\V1\SupporterController::class,'index']);
        Route::put('/online/theme',[\App\Http\Controllers\Api\V1\SupporterController::class,'theme']);
        Route::put('/online/players/{id}/presentation',[\App\Http\Controllers\Api\V1\SupporterController::class,'player'])->whereUuid('id')->middleware('throttle:10,1');
        Route::get('/online/community-cups', [\App\Http\Controllers\Api\V1\CommunityCupController::class, 'index']);
        Route::post('/online/community-cups/{id}/response', [\App\Http\Controllers\Api\V1\CommunityCupController::class, 'respond'])->whereNumber('id')->middleware('throttle:20,1');
        Route::get('/online/market/trade-target', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'tradeTarget']);
        Route::post('/online/market/trades', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'propose'])->middleware('throttle:10,1');
        Route::post('/online/market/trades/{id}/response', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'tradeResponse'])->whereNumber('id')->middleware('throttle:20,1');
        Route::post('/online/market/scout', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'scout'])->middleware('throttle:10,1');
        Route::put('/online/market/academy', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'academy'])->middleware('throttle:10,1');
        Route::post('/online/market/auctions', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'store'])->middleware('throttle:20,1');
        Route::post('/online/market/auctions/{id}/bid', [\App\Http\Controllers\Api\V1\ClubMarketController::class, 'bid'])->whereNumber('id')->middleware('throttle:30,1');
        Route::put('/online/fixtures/{id}/orders', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'update'])->whereNumber('id');
        Route::delete('/online/fixtures/{id}/orders', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'useDefault'])->whereNumber('id');
        Route::get('/online/fixtures/{id}/debrief', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'debrief'])->whereNumber('id');
        Route::get('/online/fixtures/{id}/opponent', [\App\Http\Controllers\Api\V1\ClubFixtureController::class, 'opponent'])->whereNumber('id');
        Route::post('/online/queue', [OnlineController::class, 'queue'])->middleware('throttle:12,1');
        Route::delete('/online/queue', [OnlineController::class, 'leave']);
        Route::post('/online/scrimmage-queue', [\App\Http\Controllers\Api\V1\ScrimmageQueueController::class, 'join'])->middleware('throttle:12,1');
        Route::delete('/online/scrimmage-queue', [\App\Http\Controllers\Api\V1\ScrimmageQueueController::class, 'leave']);
        Route::get('/online/matches/{id}', [OnlineController::class, 'show']);
        Route::get('/online/matches/{id}/replay', [OnlineController::class, 'replay'])->middleware('throttle:120,1');
        Route::get('/online/matches/{id}/live-replay', [OnlineController::class, 'liveReplayHeader'])->middleware('throttle:120,1');
        Route::get('/online/matches/{id}/live-replay/{chunk}', [OnlineController::class, 'liveReplayChunk'])->whereNumber('chunk')->middleware('throttle:240,1');
        Route::post('/online/matches/{id}/stream', [OnlineController::class, 'grant'])->middleware('throttle:30,1');
        Route::get('/evolution', [EvolutionController::class, 'index']);
        Route::get('/evolution/avatar-pipeline', \App\Http\Controllers\AvatarPipelineStatusController::class)->middleware('throttle:20,1');
        Route::post('/evolution/intelligence', [\App\Http\Controllers\IntelligenceController::class,'start'])->middleware('throttle:5,1');
        Route::put('/evolution/intelligence/settings', [\App\Http\Controllers\IntelligenceController::class,'configure']);
        Route::post('/evolution/intelligence/{id}/resume', [\App\Http\Controllers\IntelligenceController::class,'resume']);
        Route::post('/evolution/intelligence/{id}/activate', [\App\Http\Controllers\IntelligenceController::class,'activate']);
        Route::post('/evolution/intelligence/rollback', [\App\Http\Controllers\IntelligenceController::class,'rollback']);
        Route::put('/evolution/settings', [EvolutionController::class, 'settings']);
        Route::post('/evolution/runs', [EvolutionController::class, 'start'])->middleware('throttle:5,1');
        Route::delete('/evolution/runs/{id}', [EvolutionController::class, 'stop']);
        Route::post('/evolution/reviews/{id}/decision', [EvolutionController::class, 'decide']);
        Route::get('/me', fn (Request $request) => response()->json([
            'data' => ['id' => $request->user()->id, 'name' => $request->user()->name, 'email' => $request->user()->email,'email_verified'=>$request->user()->hasVerifiedEmail(),'is_evolution_admin'=>(bool)$request->user()->is_evolution_admin,'supporter'=>app(\App\Services\SupporterMembership::class)->status($request->user()),'theme'=>app(\App\Services\PersonalThemes::class)->effective($request->user())],
        ]));
        Route::delete('/auth/token', [AuthController::class, 'logout']);
        Route::post('/auth/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:3,1');
        Route::get('/online/notifications', fn (Request $request) => ['data' => ['preferences' => app(\App\Services\ManagerMail::class)->preferences($request->user())['categories'],
            'categories' => \App\Services\ManagerMail::CATEGORIES, 'email' => $request->user()->email, 'email_verified' => $request->user()->hasVerifiedEmail()]]);
        Route::put('/online/notifications', function (Request $request) {
            $data = $request->validate(['preferences' => ['required', 'array'], 'preferences.*' => ['boolean']]);
            return ['data' => ['preferences' => app(\App\Services\ManagerMail::class)->update($request->user(), $data['preferences'])['categories']]];
        })->middleware('throttle:20,1');

        Route::get('/club', [ClubProfileController::class, 'show'])->middleware('ability:club:read');
        Route::put('/club', [ClubProfileController::class, 'update'])->middleware('ability:club:write');
        Route::get('/matches', [MatchReportController::class, 'index'])->middleware('ability:matches:read');
        Route::post('/matches', [MatchReportController::class, 'store'])->middleware('ability:matches:write');
        Route::get('/matches/{matchReport}', [MatchReportController::class, 'show'])->middleware('ability:matches:read');
    });
});
