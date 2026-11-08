<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$dir=$argv[1]??throw new RuntimeException('Evidence directory required');$run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');
$service=app(App\Services\AvatarCombinedContourReviewService::class);$entry=$service->retain($run,$dir);$run->refresh();$count=0;
foreach($entry['files'] as $file=>$unused){[$sha,$ext]=explode('.',$file);$body=Illuminate\Support\Facades\Storage::disk('local')->get('avatar-contour-reviews/'.$run->id.'/'.$entry['report_sha256'].'/'.$file);if(hash('sha256',$body)!==$sha)throw new RuntimeException('Readback mismatch');$count++;}
$first=array_key_first($entry['files']);[$sha,$ext]=explode('.',$first);if(hash('sha256',$service->file($run,$entry['report_sha256'],$sha,$ext))!==$sha)throw new RuntimeException('Service readback mismatch');unset($body);
view()->share('errors',new Illuminate\Support\ViewErrorBag());$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview');$request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
$c=app(App\Http\Controllers\AvatarPreparationController::class);$avatars=app(App\Services\AvatarEvolutionService::class);$response=$c->preview($run,$avatars);
if($response->getStatusCode()!==200||!str_contains($response->getContent(),'Bounded contour trial: '.$entry['assessment']['status']))throw new RuntimeException('Preview missing contour evidence');
$api=$c->report(Illuminate\Http\Request::create('/?format=json'),$run,$avatars)->getData(true);
// JSON numeric normalization is permitted; canonical content must agree.
if(json_encode($api['preparation']['state']['combined_contour_reviews'][$entry['report_sha256']])!==json_encode($run->state['combined_contour_reviews'][$entry['report_sha256']]))throw new RuntimeException('API mismatch');
$result=['artifacts_read_back'=>$count,'preview_status'=>200,'api_matches'=>true,'review'=>$entry['report_sha256'],'attempt'=>$entry['report']['id'],'publication_eligible'=>false,'qualification_complete'=>false,'cli_memory_limit'=>ini_get('memory_limit'),'scope'=>'Shared controller/API and exact retained bytes; not authenticated browser E2E.'];
file_put_contents($dir.'/backoffice-verification.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result).PHP_EOL;
