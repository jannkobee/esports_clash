<?php
require '/app/vendor/autoload.php';$app=require '/app/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
$dir=$argv[1];$export=json_decode(file_get_contents($dir.'/animation-export-report.json'),true,flags:JSON_THROW_ON_ERROR);
$browser=json_decode(file_get_contents($dir.'/babylon-animation-report.json'),true,flags:JSON_THROW_ON_ERROR);
$assessment=json_decode(file_get_contents($dir.'/visual-assessment.json'),true,flags:JSON_THROW_ON_ERROR);
$key=$export['sha256'];$parent='e96c7db2-69b0-4030-9e97-00d4db16a49f';$parentHash='566772b8cfdc8b1caf3e514748624cd60a0bed46acad760b4adb1e91d2036b26';
if($export['status']!=='ready_for_babylon_review'||$browser['status']!=='rendered_for_visual_review'||$browser['asset_sha256']!==$key||$browser['errors']!==[]||!$browser['playback']['advanced']||count($browser['samples'])!==18||count($export['roundtrip'])!==9||$export['bones']!==52||$export['max_influences']!==7)throw new RuntimeException('Incomplete animation proof');
foreach([$export,$browser,$assessment] as $proof)if(($proof['publication_eligible']??true)!==false||($proof['qualification_complete']??true)!==false)throw new RuntimeException('Diagnostic may not qualify publication');
foreach($export['roundtrip'] as $row)if(!is_numeric($row['surface_error'])||!is_finite($row['surface_error'])||$row['surface_error']>1e-5||$row['surface_error']<0)throw new RuntimeException('Roundtrip gate failed');
$files=[$key.'.glb'=>$dir.'/current-hip-animation.glb'];
foreach($browser['samples'] as $s){if(!preg_match('/^animation-screenshots\/phase-[0-9.]+-(front|side)\.png$/D',$s['file']))throw new RuntimeException('Bad screenshot path');$files[$s['sha256'].'.png']=$dir.'/'.$s['file'];}
foreach($files as $name=>$path)if(hash_file('sha256',$path)!==substr($name,0,64))throw new RuntimeException('Artifact changed');
$body=file_get_contents($files[$key.'.glb']);$h=unpack('Vversion/Vlength/VjsonLength/VjsonType',substr($body,4,16));
if(substr($body,0,4)!=='glTF'||$h['version']!==2||$h['length']!==strlen($body)||$h['jsonType']!==0x4e4f534a)throw new RuntimeException('Invalid GLB');
$g=json_decode(substr($body,20,$h['jsonLength']),true,flags:JSON_THROW_ON_ERROR);
if(count($g['skins'])!==1||count($g['skins'][0]['joints'])!==52||count($g['animations'])!==1)throw new RuntimeException('Wrong rig/clip');
foreach($g['meshes'] as $m)foreach($m['primitives'] as $p)if(!isset($p['attributes']['JOINTS_1'],$p['attributes']['WEIGHTS_1'])||count($p['targets'])!==2)throw new RuntimeException('Missing extra weights/morphs');
$entry=['parent_review_id'=>$parent,'parent_report_sha256'=>$parentHash,'export'=>$export,'browser'=>$browser,'assessment'=>$assessment,'files'=>array_fill_keys(array_keys($files),true),'publication_eligible'=>false,'qualification_complete'=>false];
DB::transaction(function()use($key,$entry,$files,$parent,$parentHash,$export){
 $run=AvatarPreparation::lockForUpdate()->findOrFail('24e7f704-3abe-42d4-9c47-204627ee9e88');$state=$run->state;
 if(($state['localized_shape_reviews'][$parent]['report_sha256']??null)!==$parentHash||($state['localized_shape_reviews'][$parent]['report']['weight_sha256']??null)!==$export['weight_sha256'])throw new RuntimeException('Wrong parent lineage');
 if(isset($state['animation_playback_reviews'][$key])&&$state['animation_playback_reviews'][$key]!==$entry)throw new RuntimeException('Immutable review conflict');
 foreach($files as $name=>$path){$to='avatar-animation-reviews/'.$run->id.'/'.$key.'/'.$name;if(Storage::disk('local')->exists($to)&&hash('sha256',Storage::disk('local')->get($to))!==substr($name,0,64))throw new RuntimeException('Stored artifact conflict');Storage::disk('local')->put($to,file_get_contents($path));}
 $state['animation_playback_reviews'][$key]=$entry;$run->state=$state;$run->save();
});
echo json_encode(['review'=>$key,'artifacts'=>count($files),'publication_eligible'=>false]).PHP_EOL;
