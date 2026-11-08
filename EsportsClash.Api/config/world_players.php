<?php

return [
    // This is enabled only after the worker capability and safe roster-reset gates.
    'enabled' => false,
    'starter_min' => 18, 'starter_max' => 36, 'academy_min' => 15, 'academy_max' => 32,
    'potential_min' => 60, 'potential_max' => 82,
    'training_xp_per_step' => 40,
    'scout_target_roster' => 8,
    'bot_bid_fraction' => 0.15,
    'bot_wage_reserve_weeks' => 4,
    'minimum_bot_population' => 32,
    'new_manager_max_overall' => 36,
];
