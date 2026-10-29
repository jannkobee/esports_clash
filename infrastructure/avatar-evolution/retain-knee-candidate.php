<?php
// Store the exact experimental Colab GLB through the same integrity checked backoffice path.
require '/app/vendor/autoload.php';
$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail($argv[1]);$reviewId=$argv[2];$bytes=file_get_contents($argv[3]);
app(App\Services\AvatarRawRigReviewArtifactService::class)->retainCandidate($run,$reviewId,$bytes);
echo json_encode(['preparation_id'=>$run->id,'review_id'=>$reviewId,'sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes),'publication_eligible'=>false]);
