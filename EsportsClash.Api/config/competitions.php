<?php

return [
    'timezone' => 'UTC',
    'inaugural_year' => (int) env('COMPETITION_INAUGURAL_YEAR', 2027),
    'enabled' => (bool) env('COMPETITIONS_ENABLED', false),
    'skill_weight' => 0.70,
    'achievement_weight' => 0.30,
    'achievement_half_life_days' => 120,
    'provisional_games' => 10,
    'repeat_opponent_daily_limit' => 2,
    'recovery_hours' => 24,
    'max_edition_size' => 256,
    'national_squad_size' => 10,
    'manager_inactive_days' => 14,
    'manager_applications'=>['opens'=>'01-01','closes'=>'12-31','minimum_account_days'=>7,'tenure_days'=>365,'allow_club_management'=>true],
    // Seed identities are data, never country-specific competition rules or player nationality inference.
    'geographies' => [
        ['AS','Asia','continent',null,'UTC'],['EU','Europe','continent',null,'UTC'],['AM','Americas','continent',null,'UTC'],['AF','Africa','continent',null,'UTC'],
        ['SEA','Southeast Asia','region','AS','UTC'],['EA','East Asia','region','AS','UTC'],['WE','Western Europe','region','EU','UTC'],
        ['NA','North America','region','AM','UTC'],['SA','South America','region','AM','UTC'],['SAF','Southern Africa','region','AF','UTC'],
        ['PH','Philippines','country','SEA','Asia/Manila'],['ID','Indonesia','country','SEA','Asia/Jakarta'],
        ['JP','Japan','country','EA','Asia/Tokyo'],['KR','South Korea','country','EA','Asia/Seoul'],
        ['DE','Germany','country','WE','Europe/Berlin'],['FR','France','country','WE','Europe/Paris'],
        ['US','United States','country','NA','America/New_York'],['BR','Brazil','country','SA','America/Sao_Paulo'],
        ['ZA','South Africa','country','SAF','Africa/Johannesburg'],
    ],
    'events' => [
        'vanguard-cup' => ['name' => 'Hexatrick Vanguard Cup', 'type' => 'club', 'capacity' => 16, 'start' => '03-16', 'end' => '03-29', 'close' => '03-05'],
        'summit-masters' => ['name' => 'Hexatrick Summit Masters', 'type' => 'club', 'capacity' => 24, 'start' => '06-28', 'end' => '07-12', 'close' => '06-20'],
        'crown-championship' => ['name' => 'Hexatrick Crown Championship', 'type' => 'club', 'capacity' => 32, 'start' => '10-15', 'end' => '11-14', 'close' => '10-05'],
        'nations-cup' => ['name' => 'Hexatrick Nations Cup', 'type' => 'national', 'capacity' => 48, 'start' => '11-24', 'end' => '12-20', 'close' => '11-16'],
    ],
    'international_windows' => [['03-10', '03-15'], ['06-10', '06-15'], ['09-10', '09-15'], ['11-23', '12-31']],
];
