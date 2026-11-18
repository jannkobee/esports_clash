<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email:rfc,dns', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);
        $user->forceFill(['supporter_trial_ends_at'=>now('UTC')->addMonthNoOverflow(),'supporter_level'=>'beacon'])->save();
        // A real address lets us reach the manager about their club (results, deadlines, debt) and recover access.
        try { $user->sendEmailVerificationNotification(); } catch (\Throwable $e) { report($e); }

        return response()->json($this->tokenResponse($user, $data['device_name'] ?? 'Hexatrick web client'), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['The supplied credentials are incorrect.']]);
        }

        return response()->json($this->tokenResponse($user, $data['device_name'] ?? 'Hexatrick web client'));
    }

    /** Always answers the same way, so the response never reveals whether an address has an account. */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:255']]);
        $user = User::where('email', $data['email'])->first();
        if ($user && \App\Services\ManagerMail::emailable($user)) {
            try { Password::broker()->sendResetLink(['email' => $user->email]); } catch (\Throwable $e) { report($e); }
        }
        return response()->json(['message' => 'If that address has an account, a reset link is on its way.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string'], 'email' => ['required', 'email'], 'password' => ['required', 'string', 'min:12', 'confirmed']]);
        $status = Password::broker()->reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
            // Signing in again is required everywhere after a reset.
            $user->tokens()->delete();
            if (! $user->hasVerifiedEmail()) $user->markEmailAsVerified();
        });
        if ($status !== Password::PASSWORD_RESET) throw ValidationException::withMessages(['email' => ['This reset link is invalid or has expired. Request a new one.']]);
        return response()->json(['message' => 'Your password has been changed. Sign in with the new password.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasVerifiedEmail()) $user->sendEmailVerificationNotification();
        return response()->json(['verified' => $user->hasVerifiedEmail()]);
    }

    /** Signed link from the verification email; opens the game afterwards. */
    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403, 'This verification link is not valid.');
        if (! $user->hasVerifiedEmail()) $user->markEmailAsVerified();
        return redirect()->away(app(\App\Services\ManagerMail::class)->frontendUrl('club-home?email=verified'));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(status: 204);
    }

    /** @return array{token: string, token_type: string, user: array{id: int, name: string, email: string}} */
    private function tokenResponse(User $user, string $deviceName): array
    {
        return [
            'token' => $user->createToken($deviceName, ['club:read', 'club:write', 'matches:read', 'matches:write'])->plainTextToken,
            'token_type' => 'Bearer',
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email,'email_verified'=>$user->hasVerifiedEmail(),'is_evolution_admin'=>(bool)$user->is_evolution_admin,'supporter'=>app(\App\Services\SupporterMembership::class)->status($user),'theme'=>app(\App\Services\PersonalThemes::class)->effective($user)],
        ];
    }
}
