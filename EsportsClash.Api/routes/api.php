<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClubProfileController;
use App\Http\Controllers\Api\V1\MatchReportController;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    Route::middleware('auth:sanctum')->group(function (): void {
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
