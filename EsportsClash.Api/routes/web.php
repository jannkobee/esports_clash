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
    Route::prefix('management/{kind}')->whereIn('kind',['avatar','item'])->controller(\App\Http\Controllers\ContentManagementController::class)->group(function () {
        Route::get('/', 'index')->name('management.index');
        Route::get('/create', 'create')->name('management.create');
        Route::post('/import', 'import')->middleware('throttle:6,1')->name('management.import');
        Route::post('/', 'store')->name('management.store');
        Route::get('/{content}/edit', 'edit')->whereUuid('content')->name('management.edit');
        Route::put('/{content}', 'update')->whereUuid('content')->name('management.update');
        Route::post('/{content}/action', 'action')->whereUuid('content')->name('management.action');
        Route::get('/{content}/download', 'download')->whereUuid('content')->name('management.download');
    });

    Route::delete('/reports/preparation/bulk',[\App\Http\Controllers\ReportDeletionController::class,'bulkPreparations'])->name('preparations.bulk-delete');
    Route::delete('/reports/{type}/{id}',[\App\Http\Controllers\ReportDeletionController::class,'destroy'])->whereIn('type',['ml','generation','preparation','enhancement'])->whereUuid('id')->name('reports.delete');
    Route::post('/avatar-jobs/{type}/cancel-all',[\App\Http\Controllers\AvatarJobCancellationController::class,'cancelAll'])->whereIn('type',['generation','preparation','enhancement'])->name('avatar-jobs.cancel-all');
    Route::post('/avatar-jobs/{type}/{id}/cancel',[\App\Http\Controllers\AvatarJobCancellationController::class,'cancel'])->whereIn('type',['generation','preparation','enhancement'])->whereUuid('id')->name('avatar-jobs.cancel');
    Route::get('/avatars/preparation',[\App\Http\Controllers\AvatarPreparationController::class,'index'])->name('preparations.index');
    Route::get('/avatars/preparation/live',[\App\Http\Controllers\AvatarPreparationController::class,'live'])->name('preparations.live');
    Route::post('/avatars/preparation/settings',[\App\Http\Controllers\AvatarPreparationController::class,'settings'])->name('preparations.settings');
    Route::post('/avatars/preparation',[\App\Http\Controllers\AvatarPreparationController::class,'start'])->middleware('throttle:6,1')->name('preparations.start');
    Route::post('/avatars/preparation/{preparation}/control',[\App\Http\Controllers\AvatarPreparationController::class,'control'])->whereUuid('preparation')->middleware('throttle:6,1')->name('preparations.control');
    Route::post('/avatars/preparation/{preparation}/validate',[\App\Http\Controllers\AvatarPreparationController::class,'validateAsset'])->whereUuid('preparation')->name('preparations.validate');
    Route::post('/avatars/preparation/{preparation}/publish',[\App\Http\Controllers\AvatarPreparationController::class,'publish'])->whereUuid('preparation')->name('preparations.publish');
    Route::get('/avatars/preparation/{preparation}/report',[\App\Http\Controllers\AvatarPreparationController::class,'report'])->whereUuid('preparation')->name('preparations.report');
    Route::get('/avatars/preparation/{preparation}/preview',[\App\Http\Controllers\AvatarPreparationController::class,'preview'])->whereUuid('preparation')->name('preparations.preview');
    Route::get('/avatars/preparation/{preparation}/files/{file}',[\App\Http\Controllers\AvatarPreparationController::class,'file'])->whereUuid('preparation')->name('preparations.file');
    Route::get('/avatars/trellis',[\App\Http\Controllers\TrellisGenerationController::class,'index'])->name('trellis.index');
    Route::get('/avatars/trellis/live',[\App\Http\Controllers\TrellisGenerationController::class,'live'])->name('trellis.live');
    Route::patch('/avatars/trellis/compute',[\App\Http\Controllers\TrellisGenerationController::class,'compute'])->name('trellis.compute');
    Route::get('/avatars/trellis/setup/colab',[\App\Http\Controllers\TrellisGenerationController::class,'colabSetup'])->name('trellis.colab-setup');
    Route::get('/avatars/trellis/avatar/{avatar}',[\App\Http\Controllers\TrellisGenerationController::class,'avatarStatus'])->name('trellis.avatar');
    Route::post('/avatars/trellis/reference',[\App\Http\Controllers\TrellisGenerationController::class,'upload'])->middleware('throttle:10,1')->name('trellis.upload');
    Route::get('/avatars/trellis/reference/{avatar}/{digest}',[\App\Http\Controllers\TrellisGenerationController::class,'reference'])->name('trellis.reference');
    Route::post('/avatars/trellis/weapon',[\App\Http\Controllers\TrellisGenerationController::class,'uploadWeapon'])->middleware('throttle:10,1')->name('trellis.upload-weapon');
    Route::post('/avatars/trellis/weapon/{avatar}/{slot}/generate',[\App\Http\Controllers\TrellisGenerationController::class,'generateWeapon'])->whereIn('slot',['primary','secondary'])->middleware('throttle:3,1')->name('trellis.generate-weapon');
    Route::get('/avatars/trellis/weapon/{avatar}/{slot?}',[\App\Http\Controllers\TrellisGenerationController::class,'weaponAsset'])->name('trellis.weapon');
    Route::patch('/avatars/trellis/avatar/{avatar}/prompts',[\App\Http\Controllers\TrellisGenerationController::class,'savePrompts'])->name('trellis.prompts');
    Route::delete('/avatars/trellis/avatar/{avatar}/reference',[\App\Http\Controllers\TrellisGenerationController::class,'destroyReference'])->name('trellis.destroy-reference');
    Route::patch('/avatars/trellis/weapon/{avatar}/{slot}',[\App\Http\Controllers\TrellisGenerationController::class,'updateWeapon'])->whereIn('slot',['primary','secondary'])->name('trellis.update-weapon');
    Route::delete('/avatars/trellis/weapon/{avatar}/{slot}',[\App\Http\Controllers\TrellisGenerationController::class,'destroyWeapon'])->whereIn('slot',['primary','secondary'])->name('trellis.destroy-weapon');
    Route::post('/avatars/trellis',[\App\Http\Controllers\TrellisGenerationController::class,'start'])->middleware('throttle:3,1')->name('trellis.start');
    Route::delete('/avatars/trellis/{generation}/model',[\App\Http\Controllers\TrellisGenerationController::class,'destroyModel'])->withTrashed()->whereUuid('generation')->name('trellis.destroy-model');
    Route::get('/avatars/trellis/{generation}/report',[\App\Http\Controllers\TrellisGenerationController::class,'report'])->whereUuid('generation')->name('trellis.report');
    Route::get('/avatars/trellis/{generation}/asset',[\App\Http\Controllers\TrellisGenerationController::class,'asset'])->withTrashed()->whereUuid('generation')->name('trellis.asset');
    Route::get('/avatars/trellis/{generation}/preview',[\App\Http\Controllers\TrellisGenerationController::class,'preview'])->withTrashed()->whereUuid('generation')->name('trellis.preview');
    Route::get('/avatars', [\App\Http\Controllers\AvatarEvolutionController::class,'index'])->name('avatars.index');
    Route::get('/avatars/reports', [\App\Http\Controllers\AvatarEvolutionController::class,'reports'])->name('avatars.reports');
    Route::post('/avatars/settings', [\App\Http\Controllers\AvatarEvolutionController::class,'settings'])->name('avatars.settings');
    Route::post('/avatars/start', [\App\Http\Controllers\AvatarEvolutionController::class,'start'])->middleware('throttle:6,1')->name('avatars.start');
    Route::post('/avatars/rollback', [\App\Http\Controllers\AvatarEvolutionController::class,'rollback'])->name('avatars.rollback');
    Route::get('/avatars/viewer/{path?}', [\App\Http\Controllers\AvatarEvolutionController::class,'viewer'])->where('path','.*')->name('avatars.viewer');
    Route::get('/avatars/files/{id}/{file}', [\App\Http\Controllers\AvatarEvolutionController::class,'file'])->name('avatars.file');
    Route::get('/avatars/{run}', [\App\Http\Controllers\AvatarEvolutionController::class,'show'])->whereUuid('run')->name('avatars.show');
    Route::get('/avatars/{run}/download', [\App\Http\Controllers\AvatarEvolutionController::class,'download'])->whereUuid('run')->name('avatars.download');
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
