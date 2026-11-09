<?php
namespace App\Services;
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
use Illuminate\Support\Str;
use RuntimeException;

/** Read-only pose evidence on an existing weight field; never a publishable candidate. */
class AvatarPoseContractReviewService
{
    private const MODES=['legacy','world_target','coordinated'];
    private const POSES=[['UpperArmL',45],['UpperArmL',90],['ThighL',90],['ThighR',90]];

    private function lineage(AvatarPreparation $run,array $r):bool {
        $p=$r['plan']??[];$field=$run->state['weight_field_comparisons'][$p['weight_field_review_id']??'']??[];
        return ($p['preparation_id']??null)===$run->id&&!empty($p['source_sha256'])&&$p['source_sha256']===($run->plan['source_sha256']??null)
            &&!empty($p['raw_rig_sha256'])&&$p['raw_rig_sha256']===($run->state['cloud_raw_rig']['artifact']['sha256']??null)
            &&($p['files']['raw.glb']??null)===$p['raw_rig_sha256']
            &&!empty($p['weight_field_report_sha256'])&&$p['weight_field_report_sha256']===($field['report_sha256']??null)
            &&($p['files']['weight-field-report.json']??null)===$p['weight_field_report_sha256']
            &&!empty($r['weight_sha256'])&&$r['weight_sha256']===($field['report']['weight_artifact']['sha256']??null)
            &&($p['files']['bounded-weights.npz']??null)===$r['weight_sha256'];
    }
    private function finite(mixed $value):bool {return is_numeric($value)&&is_finite((float)$value);}
    private function staticGlb(string $body):void {
        if(strlen($body)<20||substr($body,0,4)!=='glTF')throw new RuntimeException('Invalid static snapshot');
        $h=unpack('Vversion/Vlength/VjsonLength/VjsonType',substr($body,4,16));
        if($h['version']!==2||$h['length']!==strlen($body)||$h['jsonType']!==0x4E4F534A||$h['jsonLength']>strlen($body)-20)throw new RuntimeException('Invalid snapshot header');
        $g=json_decode(substr($body,20,$h['jsonLength']),true,flags:JSON_THROW_ON_ERROR);
        if(!empty($g['skins'])||!empty($g['animations'])||count($g['meshes']??[])!==1)throw new RuntimeException('Pose snapshot must be static');
        foreach($g['nodes']??[] as $node)if(isset($node['skin']))throw new RuntimeException('Pose snapshot contains a skin');
    }
    public function retain(AvatarPreparation $run,string $dir):array {
        $bytes=file_get_contents($dir.'/visual-report.json');$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];$c=$p['contract']??[];
        if(!Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||($r['method']??null)!=='fixed-weight-joint-pose-contract-v1'
            ||($r['status']??null)!=='rendered_for_review'||($r['compute']??null)!=='google'||($r['errors']??null)!==[]
            ||($r['candidate_available']??true)!==false||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false
            ||($c['version']??null)!=='world-direction-joint-contract-v1'||($c['modes']??null)!==self::MODES||($c['poses']??null)!==self::POSES
            ||($c['shoulder_parent_forward_rotation_degrees']??null)!==15||($c['hip_child_knee_flexion_degrees']??null)!==60
            ||($c['max_target_error_degrees']??null)!==.01||($p['orbits']??null)!==[0,1,3]
            ||count($r['poses']??[])!==12||count($r['assets']??[])!==12||count($r['views']??[])!==36||!$this->lineage($run,$r))throw new RuntimeException('Invalid pose contract or lineage');
        $height=$r['body_height']??0;if(!$this->finite($height)||$height<=0)throw new RuntimeException('Invalid body height');
        $poses=[];
        foreach($r['poses'] as $pose){
            $mode=$pose['mode']??'';$joint=$pose['joint']??'';$degrees=$pose['degrees']??0;$key="$mode-$joint-$degrees";
            if(!in_array($mode,self::MODES,true)||!in_array([$joint,$degrees],self::POSES,true)||isset($poses[$key]))throw new RuntimeException('Invalid pose identity');
            foreach(['target_error_degrees','parent_rotation_degrees','child_rotation_degrees','center_delta_from_rest'] as $number)
                if(!$this->finite($pose[$number]??null)||$pose[$number]<0)throw new RuntimeException('Missing pose measurement');
            if($mode!=='legacy'&&$pose['target_error_degrees']>.01)throw new RuntimeException('World target was missed');
            $parent=$mode==='coordinated'&&str_starts_with($joint,'UpperArm')?15:0;
            $child=$mode==='coordinated'&&str_starts_with($joint,'Thigh')?60:0;
            if(abs($pose['parent_rotation_degrees']-$parent)>.01||abs($pose['child_rotation_degrees']-$child)>.01
                ||($parent===0&&$pose['center_delta_from_rest']>$height*1e-6))throw new RuntimeException('Unexpected coordinated motion');
            $poses[$key]=$pose;
        }
        $files=[];$assets=[];$cameras=[];$seen=[];
        foreach($r['assets'] as $asset){
            $key=($asset['mode']??'').'-'.($asset['joint']??'').'-'.($asset['degrees']??'');$error=$asset['reimport_max_surface_distance']??null;
            if(!isset($poses[$key])||isset($assets[$key])||($asset['file']??null)!=="site/snapshots/$key.glb"||($asset['static_only']??false)!==true
                ||!$this->finite($error)||$error<0||$error>$height*1e-6)throw new RuntimeException('Invalid pose snapshot proof');
            $body=file_get_contents($dir.'/'.$asset['file']);$this->staticGlb($body);
            if(strlen($body)>20*1024**2||strlen($body)!==($asset['bytes']??null)||hash('sha256',$body)!==($asset['sha256']??null))throw new RuntimeException('Pose snapshot bytes mismatch');
            $assets[$key]=$asset;$files[$asset['sha256'].'.glb']=$dir.'/'.$asset['file'];
        }
        foreach($r['views'] as $view){
            $key=($view['mode']??'').'-'.($view['joint']??'').'-'.($view['degrees']??'');$orbit=$view['orbit']??null;$name=$key.'-orbit'.$orbit;
            if(!isset($assets[$key])||!in_array($orbit,[0,1,3],true)||isset($seen[$name])||($view['file']??null)!=='screenshots/'.$name.'.png'
                ||($view['snapshot_sha256']??null)!==$assets[$key]['sha256']||($view['right_handed']??false)!==true)throw new RuntimeException('Invalid pose screenshot');
            $camera=$view['camera']??[];$cameraKey=$view['joint'].'-'.$view['degrees'].'-'.$orbit;
            foreach(['radius','alpha','beta'] as $number)if(!$this->finite($camera[$number]??null))throw new RuntimeException('Invalid camera measurement');
            if(!is_array($camera['target']??null)||count($camera['target'])!==3||collect($camera['target'])->contains(fn($v)=>!$this->finite($v)))throw new RuntimeException('Invalid camera target');
            if(abs(($camera['radius']??0)-$height*.42)>1e-8||abs(($camera['alpha']??-99)-$orbit*M_PI/4)>1e-8||abs(($camera['beta']??0)-1.35)>1e-8
                ||($camera['target']??null)!==$assets[$key]['camera_target_gltf']||(isset($cameras[$cameraKey])&&$cameras[$cameraKey]!==$camera))throw new RuntimeException('Pose camera mismatch');
            $cameras[$cameraKey]=$camera;$seen[$name]=true;$body=file_get_contents($dir.'/'.$view['file']);
            if(strlen($body)>10*1024**2||!str_starts_with($body,"\x89PNG\r\n\x1a\n")||hash('sha256',$body)!==($view['sha256']??null))throw new RuntimeException('Pose image bytes mismatch');
            $files[$view['sha256'].'.png']=$dir.'/'.$view['file'];
        }
        $assessmentBytes=file_get_contents($dir.'/visual-assessment.json');$a=json_decode($assessmentBytes,true,flags:JSON_THROW_ON_ERROR);
        if(($a['review_id']??null)!==$r['id']||($a['publication_eligible']??true)!==false||($a['qualification_complete']??true)!==false||count($a['inspected_screenshots']??[])<1)throw new RuntimeException('Missing pose assessment');
        foreach($a['inspected_screenshots'] as $v)if(!collect($r['views'])->contains(fn($view)=>$view['file']===($v['file']??null)&&$view['sha256']===($v['sha256']??null)))throw new RuntimeException('Unknown assessed pose image');
        $auditBytes=file_get_contents($dir.'/pose-audit.json');$audit=json_decode($auditBytes,true,flags:JSON_THROW_ON_ERROR);
        if(($audit['compute']??null)!=='google'||($audit['raw_rig_sha256']??null)!==$p['raw_rig_sha256']
            ||($audit['source_sha256']??null)!==$p['source_sha256'])throw new RuntimeException('Pose audit lineage mismatch');
        $entry=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'assessment'=>$a,'assessment_sha256'=>hash('sha256',$assessmentBytes),
            'legacy_audit'=>$audit,'legacy_audit_sha256'=>hash('sha256',$auditBytes),'publication_eligible'=>false,'qualification_complete'=>false];
        DB::transaction(function()use($run,$r,$entry,$files){
            $locked=AvatarPreparation::lockForUpdate()->findOrFail($run->id);if(!$this->lineage($locked,$r))throw new RuntimeException('Pose lineage changed');
            $state=$locked->state;$prior=$state['pose_contract_reviews'][$r['id']]??null;
            if($prior&&$prior!=$entry)throw new RuntimeException('Pose evidence is immutable');
            $disk=Storage::disk('local');$prefix='avatar-preparations/'.$run->id.'/pose-contracts/'.$r['id'].'/';
            foreach($files as $name=>$path){$body=file_get_contents($path);$sha=substr($name,0,64);
                if(hash('sha256',$body)!==$sha||($disk->exists($prefix.$name)&&hash('sha256',$disk->get($prefix.$name))!==$sha))throw new RuntimeException('Pose artifact changed');
                if(!$disk->exists($prefix.$name)&&!$disk->put($prefix.$name,$body))throw new RuntimeException('Pose retention failed');
            }
            if($prior)return;$state['pose_contract_reviews'][$r['id']]=$entry;$locked->update(['state'=>$state]);
            app(EvolutionService::class)->audit($r['id'],'avatar.pose-contract-review-retained','owner:authorized-production-avatar-20261026',$entry);
        });
        return ['id'=>$r['id'],'report_sha256'=>$entry['report_sha256'],'screenshots'=>count($seen),'snapshots'=>count($assets),'publication_eligible'=>false];
    }
    public function file(AvatarPreparation $run,string $id,string $sha,string $ext):string {
        $entry=$run->state['pose_contract_reviews'][$id]??[];$r=$entry['report']??[];
        abort_unless(in_array($ext,['png','glb'],true)&&($r['id']??null)===$id&&($r['status']??null)==='rendered_for_review'
            &&($entry['publication_eligible']??true)===false&&$this->lineage($run,$r),404);
        abort_unless(collect($r[$ext==='png'?'views':'assets']??[])->contains('sha256',$sha),404);
        $disk=Storage::disk('local');$path='avatar-preparations/'.$run->id.'/pose-contracts/'.$id.'/'.$sha.'.'.$ext;
        abort_unless($disk->exists($path),404);$body=$disk->get($path);abort_unless(hash_equals($sha,hash('sha256',$body)),409);return $body;
    }
}
