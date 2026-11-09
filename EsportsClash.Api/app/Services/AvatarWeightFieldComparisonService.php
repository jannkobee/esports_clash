<?php
namespace App\Services;

use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
use Illuminate\Support\Str;
use RuntimeException;

/** Immutable diagnostic evidence; this service cannot create or qualify an avatar candidate. */
class AvatarWeightFieldComparisonService
{
    private const POSES=[['UpperArmL',90],['ThighL',45],['ThighL',90],['ThighR',90]];
    private const FIELDS=['raw','regional','full'];

    private function lineage(AvatarPreparation $run,array $r):bool
    {
        $p=$r['plan']??[];$weights=$run->state['weight_solver_reviews'][$p['weight_solve_id']??'']??[];
        return ($p['preparation_id']??null)===$run->id
            && !empty($p['source_sha256']) && $p['source_sha256']===($run->plan['source_sha256']??null)
            && !empty($p['raw_rig_sha256']) && $p['raw_rig_sha256']===($run->state['cloud_raw_rig']['artifact']['sha256']??null)
            && ($p['files']['raw.glb']??null)===$p['raw_rig_sha256']
            && ($weights['report']['status']??null)==='weights_ready_for_export_review'
            && !empty($p['files']['weight-report.json']) && $p['files']['weight-report.json']===($weights['report_sha256']??null)
            && !empty($p['files']['body-weights.npz']) && $p['files']['body-weights.npz']===($weights['report']['weight_artifact']['sha256']??null);
    }

    private function staticGlb(string $body):void
    {
        if(strlen($body)<20||substr($body,0,4)!=='glTF')throw new RuntimeException('Invalid static GLB');
        $h=unpack('Vversion/Vlength/VjsonLength/VjsonType',substr($body,4,16));
        if($h['version']!==2||$h['length']!==strlen($body)||$h['jsonType']!==0x4E4F534A||$h['jsonLength']>strlen($body)-20)throw new RuntimeException('Invalid static GLB header');
        $g=json_decode(substr($body,20,$h['jsonLength']),true,flags:JSON_THROW_ON_ERROR);
        if(!empty($g['skins'])||!empty($g['animations'])||count($g['meshes']??[])!==1)throw new RuntimeException('Field snapshot must be a single static mesh');
        foreach($g['nodes']??[] as $node)if(isset($node['skin']))throw new RuntimeException('Field snapshot contains a skin');
        foreach($g['meshes'][0]['primitives']??[] as $primitive)if(!empty($primitive['targets']))throw new RuntimeException('Field snapshot contains morph targets');
    }

    public function retain(AvatarPreparation $run,string $directory):array
    {
        $bytes=file_get_contents($directory.'/visual-report.json');$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];
        $soft=($r['method']??null)==='fixed-rig-bounded-weight-field-comparison-v2';
        $bounded=$soft||($r['method']??null)==='fixed-rig-bounded-weight-field-comparison-v1';
        $fields=$soft?[...self::FIELDS,'bounded','bounded_soft']:($bounded?[...self::FIELDS,'bounded']:self::FIELDS);
        if(!Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||!in_array($r['method']??null,['fixed-rig-weight-field-comparison-v1','fixed-rig-bounded-weight-field-comparison-v1','fixed-rig-bounded-weight-field-comparison-v2'],true)
            ||($r['compute']??null)!=='google'||($r['status']??null)!=='rendered_for_review'||($r['errors']??null)!==[]
            ||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false||($r['candidate_available']??true)!==false
            ||($p['poses']??null)!==self::POSES||($p['fields']??null)!==$fields||($p['orbits']??null)!==[0,1,3]
            ||count($r['assets']??[])!==4*count($fields)||count($r['views']??[])!==12*count($fields)||!$this->lineage($run,$r))throw new RuntimeException('Invalid field comparison or lineage');
        $retained=[];
        if($bounded){
            $parent=$run->state['weight_field_comparisons'][$p['parent_review_id']??'']??[];$c=$r['correction']??[];
            if(empty($p['parent_report_sha256'])||$p['parent_report_sha256']!==($parent['report_sha256']??null)
                ||!$this->lineage($run,$parent['report']??[])||($p['correction']??null)!==($soft?'influence-bounded-bbw-v2':'influence-bounded-bbw-v1')
                ||($c['policy']['method']??null)!==$p['correction']||($c['policy']??null)!==($p['correction_policy']??null)
                ||($c['protected_hand_vertices']??0)<1||($c['protected_torso_vertices']??0)<1)throw new RuntimeException('Invalid bounded field lineage or protection');
            if($soft){
                $revision=$run->state['weight_field_comparisons'][$p['revision_of']??'']['report']??[];
                if(($revision['method']??null)!=='fixed-rig-bounded-weight-field-comparison-v1'||!$this->lineage($run,$revision)
                    ||($revision['correction']['protected_hand_vertices']??null)!==$c['protected_hand_vertices']
                    ||($revision['correction']['protected_torso_vertices']??null)!==$c['protected_torso_vertices'])throw new RuntimeException('Missing matching prior bounded field');
            }
            foreach(['protected_hand_max_weight_delta','protected_torso_max_weight_delta'] as $key)
                if(!is_numeric($c[$key]??null)||(float)$c[$key]!==0.0)throw new RuntimeException('Protected field weights changed');
            if(!is_numeric($c['max_normalization_error']??null)||!is_finite((float)$c['max_normalization_error'])||$c['max_normalization_error']>1e-8
                ||!is_numeric($c['minimum_weight']??null)||$c['minimum_weight']<0)throw new RuntimeException('Invalid bounded field weights');
            $proof=$r['weight_artifact']??[];
            if(($proof['file']??null)!=='bounded-weights.npz')throw new RuntimeException('Invalid bounded weights filename');
            $body=file_get_contents($directory.'/'.$proof['file']);
            if(strlen($body)>32*1024**2||strlen($body)!==($proof['bytes']??null)||hash('sha256',$body)!==($proof['sha256']??null)||substr($body,0,2)!=='PK')throw new RuntimeException('Bounded weights hash mismatch');
            $retained[$proof['sha256'].'.npz']=$directory.'/'.$proof['file'];
        }
        $height=$r['body_height']??0;
        if(!is_numeric($height)||!is_finite((float)$height)||$height<=0||count($r['poses']??[])!==4)throw new RuntimeException('Missing pose verification');
        $poseKeys=[];
        foreach($r['poses'] as $pose){
            $key=($pose['joint']??'').':'.($pose['degrees']??'');$error=$pose['raw_blender_max_error']??null;
            if(!in_array([$pose['joint']??null,$pose['degrees']??null],self::POSES,true)||isset($poseKeys[$key])
                ||!is_numeric($error)||!is_finite((float)$error)||$error<0||$error>$height*1e-6)throw new RuntimeException('Invalid matrix verification');
            if($bounded)foreach(['hand_max_position_delta_vs_raw','torso_max_position_delta_vs_raw'] as $protected)
                if(!is_numeric($pose[$protected]??null)||(float)$pose[$protected]!==0.0)throw new RuntimeException('Protected field surface changed');
            $poseKeys[$key]=true;
        }
        $assets=[];$cameras=[];
        foreach($r['assets'] as $asset){
            $field=$asset['field']??'';$joint=$asset['joint']??'';$degrees=$asset['degrees']??null;$key="$field-$joint-$degrees";
            $error=$asset['reimport_max_surface_distance']??null;
            if(!in_array($field,$fields,true)||!in_array([$joint,$degrees],self::POSES,true)||isset($assets[$key])
                ||($asset['file']??null)!=="site/snapshots/$key.glb"||($asset['static_only']??false)!==true
                ||!is_numeric($error)||!is_finite((float)$error)||$error<0||$error>$height*1e-6)throw new RuntimeException('Invalid snapshot proof');
            $body=file_get_contents($directory.'/'.$asset['file']);$this->staticGlb($body);
            if(strlen($body)>20*1024**2||strlen($body)!==($asset['bytes']??null)||hash('sha256',$body)!==($asset['sha256']??null))throw new RuntimeException('Snapshot hash mismatch');
            $assets[$key]=$asset;$retained[$asset['sha256'].'.glb']=$directory.'/'.$asset['file'];
        }
        $seen=[];
        foreach($r['views'] as $view){
            $key=($view['field']??'').'-'.($view['joint']??'').'-'.($view['degrees']??'');$orbit=$view['orbit']??null;$name=$key.'-orbit'.$orbit;
            if(!isset($assets[$key])||!in_array($orbit,[0,1,3],true)||isset($seen[$name])||($view['file']??null)!=='screenshots/'.$name.'.png'
                ||($view['snapshot_sha256']??null)!==$assets[$key]['sha256']||($view['right_handed']??false)!==true)throw new RuntimeException('Invalid screenshot identity');
            $camera=$view['camera']??[];$cameraKey=$view['joint'].'-'.$view['degrees'].'-'.$orbit;
            if(abs(($camera['radius']??0)-$height*.42)>1e-8||abs(($camera['alpha']??-99)-$orbit*M_PI/4)>1e-8
                ||abs(($camera['beta']??0)-1.35)>1e-8||($camera['target']??null)!==$assets[$key]['camera_target_gltf']
                ||(isset($cameras[$cameraKey])&&$cameras[$cameraKey]!==$camera))throw new RuntimeException('Camera mismatch');
            $cameras[$cameraKey]=$camera;$seen[$name]=true;
            $body=file_get_contents($directory.'/'.$view['file']);
            if(!str_starts_with($body,"\x89PNG\r\n\x1a\n")||strlen($body)>10*1024**2||hash('sha256',$body)!==($view['sha256']??null))throw new RuntimeException('Screenshot hash mismatch');
            $retained[$view['sha256'].'.png']=$directory.'/'.$view['file'];
        }
        $assessmentBytes=file_get_contents($directory.'/visual-assessment.json');$assessment=json_decode($assessmentBytes,true,flags:JSON_THROW_ON_ERROR);
        if(($assessment['review_id']??null)!==$r['id']||($assessment['publication_eligible']??true)!==false||($assessment['qualification_complete']??true)!==false
            ||count($assessment['inspected_screenshots']??[])<1)throw new RuntimeException('Missing manual assessment');
        foreach($assessment['inspected_screenshots'] as $view)if(!collect($r['views'])->contains(fn($v)=>$v['file']===($view['file']??null)&&$v['sha256']===($view['sha256']??null)))throw new RuntimeException('Unknown assessed view');
        $details=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'assessment'=>$assessment,'assessment_sha256'=>hash('sha256',$assessmentBytes),
            'publication_eligible'=>false,'qualification_complete'=>false];
        DB::transaction(function()use($run,$r,$details,$retained){
            $locked=AvatarPreparation::lockForUpdate()->findOrFail($run->id);
            if(!$this->lineage($locked,$r))throw new RuntimeException('Lineage changed during retention');
            $state=$locked->state;$prior=$state['weight_field_comparisons'][$r['id']]??null;
            if($prior&&$prior!=$details)throw new RuntimeException('Field evidence is immutable');
            $disk=Storage::disk('local');$prefix='avatar-preparations/'.$run->id.'/weight-fields/'.$r['id'].'/';
            foreach($retained as $name=>$sourcePath){
                $body=file_get_contents($sourcePath);
                if(hash('sha256',$body)!==substr($name,0,64))throw new RuntimeException('Field artifact changed during retention');
                if($disk->exists($prefix.$name)&&hash('sha256',$disk->get($prefix.$name))!==hash('sha256',$body))throw new RuntimeException('Stored field artifact mismatch');
                if(!$disk->exists($prefix.$name)&&!$disk->put($prefix.$name,$body))throw new RuntimeException('Field artifact retention failed');
            }
            if($prior)return;
            $state['weight_field_comparisons'][$r['id']]=$details;$locked->update(['state'=>$state]);
            app(EvolutionService::class)->audit($r['id'],'avatar.weight-field-comparison-retained','owner:authorized-production-avatar-20261026',$details);
        });
        return ['id'=>$r['id'],'report_sha256'=>$details['report_sha256'],'screenshots'=>count($seen),'snapshots'=>count($assets),'publication_eligible'=>false];
    }

    public function file(AvatarPreparation $run,string $id,string $sha,string $extension):string
    {
        $entry=$run->state['weight_field_comparisons'][$id]??[];$r=$entry['report']??[];
        abort_unless(($r['id']??null)===$id&&($r['status']??null)==='rendered_for_review'&&($entry['publication_eligible']??true)===false&&$this->lineage($run,$r),404);
        $proof=$extension==='npz'?((($r['weight_artifact']['sha256']??null)===$sha)?$r['weight_artifact']:null)
            :collect($r[$extension==='png'?'views':'assets']??[])->firstWhere('sha256',$sha);abort_unless($proof,404);
        $path='avatar-preparations/'.$run->id.'/weight-fields/'.$id.'/'.$sha.'.'.$extension;$disk=Storage::disk('local');
        abort_unless($disk->exists($path),404);$body=$disk->get($path);abort_unless(hash_equals($sha,hash('sha256',$body)),409);
        return $body;
    }
}
