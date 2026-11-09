<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
try{
    $run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');$service=app(App\Services\AvatarLocalizedShapeReviewService::class);$receipts=[];
    foreach(['81173ad0-59d6-4f29-9377-0d1d5bb69442','f67dfc16-7e53-499a-a8ac-f82c061ed531','d286b072-2e6b-4803-9ea9-b70f074c1111','e96c7db2-69b0-4030-9e97-00d4db16a49f'] as $id){
        $entry=$run->state['localized_shape_reviews'][$id];$count=0;
        foreach(['views'=>'png','assets'=>'glb'] as $collection=>$ext)foreach($entry['report'][$collection] as $proof){
            $body=$service->file($run,$id,$proof['sha256'],$ext);if(hash('sha256',$body)!==$proof['sha256'])throw new RuntimeException('Readback mismatch');$count++;
        }
        $proof=$entry['report']['sculpt_artifact'];$body=$service->file($run,$id,$proof['sha256'],'npz');if(hash('sha256',$body)!==$proof['sha256'])throw new RuntimeException('Corrective mismatch');$count++;
        $receipts[]=['id'=>$id,'artifacts_read_back'=>$count,'report_sha256'=>$entry['report_sha256'],'assessment_sha256'=>$entry['assessment_sha256']];
    }
    view()->share('errors',new Illuminate\Support\ViewErrorBag());$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview');
    $request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
    $controller=app(App\Http\Controllers\AvatarPreparationController::class);$avatars=app(App\Services\AvatarEvolutionService::class);$response=$controller->preview($run,$avatars);
    if($response->getStatusCode()!==200||!str_contains($response->getContent(),'Left hip shape correction e96c7db2'))throw new RuntimeException('Latest contour missing from preview');
    $api=$controller->report(Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/report?format=json'),$run,$avatars)->getData(true);
    foreach($receipts as $receipt)if($api['preparation']['state']['localized_shape_reviews'][$receipt['id']]['report_sha256']!==$receipt['report_sha256'])throw new RuntimeException('API mismatch');
    $result=['verified_on'=>'2026-10-30','reviews'=>$receipts,'preview_status'=>200,'api_matches'=>true,'publication_eligible'=>false,
        'scope'=>'Canonical artifact readback and shared controller/API rendering; not authenticated browser E2E or game animation qualification.'];
    file_put_contents('/tmp/contour-backoffice-verification.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result,JSON_PRETTY_PRINT);
}catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
