<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
try{
    $run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');
    $id='d832094d-eddb-4b70-8b62-d47553d35d64';$entry=$run->state['localized_shape_reviews'][$id];$count=0;
    $service=app(App\Services\AvatarLocalizedShapeReviewService::class);
    foreach(['views'=>'png','assets'=>'glb'] as $collection=>$ext)foreach($entry['report'][$collection] as $proof){
        $body=$service->file($run,$id,$proof['sha256'],$ext);
        if(hash('sha256',$body)!==$proof['sha256'])throw new RuntimeException('Readback mismatch');$count++;
    }
    $proof=$entry['report']['sculpt_artifact'];$body=$service->file($run,$id,$proof['sha256'],'npz');if(hash('sha256',$body)!==$proof['sha256'])throw new RuntimeException('Corrective readback mismatch');$count++;
    view()->share('errors',new Illuminate\Support\ViewErrorBag());$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview');
    $request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
    $controller=app(App\Http\Controllers\AvatarPreparationController::class);$avatars=app(App\Services\AvatarEvolutionService::class);
    $response=$controller->preview($run,$avatars);$html=$response->getContent();
    if($response->getStatusCode()!==200||!str_contains($html,'Left hip shape correction d832094d')||!str_contains($html,'Localized correction'))throw new RuntimeException('Shape comparison missing from preview');
    $jsonRequest=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/report?format=json');
    $api=$controller->report($jsonRequest,$run,$avatars)->getData(true);
    if($api['preparation']['state']['localized_shape_reviews'][$id]['report_sha256']!==$entry['report_sha256'])throw new RuntimeException('API mismatch');
    $result=['verified_on'=>'2026-10-30','id'=>$id,'report_sha256'=>$entry['report_sha256'],'assessment_sha256'=>$entry['assessment_sha256'],
        'artifacts_read_back'=>$count,'preview_status'=>200,'api_matches'=>true,'publication_eligible'=>false,
        'scope'=>'Canonical service readback and shared controller rendering, not authenticated browser E2E.'];
    file_put_contents('/tmp/hip-shape-backoffice-verification.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result,JSON_PRETTY_PRINT);
}catch(Throwable $error){fwrite(STDERR,$error->getMessage().PHP_EOL);exit(1);}
