<?php
return [
    'enabled'=>env('COMMUNITY_CUPS_ENABLED',true),
    // A deployment admission limit, not a claim that one Arena worker supports 50k managers.
    'max_pods_per_week'=>(int)env('COMMUNITY_CUPS_MAX_PODS_PER_WEEK',128),
    'invite_batch'=>200,
];
