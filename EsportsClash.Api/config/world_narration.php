<?php
// This is a normal simulation workload, independent of the Colab-only 3D asset pipeline.
// Historical provider credentials/backoffs are not read and no model request is available.
return [
    'enabled'=>(bool)env('WORLD_VOICES_ENABLED',true),
    'daily_posts'=>(int)env('WORLD_VOICES_DAILY_POSTS',144),
    'hourly_posts'=>18,'posts_per_tick'=>3,'decisions_per_tick'=>12,'account_cooldown_hours'=>8,
];
