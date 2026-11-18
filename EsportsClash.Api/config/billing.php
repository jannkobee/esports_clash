<?php

return [
    // 'mock' until the owner chooses a payment provider. The mock charges nothing and is labelled as a test
    // everywhere a manager sees it. A real provider implements App\Billing\BillingProvider.
    'provider' => env('BILLING_PROVIDER', 'mock'),
    'currency' => 'PHP',
    // Monthly prices in centavos (illustrative; from the business record's hypotheses, not researched).
    'prices' => [
        'signal' => (int) env('BILLING_PRICE_SIGNAL', 9900),
        'beacon' => (int) env('BILLING_PRICE_BEACON', 14900),
    ],
    // Days before a trial or a cancelled membership ends to remind the manager by email.
    'reminder_days' => 3,
    // The mock provider declines renewals for accounts listed here (to rehearse failed payments).
    'mock_decline_user_ids' => array_filter(array_map('intval', explode(',', (string) env('BILLING_MOCK_DECLINE_USERS', '')))),
];
