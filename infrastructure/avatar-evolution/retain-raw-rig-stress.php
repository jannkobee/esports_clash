<?php
// Storage only: never performs mesh, rig or animation processing.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);
$bytes=file_get_contents($argv[2]);
app(App\Services\AvatarRawRigReviewArtifactService::class)->retain($run,$bytes);
echo json_encode(['preparation_id'=>$run->id,'sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),'publication_eligible'=>false]);
