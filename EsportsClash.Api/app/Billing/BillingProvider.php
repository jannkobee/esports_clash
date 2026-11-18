<?php

namespace App\Billing;

/**
 * A payment provider for Supporter memberships. Implementations confirm a checkout and charge renewals;
 * BillingService owns entitlements, so changing provider never changes what a membership grants.
 */
interface BillingProvider
{
    public function name(): string;

    /** True when payments are simulated (no money moves); the interface says so wherever it shows prices. */
    public function isTest(): bool;

    /** Where the manager completes a checkout (a provider page, or the in-app test page for the mock). */
    public function checkoutUrl(string $checkoutId): string;

    /** Charge one renewal. Returns a provider reference, or null when the charge was declined. */
    public function chargeRenewal(int $userId, string $plan, int $amount, string $currency, string $idempotencyKey): ?string;
}
