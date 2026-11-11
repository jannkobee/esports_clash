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
        Route::post('/online/queue', [OnlineController::class, 'queue'])->middleware('throttle:12,1');
        Route::delete('/online/queue', [OnlineController::class, 'leave']);
        Route::post('/online/scrimmage-queue', [\App\Http\Controllers\Api\V1\ScrimmageQueueController::class, 'join'])->middleware('throttle:12,1');
        Route::delete('/online/scrimmage-queue', [\App\Http\Controllers\Api\V1\ScrimmageQueueController::class, 'leave']);
        Route::get('/online/matches/{id}', [OnlineController::class, 'show']);
        Route::get('/online/matches/{id}/replay', [OnlineController::class, 'replay'])->middleware('throttle:120,1');
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
            'data' => ['id' => $request->user()->id, 'name' => $request->user()->name, 'email' => $request->user()->email,'is_evolution_admin'=>(bool)$request->user()->is_evolution_admin,'supporter'=>app(\App\Services\SupporterMembership::class)->status($request->user()),'theme'=>app(\App\Services\PersonalThemes::class)->effective($request->user())],
        ]));
        Route::delete('/auth/token', [AuthController::class, 'logout']);

        Route::get('/club', [ClubProfileController::class, 'show'])->middleware('ability:club:read');
        Route::put('/club', [ClubProfileController::class, 'update'])->middleware('ability:club:write');
        Route::get('/matches', [MatchReportController::class, 'index'])->middleware('ability:matches:read');
        Route::post('/matches', [MatchReportController::class, 'store'])->middleware('ability:matches:write');
        Route::get('/matches/{matchReport}', [MatchReportController::class, 'show'])->middleware('ability:matches:read');
    });
});
