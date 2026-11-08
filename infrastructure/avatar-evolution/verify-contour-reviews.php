<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$run=App\Models\AvatarPreparation::findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');$state=$run->state;
$ids=['42facc5c-3ec4-4a89-95e5-49a218202103','54ff2544-dce8-477c-a8b8-9790ce16bb57','8c622f7c-396d-4087-9453-dbdf1ec8f392','2c132a25-0711-44d7-8f6f-fedcc2060b7a'];$selected=[];
foreach($state['combined_contour_reviews']??[] as $sha=>$entry)if(in_array($entry['report']['id'],$ids,true)){
 if($entry['production_admitted']!==false||$entry['publication_eligible']!==false||$entry['qualification_complete']!==false)throw new RuntimeException('Diagnostic promoted');
 $selected[$sha]=$entry;
}
if(count($selected)!==4||($state['animation_playback_reviews']['42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597']['export']['sha256']??null)!=='42ac17a5740ab76878ca88d49e4b03cbb2d5998e7483acce91160bc0dc6ee597'
 ||!isset($state['combined_motion_reviews']['fe11f0e1c304118f06aa6487a04b696d6635637c911bd7e5a1186932e9010edb']))throw new RuntimeException('Missing historical lineage');
view()->share('errors',new Illuminate\Support\ViewErrorBag());$request=Illuminate\Http\Request::create('http://localhost:8089/evolution/avatars/preparation/'.$run->id.'/preview');$request->setLaravelSession(app('session')->driver('array'));$app->instance('request',$request);app('url')->setRequest($request);
$c=app(App\Http\Controllers\AvatarPreparationController::class);$avatars=app(App\Services\AvatarEvolutionService::class);$preview=$c->preview($run,$avatars);
if($preview->getStatusCode()!==200||substr_count($preview->getContent(),'Bounded contour trial:')!==4)throw new RuntimeException('Shared preview coverage mismatch');
$api=$c->report(Illuminate\Http\Request::create('/?format=json'),$run,$avatars)->getData(true);
foreach($selected as $sha=>$entry)if(json_encode($api['preparation']['state']['combined_contour_reviews'][$sha]??null)!==json_encode($entry))throw new RuntimeException('Canonical API mismatch');
$result=['preparation_id'=>$run->id,'preparation_status'=>$run->status,'review_count'=>4,'stored_artifacts_per_review'=>array_map(fn($e)=>count($e['files']),$selected),'preview_status'=>200,'api_matches'=>true,'historical_lineage_preserved'=>true,'publication_eligible'=>false,'qualification_complete'=>false,'cli_memory_limit'=>ini_get('memory_limit'),'scope'=>'Current shared controller/API for all four reviews together; exact artifact readbacks in individual receipts. Not authenticated browser E2E.'];
file_put_contents('/tmp/final-contour-verification.json',json_encode($result,JSON_PRETTY_PRINT));echo json_encode($result).PHP_EOL;
