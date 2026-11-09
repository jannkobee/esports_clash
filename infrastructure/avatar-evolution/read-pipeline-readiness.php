<?php
// Read-only backoffice readiness check; does not admit or dispatch work.
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$snapshot=app(App\Services\AvatarPipelineStatusService::class)->snapshot();
echo json_encode(['checked_at'=>$snapshot['checked_at'],'required_compute'=>$snapshot['required_compute'],'automatic_fallback'=>$snapshot['automatic_fallback'],
 'ready_for_preparation'=>$snapshot['ready_for_preparation'],'stages'=>$snapshot['stages']],JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
