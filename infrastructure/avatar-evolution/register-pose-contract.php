<?php
if($argc!==3)throw new RuntimeException('Usage: php register-pose-contract.php PREPARATION_UUID REVIEW_DIRECTORY');
try{
    require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    echo json_encode(app(App\Services\AvatarPoseContractReviewService::class)->retain(App\Models\AvatarPreparation::findOrFail($argv[1]),$argv[2]));
}catch(Throwable $error){fwrite(STDERR,$error->getMessage().PHP_EOL);exit(1);}
