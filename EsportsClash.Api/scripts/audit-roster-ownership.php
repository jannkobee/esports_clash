<?php
require getcwd().'/vendor/autoload.php';
$app=require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$cards=App\Models\OwnedPlayerCard::orderBy('id')->get(['id','user_id','definition_id','grant_key']);
$catalog=App\Models\OnlineCatalog::where('active',true)->first();
echo json_encode(['owned'=>$cards->count(),'ownership_sha256'=>hash('sha256',$cards->toJson()),
    'active_matches'=>App\Models\OnlineMatch::whereIn('status',['allocated','running'])->count(),
    'catalog'=>$catalog?->id,'rules'=>$catalog?->manifest['rules_version'],
    'policy'=>$catalog?->manifest['policy_version'],
    'owned_on_active_catalog'=>App\Models\OwnedPlayerCard::where('catalog_id',$catalog?->id)->count()],JSON_PRETTY_PRINT).PHP_EOL;

