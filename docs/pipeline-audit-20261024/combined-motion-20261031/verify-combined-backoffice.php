<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');$key='fe11f0e1c304118f06aa6487a04b696d6635637c911bd7e5a1186932e9010edb';$entry=$run->state['combined_motion_reviews'][$key];$service=app(App\Services\AvatarCombinedMotionReviewService::class);$count=0;
app(App\Services\AvatarCombinedMotionReviewService::class)->retain($run,'/tmp/combined-motion-result');
foreach($entry['files'] as $sha=>$unused){if(hash('sha256',$service->file($run,$key,$sha))!==$sha)throw new RuntimeException('Readback mismatch');$count++;}
view()->share('errors',new Illuminate\Support\ViewErrorBag());$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview');$request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
$c=app(App\Http\Controllers\AvatarPreparationController::class);$avatars=app(App\Services\AvatarEvolutionService::class);$response=$c->preview($run,$avatars);
if($response->getStatusCode()!==200||!str_contains($response->getContent(),'Combined motion: 9 of 17 poses have intersections'))throw new RuntimeException('Preview missing');
$api=$c->report(Illuminate\Http\Request::create('/?format=json'),$run,$avatars)->getData(true);
if($api['preparation']['state']['combined_motion_reviews'][$key]!==$entry)throw new RuntimeException('API mismatch');
$result=['artifacts_read_back'=>$count,'preview_status'=>200,'api_matches'=>true,'review'=>$key,'publication_eligible'=>false,'scope'=>'Shared controller/API and retained bytes; not authenticated browser E2E.'];
file_put_contents('/tmp/combined-backoffice-verification.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result).PHP_EOL;
