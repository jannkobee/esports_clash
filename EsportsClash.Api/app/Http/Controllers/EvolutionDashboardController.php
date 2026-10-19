<?php

namespace App\Http\Controllers;

use App\Models\{BalanceReview, EvolutionRun, EvolutionSetting};
use App\Services\EvolutionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Auth, DB};
use Illuminate\Validation\ValidationException;

class EvolutionDashboardController extends Controller
{
    public function loginForm()
    {
        return view('evolution.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $attempted = Auth::attempt([...$credentials, 'is_evolution_admin' => true]);
        \Log::debug('login attempt', ['email' => $credentials['email'], 'result' => var_export($attempted, true)]);
        if (! $attempted) {
            throw ValidationException::withMessages(['email' => 'The owner email or password is incorrect.']);
        }
        $request->session()->regenerate();
        $request->session()->forget('url.intended');
        return redirect()->route('dashboard');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }

    private function reports(bool $archive = false): array
    {
        return ['runs' => $archive ? EvolutionRun::latest()->paginate(20) : EvolutionRun::latest()->limit(20)->get(),
            'active' => EvolutionRun::whereIn('status', ['queued', 'running', 'stopping', 'paused_resource'])->latest()->first(),
            'runCount' => EvolutionRun::count(), 'completedCount' => EvolutionRun::where('status', 'completed')->count(),
            'openReviews' => BalanceReview::where('status', 'open')->count(),
            'settings' => EvolutionSetting::current()];
    }

    public function index()
    {
        return view('evolution.dashboard', [...$this->reports(),
            'reviews' => BalanceReview::with('proposals')->latest()->limit(20)->get(),
            'audit' => DB::table('evolution_audits')->latest('id')->limit(50)->get()]);
    }

    public function live()
    {
        return response()->view('evolution.reports', $this->reports())->header('Cache-Control', 'no-store');
    }

    public function archive()
    {
        return response()->view('evolution.archive', $this->reports(true))->header('Cache-Control', 'no-store');
    }

    public function report(EvolutionRun $run)
    {
        return view('evolution.report', ['run' => $run]);
    }

    public function download(EvolutionRun $run)
    {
        return response()->json(['id' => $run->id, 'status' => $run->status, 'plan' => $run->plan,
            'progress' => $run->progress, 'result' => $run->result, 'error' => $run->error,
            'started_at' => $run->started_at, 'finished_at' => $run->finished_at],
            headers: ['Content-Disposition' => 'attachment; filename="learning-report-'.$run->id.'.json"', 'Cache-Control' => 'no-store']);
    }

    public function settings(Request $request, EvolutionService $service)
    {
        $data = $request->validate(['enabled' => ['sometimes', 'boolean'], 'review_hours' => ['sometimes', 'required', 'integer', 'min:1', 'max:336'],
            'training_interval_minutes' => ['sometimes', 'required', 'integer', 'min:30', 'max:10080']]);
        $service->updateSettings($data, 'user:'.$request->user()->id);
        return redirect()->route('dashboard')->with('status', 'Schedule saved.');
    }

    public function start(Request $request, EvolutionService $service)
    {
        $service->startRun('user:'.$request->user()->id);
        return redirect()->route('dashboard')->with('status', 'Learning cycle queued.');
    }

    public function stop(Request $request, string $id, EvolutionService $service)
    {
        $service->stopRun($id, 'user:'.$request->user()->id);
        return redirect()->route('dashboard')->with('status', 'Stop requested. Existing evidence is retained.');
    }

    public function decide(Request $request, string $id, EvolutionService $service)
    {
        $data = $request->validate(['action' => ['required', 'in:select,reject,decline,defer'],
            'proposal_id' => ['nullable', 'integer'], 'hours' => ['nullable', 'integer', 'min:1', 'max:336']]);
        $service->decide($id, $data['action'], $data['proposal_id'] ?? null, 'user:'.$request->user()->id, $data['hours'] ?? null);
        return redirect()->route('dashboard')->with('status', 'Review decision recorded.');
    }

    public function operations(Request $request, EvolutionService $service)
    {
        $data = $request->validate(['action' => ['required', 'in:configure,preview,cleanup'],
            'storage_gib' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'ram_mib' => ['sometimes', 'integer', 'min:512', 'max:3072'],
            'minimum_available_mib' => ['sometimes', 'integer', 'min:512', 'max:65536'],
            'reserved_mib' => ['sometimes', 'integer', 'min:512', 'max:65536'],
            'fit_cases' => ['sometimes', 'integer', 'min:16', 'max:512'],
            'calibration_cases' => ['sometimes', 'integer', 'min:16', 'max:512'],
            'evaluation_cases' => ['sometimes', 'integer', 'min:18', 'max:512'],
            'max_minutes' => ['sometimes', 'integer', 'min:1', 'max:180'],
            'scout_seconds' => ['sometimes', 'integer', 'min:180', 'max:900'],
            'batch_size' => ['sometimes', 'integer', 'min:1', 'max:512'],
            'replay_capacity' => ['sometimes', 'integer', 'min:16', 'max:2048'],
            'failed_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'raw_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'log_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'quarantine_hours' => ['sometimes', 'integer', 'min:1', 'max:168'],
            'workers' => ['sometimes', 'integer', 'in:1'],
            'speed' => ['sometimes', 'in:1,2,4,headless'],
            'automatic_cleanup' => ['sometimes', 'boolean']]);
        $http = \Illuminate\Support\Facades\Http::withToken(config('evolution.worker_token'))->connectTimeout(3)->timeout(20);
        $base = rtrim(config('evolution.runner_url'), '/').'/operations/';
        if ($data['action'] === 'configure') {
            $policy = array_diff_key($data, ['action' => true]);
            foreach ($policy as $key => $value) $policy[$key] = $key === 'speed' ? (string) $value : ($key === 'automatic_cleanup' ? (bool) $value : (int) $value);
            $existing = EvolutionSetting::current()->preferences['operations'] ?? [];
            $policy = [...$existing, ...$policy];
            if (($policy['fit_cases'] ?? 32) + ($policy['calibration_cases'] ?? 24) + ($policy['evaluation_cases'] ?? 24) > 1000) {
                throw ValidationException::withMessages(['fit_cases' => 'The total must fit the reserved 1000-seed block.']);
            }
            $response = $http->post($base.'configure', $policy);
        } else {
            $response = $http->post($base.'cleanup', ['execute' => $data['action'] === 'cleanup']);
        }
        if ($response->failed()) throw ValidationException::withMessages(['operations' => $response->json('error', 'Worker operation could not be completed.')]);
        DB::transaction(function () use ($response, $data, $service, $request) {
            $settings = EvolutionSetting::lockForUpdate()->findOrFail(1);
            $preferences = $settings->preferences ?? [];
            if ($data['action'] === 'configure') $preferences['operations'] = $response->json();
            else $preferences['cleanup_preview'] = $response->json();
            $settings->update(['preferences' => $preferences]);
            $service->audit('operations', 'operations.'.$data['action'], 'user:'.$request->user()->id,
                ['recoverable_bytes' => $response->json('recoverable_bytes', 0)]);
        });
        \App\Jobs\MaintainEvolutionArtifacts::dispatch();
        return redirect()->route('dashboard')->with('status', 'Resource/storage operation recorded. Protected references are retained.');
    }
}
