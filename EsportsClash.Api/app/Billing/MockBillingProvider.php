<?php

namespace App\Billing;

/** Test payments only: checkouts are confirmed on an in-app test page and renewals always succeed (unless configured to decline). */
class MockBillingProvider implements BillingProvider
{
    public function name(): string { return 'mock'; }

    public function isTest(): bool { return true; }

    public function checkoutUrl(string $checkoutId): string
    {
        return app(\App\Services\ManagerMail::class)->frontendUrl('supporter-studio?checkout='.$checkoutId);
    }

    public function chargeRenewal(int $userId, string $plan, int $amount, string $currency, string $idempotencyKey): ?string
    {
        return in_array($userId, (array) config('billing.mock_decline_user_ids', []), true) ? null : 'mock_'.substr(hash('sha256', $idempotencyKey), 0, 24);
    }
}
