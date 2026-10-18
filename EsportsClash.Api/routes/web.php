<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EvolutionDashboardController;
use App\Http\Middleware\EnsureEvolutionOwner;

Route::redirect('/', '/evolution');
Route::middleware('guest')->group(function () {
    Route::get('/login', [EvolutionDashboardController::class, 'loginForm'])->name('login');
    Route::post('/login', [EvolutionDashboardController::class, 'login'])->middleware('throttle:5,1');
});
Route::post('/logout', [EvolutionDashboardController::class, 'logout'])->middleware('auth')->name('logout');
Route::middleware(['auth', EnsureEvolutionOwner::class])->prefix('evolution')->group(function () {
    Route::get('/avatars', [\App\Http\Controllers\AvatarEvolutionController::class,'index'])->name('avatars.index');
    Route::get('/avatars/reports', [\App\Http\Controllers\AvatarEvolutionController::class,'reports'])->name('avatars.reports');
    Route::post('/avatars/settings', [\App\Http\Controllers\AvatarEvolutionController::class,'settings'])->name('avatars.settings');
    Route::post('/avatars/start', [\App\Http\Controllers\AvatarEvolutionController::class,'start'])->middleware('throttle:6,1')->name('avatars.start');
    Route::post('/avatars/rollback', [\App\Http\Controllers\AvatarEvolutionController::class,'rollback'])->name('avatars.rollback');
    Route::get('/avatars/viewer/{path?}', [\App\Http\Controllers\AvatarEvolutionController::class,'viewer'])->where('path','.*')->name('avatars.viewer');
    Route::get('/avatars/files/{id}/{file}', [\App\Http\Controllers\AvatarEvolutionController::class,'file'])->name('avatars.file');
    Route::get('/avatars/{run}', [\App\Http\Controllers\AvatarEvolutionController::class,'show'])->whereUuid('run')->name('avatars.show');
    Route::get('/avatars/{run}/download', [\App\Http\Controllers\AvatarEvolutionController::class,'download'])->whereUuid('run')->name('avatars.download');
    Route::post('/avatars/{run}/decide', [\App\Http\Controllers\AvatarEvolutionController::class,'decide'])->whereUuid('run')->name('avatars.decide');
    Route::post('/avatars/{run}/regenerate', [\App\Http\Controllers\AvatarEvolutionController::class,'regenerate'])->whereUuid('run')->middleware('throttle:6,1')->name('avatars.regenerate');
    Route::get('/', [EvolutionDashboardController::class, 'index'])->name('dashboard');
    Route::get('/ml/reports', [EvolutionDashboardController::class, 'archive'])->name('evolution.reports');
    Route::get('/live', [EvolutionDashboardController::class, 'live'])->name('evolution.live');
    Route::get('/runs/{run}', [EvolutionDashboardController::class, 'report'])->name('evolution.report');
    Route::get('/runs/{run}/download', [EvolutionDashboardController::class, 'download'])->name('evolution.download');
    Route::post('/settings', [EvolutionDashboardController::class, 'settings'])->name('evolution.settings');
    Route::post('/operations', [EvolutionDashboardController::class, 'operations'])->middleware('throttle:12,1')->name('evolution.operations');
    Route::post('/runs', [EvolutionDashboardController::class, 'start'])->middleware('throttle:5,1')->name('evolution.start');
    Route::post('/runs/{id}/stop', [EvolutionDashboardController::class, 'stop'])->name('evolution.stop');
    Route::post('/reviews/{id}/decision', [EvolutionDashboardController::class, 'decide'])->name('evolution.decide');
});
