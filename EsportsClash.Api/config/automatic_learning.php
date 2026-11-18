<?php

return [
    // Approved bundles and the append-only promotion registry.
    'models_path' => env('FPS_LEARNING_MODELS_PATH', base_path('AutomaticLearning/models')),
    // Bearer token for the headless learning worker's lineage writes (at least 32 characters).
    'writer_token' => (string) env('FPS_LEARNING_WRITER_TOKEN', ''),
];
