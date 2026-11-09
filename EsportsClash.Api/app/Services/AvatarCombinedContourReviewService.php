<?php
namespace App\Services;
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
use RuntimeException;

/** Immutable Colab contour attempts, including rejected attempts. Never admission. */
class AvatarCombinedContourReviewService
{
    private function canonical(array $a):string {
        $sort=function($v)use(&$sort){if(!is_array($v))return $v;if(!array_is_list($v))ksort($v);foreach($v as $k=>$c)$v[$k]=$sort($c);return $v;};
        return json_encode($sort($a),JSON_THROW_ON_ERROR);
    }
    private function parent(AvatarPreparation $run,array $r,?array $state=null):array {
        $state??=$run->state;
        $p=$r['plan']??[];$source=$r['source_sha256']??'';
        $parent=$state['combined_motion_reviews'][$p['parent_review_sha256']??'']??null;
        $animation=$state['animation_playback_reviews'][$source]??[];
        $approved=$state['localized_shape_reviews'][$animation['parent_review_id']??'']??[];
        if(!$parent||($parent['source_sha256']??null)!==$source||($p['source_sha256']??null)!==$source
            ||($p['preparation_id']??null)!==$run->id||($p['files']['current-hip-animation.glb']??null)!==$source
            ||($p['files']['bounded-weights.npz']??null)!=='e42afed24f19eefef5e715f5378b10b805e4994523e6d63a4c931bd12eac7438'
            ||($animation['export']['sha256']??null)!==$source
            ||empty($approved['report_sha256'])||$approved['report_sha256']!==($animation['parent_report_sha256']??null)
            ||($approved['report']['weight_sha256']??null)!==($p['files']['bounded-weights.npz']??null)
            ||($animation['export']['weight_sha256']??null)!==($p['files']['bounded-weights.npz']??null))throw new RuntimeException('Contour parent lineage mismatch');
        return $parent;
    }
    public function retain(AvatarPreparation $run,string $dir):array {
        $read=fn($n)=>json_decode(file_get_contents($dir.'/'.$n),true,flags:JSON_THROW_ON_ERROR);
        $r=$read('repair-report.json');$v=$read('repair-visual-report.json');$a=$read('repair-assessment.json');$manifest=$read('retention-manifest.json');$export=$read('export-report.json');
        $parent=$this->parent($run,$r);$reimport=is_file($dir.'/reimport-geometry-report.json')?$read('reimport-geometry-report.json'):[];
        $gltf=is_file($dir.'/gltf-validation.json')?$read('gltf-validation.json'):[];
        $height=$r['body_height']??null;$parentHeight=$parent['motion']['body_height']??null;
        if(!is_numeric($height)||!is_finite((float)$height)||$height<=0||!is_numeric($parentHeight)||abs($height-$parentHeight)>1e-6)throw new RuntimeException('Contour body scale changed');
        foreach(['shoulder_max_posed_delta_height'=>.02,'shoulder_max_rest_delta_height'=>.02,'hip_total_max_posed_delta_height'=>.03,'hip_total_max_rest_delta_height'=>.04,'inverse_condition_max'=>10] as $key=>$value)
            if(($r['policy'][$key]??null)!==$value)throw new RuntimeException('Frozen contour limits changed');
        if(($r['policy']['version']??null)!==($r['method']??null))throw new RuntimeException('Contour policy identity changed');
        if(!in_array($r['method']??null,['combined-fixed-boundary-contour-v1','combined-contact-separation-v2','combined-dq-shoulder-v3','combined-pose-volume-v4','combined-left-shoulder-handles-v5','combined-left-section-handles-v6','combined-bilateral-section-handles-v7','combined-dual-plane-hip-v8','combined-axillary-relief-v9','combined-axillary-relief-v10','combined-axillary-relief-v11','combined-axillary-relief-v12','combined-axillary-relief-v13','combined-axillary-relief-v14'],true)
            ||($r['status']??null)!=='requires_visual_review'||($r['bones']??null)!==52||($r['max_influences']??null)!==7
            ||($r['baseline_reproduced']??null)!==['combined'=>17,'isolation'=>21]||count($r['poses']??[])!==25
            ||($v['status']??null)!=='rendered_for_review'||($v['errors']??null)!==[]||count($v['views']??[])!==150
            ||($v['source_sha256']??null)!==$r['source_sha256'])throw new RuntimeException('Incomplete contour evidence');
        foreach([$r,$v,$export] as $proof)if(($proof['compute']??null)!=='google'||($proof['qualification_complete']??true)!==false||($proof['publication_eligible']??true)!==false)throw new RuntimeException('Contour evidence cannot qualify');
        if(($a['publication_eligible']??true)!==false||($a['qualification_complete']??true)!==false||!is_string($a['summary']??null))throw new RuntimeException('Invalid contour assessment');
        $expected=[['Rest',0,0,0],['UpperArmL',60,0,0],['UpperArmL',90,0,0],['UpperArmR',60,0,0],['UpperArmR',90,0,0]];
        foreach($parent['motion']['poses'] as $p)$expected[]=[$p['role'],$p['bend'],$p['child_local_x_degrees'],$p['twist']];
        array_push($expected,['ThighL',90,90,10],['ThighL',90,0,20],['ThighL',75,60,20]);
        $cases=[];$regressions=[];
        foreach($r['poses'] as $i=>$pose){
            if([$pose['role']??null,$pose['bend']??null,$pose['child']??null,$pose['twist']??null]!==$expected[$i]
                ||($pose['case']??null)!==sprintf('%02d-%s-%d-child%d-twist%d',$i,...$expected[$i]))throw new RuntimeException('Contour pose coverage changed');
            foreach(['baseline','candidate'] as $mode){
                $c=$pose[$mode]['collision']??[];
                if(($c['finite']??null)!==true||!is_int($c['self_intersections']??null)||$c['self_intersections']<0)throw new RuntimeException('Invalid contour contacts');
                $seam=$pose[$mode]['seam_spread']??null;
                if(!is_numeric($seam)||!is_finite((float)$seam)||$seam>1e-6)throw new RuntimeException('Contour seam opened');
            }
            if($i>=5&&$i<=21&&$pose['baseline']['collision']['self_intersections']!==$parent['motion']['poses'][$i-5]['collision']['self_intersections'])throw new RuntimeException('Contour baseline changed');
            if($i===0&&($pose['max_posed_delta']??null)!=0)throw new RuntimeException('Contour rest changed');
            $cap=$pose['role']==='ThighL'?.03:.02;
            if(!is_numeric($pose['max_posed_delta']??null)||$pose['max_posed_delta']<0||$pose['max_posed_delta']>$r['body_height']*$cap+1e-6)throw new RuntimeException('Contour displacement exceeded');
            if($pose['candidate']['collision']['self_intersections']>$pose['baseline']['collision']['self_intersections'])$regressions[]=$pose['case'];
            $cases[$pose['case']]=[];
        }
        if($regressions!==($r['contact_regressions']??null)||($regressions&&($a['status']??null)!=='rejected_regression'))throw new RuntimeException('Contour regression cannot pass');
        $files=[];
        foreach($manifest as $file=>$proof){
            if(!preg_match('~^(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.(png|glb|npz|json|log)$~D',$file,$m)||str_contains($file,'..')||!preg_match('/^[a-f0-9]{64}$/D',$proof['sha256']??''))throw new RuntimeException('Invalid contour file identity');
            $body=file_get_contents($dir.'/'.$file);$hash=hash('sha256',$body);$ext=$m[1];
            if($hash!==$proof['sha256']||strlen($body)!==($proof['bytes']??null)||strlen($body)>40*1024**2)throw new RuntimeException('Contour artifact mismatch');
            if(($ext==='png'&&!str_starts_with($body,"\x89PNG\r\n\x1a\n"))||($ext==='glb'&&!str_starts_with($body,'glTF'))||($ext==='npz'&&!str_starts_with($body,'PK')))throw new RuntimeException('Invalid contour artifact format');
            $files[$hash.'.'.$ext]=$dir.'/'.$file;
        }
        foreach(['repair-report.json','repair-visual-report.json','repair-assessment.json','export-report.json','execution-receipt.json','contour-targets.npz'] as $file)if(!isset($manifest[$file]))throw new RuntimeException('Missing contour artifact');
        foreach($v['views'] as $view){
            $case=$view['case']??'';$mode=$view['mode']??'';$angle=$view['view']??'';$key=$mode.'-'.$angle;
            if(!isset($cases[$case])||!in_array($mode,['baseline','candidate'],true)||!in_array($angle,['front','side','oblique'],true)||isset($cases[$case][$key])
                ||($view['file']??null)!=='repair-screenshots/'.$case.'-'.$key.'.png'||($manifest[$view['file']]['sha256']??null)!==($view['sha256']??null))throw new RuntimeException('Missing contour views');
            $cases[$case][$key]=true;
        }
        if(($export['status']??null)==='ready_for_babylon_review'){
            if(($manifest['contour-diagnostic.glb']['sha256']??null)!==($export['sha256']??null)||count($v['playback_samples']??[])!==25||($v['playback']['advanced']??null)!==true)throw new RuntimeException('Missing contour playback');
            foreach($v['playback_samples'] as $sample)if(($manifest[$sample['file']??'']['sha256']??null)!==($sample['sha256']??null))throw new RuntimeException('Missing playback capture');
        }
        foreach(['reimport-geometry-report.json'=>$reimport,'gltf-validation.json'=>$gltf] as $name=>$proof)if($proof){
            if(!isset($manifest[$name])||($proof['compute']??null)!=='google'||($proof['sha256']??null)!==($export['sha256']??null)
                ||($proof['publication_eligible']??true)!==false||($proof['qualification_complete']??true)!==false)throw new RuntimeException('Export verification lineage mismatch');
        }
        if(($reimport['status']??null)==='measured'&&array_column($reimport['poses']??[],'case')!==array_column($r['poses'],'case'))throw new RuntimeException('Export contact coverage changed');
        $id=hash_file('sha256',$dir.'/repair-report.json');
        $entry=['report_sha256'=>$id,'source_sha256'=>$r['source_sha256'],'parent_review_sha256'=>$r['plan']['parent_review_sha256'],
            'report'=>$r,'visual'=>$v,'export'=>$export,'assessment'=>$a,'manifest'=>$manifest,'files'=>array_fill_keys(array_keys($files),true),
            'production_admitted'=>false,'publication_eligible'=>false,'qualification_complete'=>false];
        if($reimport)$entry['reimport']=$reimport;
        if($gltf)$entry['gltf']=$gltf;
        DB::transaction(function()use($run,$r,$id,$entry,$files){
            $fresh=AvatarPreparation::lockForUpdate()->findOrFail($run->id);$this->parent($fresh,$r);$s=$fresh->state;
            if(isset($s['combined_contour_reviews'][$id])&&$this->canonical($s['combined_contour_reviews'][$id])!==$this->canonical($entry))throw new RuntimeException('Immutable contour conflict');
            foreach($files as $name=>$sourcePath){$path='avatar-contour-reviews/'.$run->id.'/'.$id.'/'.$name;$body=file_get_contents($sourcePath);
                if(hash('sha256',$body)!==explode('.',$name)[0])throw new RuntimeException('Contour artifact changed during retention');
                if(Storage::disk('local')->exists($path)){
                    if(hash('sha256',Storage::disk('local')->get($path))!==explode('.',$name)[0])throw new RuntimeException('Stored contour artifact changed');
                    continue;
                }
                Storage::disk('local')->put($path,$body);}
            $s['combined_contour_reviews'][$id]=$entry;$fresh->state=$s;$fresh->save();
        });return $entry;
    }
    public function file(AvatarPreparation $run,string $id,string $sha,string $ext):string {
        if(!preg_match('/^[a-f0-9]{64}$/D',$id)||!preg_match('/^[a-f0-9]{64}$/D',$sha)||!in_array($ext,['png','glb','npz','json','log'],true))abort(404);
        $state=$run->state;$entry=$state['combined_contour_reviews'][$id]??null;
        if(!$entry||!isset($entry['files'][$sha.'.'.$ext]))abort(404);
        $this->parent($run,$entry['report'],$state);$body=Storage::disk('local')->get('avatar-contour-reviews/'.$run->id.'/'.$id.'/'.$sha.'.'.$ext);
        if(hash('sha256',$body)!==$sha)throw new RuntimeException('Contour artifact hash mismatch');return $body;
    }
}
