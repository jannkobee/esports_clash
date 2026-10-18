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
    Route::get('/avatar-visuals',[\App\Http\Controllers\AvatarEvolutionController::class,'manifest']);
    Route::get('/avatar-visuals/assets/{release}/{hash}.glb',[\App\Http\Controllers\AvatarEvolutionController::class,'published'])->whereNumber('release')->where('hash','[a-f0-9]{64}')->middleware('throttle:120,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/online', [OnlineController::class, 'index']);
        Route::put('/online/club', [OnlineController::class, 'update']);
        Route::post('/online/queue', [OnlineController::class, 'queue'])->middleware('throttle:12,1');
        Route::delete('/online/queue', [OnlineController::class, 'leave']);
        Route::get('/online/matches/{id}', [OnlineController::class, 'show']);
        Route::get('/online/matches/{id}/replay', [OnlineController::class, 'replay'])->middleware('throttle:120,1');
        Route::post('/online/matches/{id}/stream', [OnlineController::class, 'grant'])->middleware('throttle:30,1');
        Route::get('/evolution', [EvolutionController::class, 'index']);
        Route::put('/evolution/settings', [EvolutionController::class, 'settings']);
        Route::post('/evolution/runs', [EvolutionController::class, 'start'])->middleware('throttle:5,1');
        Route::delete('/evolution/runs/{id}', [EvolutionController::class, 'stop']);
        Route::post('/evolution/reviews/{id}/decision', [EvolutionController::class, 'decide']);
        Route::get('/me', fn (Request $request) => response()->json([
            'data' => ['id' => $request->user()->id, 'name' => $request->user()->name, 'email' => $request->user()->email],
        ]));
        Route::delete('/auth/token', [AuthController::class, 'logout']);

        Route::get('/club', [ClubProfileController::class, 'show'])->middleware('ability:club:read');
        Route::put('/club', [ClubProfileController::class, 'update'])->middleware('ability:club:write');
        Route::get('/matches', [MatchReportController::class, 'index'])->middleware('ability:matches:read');
        Route::post('/matches', [MatchReportController::class, 'store'])->middleware('ability:matches:write');
        Route::get('/matches/{matchReport}', [MatchReportController::class, 'show'])->middleware('ability:matches:read');
    });
});
