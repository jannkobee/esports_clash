<?php
namespace App\Services;
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
use Illuminate\Support\Str;
use RuntimeException;

/** Immutable local shape experiments; never a release or a rigged candidate. */
class AvatarLocalizedShapeReviewService
{
    private function lineage(AvatarPreparation $run,array $r):bool {
        $p=$r['plan']??[];$field=$run->state['weight_field_comparisons'][$p['weight_field_review_id']??'']??[];
        $pose=$run->state['pose_contract_reviews'][$p['parent_pose_review_id']??'']??[];
        if(in_array($r['method']??null,['localized-hip-contour-pilot-v2','localized-hip-contour-pilot-v3','localized-hip-contour-pilot-v4','localized-hip-contour-pilot-v5'],true)){
            $prior=$run->state['localized_shape_reviews'][$p['revision_of']??'']['report']??[];
            if(($prior['weight_sha256']??null)!==($r['weight_sha256']??null)||($prior['plan']['raw_rig_sha256']??null)!==($p['raw_rig_sha256']??null)
                ||($prior['plan']['source_sha256']??null)!==($p['source_sha256']??null))return false;
        }
        return ($p['preparation_id']??null)===$run->id&&!empty($p['source_sha256'])&&$p['source_sha256']===($run->plan['source_sha256']??null)
            &&!empty($p['raw_rig_sha256'])&&$p['raw_rig_sha256']===($run->state['cloud_raw_rig']['artifact']['sha256']??null)
            &&($p['files']['raw.glb']??null)===$p['raw_rig_sha256']&&!empty($r['weight_sha256'])
            &&$r['weight_sha256']===($field['report']['weight_artifact']['sha256']??null)&&($p['files']['bounded-weights.npz']??null)===$r['weight_sha256']
            &&!empty($p['weight_field_report_sha256'])&&$p['weight_field_report_sha256']===($field['report_sha256']??null)
            &&!empty($p['parent_pose_report_sha256'])&&$p['parent_pose_report_sha256']===($pose['report_sha256']??null);
    }
    private function number(mixed $v):bool {return is_numeric($v)&&is_finite((float)$v);}
    private function readProof(string $dir,array $proof,string $file,string $ext):string {
        if(($proof['file']??null)!==$file||!preg_match('/^[a-f0-9]{64}$/D',$proof['sha256']??''))throw new RuntimeException('Invalid shape artifact identity');
        $path=$dir.'/'.$file;$body=file_get_contents($path);
        if(strlen($body)>20*1024**2||hash('sha256',$body)!==$proof['sha256'])throw new RuntimeException('Shape artifact bytes mismatch');
        if($ext==='png'&&!str_starts_with($body,"\x89PNG\r\n\x1a\n"))throw new RuntimeException('Invalid shape image');
        if($ext==='npz'&&!str_starts_with($body,'PK'))throw new RuntimeException('Invalid corrective archive');
        if($ext==='glb'){
            if(strlen($body)<20||substr($body,0,4)!=='glTF')throw new RuntimeException('Invalid shape GLB');
            $h=unpack('Vversion/Vlength/VjsonLength/VjsonType',substr($body,4,16));
            if($h['version']!==2||$h['length']!==strlen($body)||$h['jsonType']!==0x4E4F534A)throw new RuntimeException('Invalid shape GLB header');
            $g=json_decode(substr($body,20,$h['jsonLength']),true,flags:JSON_THROW_ON_ERROR);
            if(!empty($g['skins'])||!empty($g['animations'])||count($g['meshes']??[])!==1)throw new RuntimeException('Shape snapshot must be static');
            foreach($g['nodes']??[] as $node)if(isset($node['skin']))throw new RuntimeException('Shape snapshot is skinned');
        }
        return $path;
    }
    public function retain(AvatarPreparation $run,string $dir):array {
        $bytes=file_get_contents($dir.'/visual-report.json');$r=json_decode($bytes,true,flags:JSON_THROW_ON_ERROR);$p=$r['plan']??[];$policy=$p['policy']??[];
        $method=$r['method']??null;$bounded=$method==='localized-hip-contour-pilot-v5';
        $contour=in_array($method,['localized-hip-contour-pilot-v2','localized-hip-contour-pilot-v3','localized-hip-contour-pilot-v4','localized-hip-contour-pilot-v5'],true);
        $landmark=$contour&&$method!=='localized-hip-contour-pilot-v2';$pinned=$bounded||$method==='localized-hip-contour-pilot-v4';
        if($contour){
            $expected=['version'=>$bounded?'left-hip-collision-bounded-contour-v5':($pinned?'left-hip-pinned-contour-v4':($landmark?'left-hip-landmark-contour-v3':'left-hip-boundary-contour-v2')),
                'handle_offset_height'=>[0,-.05,-.01],'radii_height'=>[.075,.07,.12],'midline_guard_height'=>-.005,
                'boundary_fade_start'=>.65,'screen_strength'=>.00005,'authored_degrees'=>[45,90],'max_inverse_condition'=>10,
                'activation'=>'smoothstep interpolation of rest,45,90 targets'];
            if($landmark)$expected+=['protected_above_joint_height'=>.03,'upper_fade_height'=>.02,'tangent_fraction'=>$pinned?1.0:.15];
            if($bounded)$expected+=['collision_backtracking_scales'=>[1,.5,.25,.125,.0625],'collision_check_degrees'=>[11.25,22.5,33.75,45,56.25,67.5,78.75,90]];
            foreach($expected as $key=>$value)if(($policy[$key]??null)!==$value)throw new RuntimeException('Contour policy changed');
            if($bounded){
                $search=$r['collision_line_search']??[];$last=collect($search['attempts']??[])->last();
                if(!in_array($search['selected_scale']??null,[1,.5,.25,.125,.0625],true)||($last['scale']??null)!==$search['selected_scale']||count($last['checks']??[])!==8)throw new RuntimeException('Missing bounded collision proof');
                foreach($last['checks'] as $i=>$check)if(($check['degrees']??null)!==$expected['collision_check_degrees'][$i]||($check['self_intersections']??null)!==0)throw new RuntimeException('Bounded target intersects');
            }
        }
        if(!Str::isUuid($r['id']??'')||($p['id']??null)!==$r['id']||(!$contour&&$method!=='localized-hip-sculpt-pilot-v1')
            ||($r['compute']??null)!=='google'||($r['status']??null)!=='rendered_for_review'||($r['errors']??null)!==[]
            ||($r['candidate_available']??true)!==false||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false
            ||(!$contour&&($policy['version']??null)!=='left-hip-front-crease-handle-v1')||($policy['joint']??null)!=='ThighL'
            ||($policy['check_degrees']??null)!==[22.5,45,67.5,90]||(!$contour&&($policy['amplitude_height']??null)!==.025)
            ||($policy['max_rest_delta_height']??null)!==.04||($policy['max_posed_delta_height']??null)!==.03
            ||($p['orbits']??null)!==[1,3,5]||count($r['assets']??[])!==8||count($r['views']??[])!==24||!$this->lineage($run,$r))throw new RuntimeException('Invalid shape review or lineage');
        $height=$r['body_height']??null;$sculpt=$r['sculpt']??[];
        if($contour){
            if(($sculpt['policy']??null)!==$policy||count($sculpt['target_proofs']??[])!==2)throw new RuntimeException('Missing contour target proof');
            foreach($sculpt['target_proofs'] as $i=>$proof){
                if(($proof['degrees']??null)!==[45,90][$i]||!$this->number($proof['max_target_delta']??null)||$proof['max_target_delta']<0||$proof['max_target_delta']>$height*.03)throw new RuntimeException('Invalid contour target proof');
                if($landmark&&(!$this->number($proof['protected_upper_max_delta']??null)||$proof['protected_upper_max_delta']!=0))throw new RuntimeException('Protected pelvis moved');
            }
        }
        if(!$this->number($height)||$height<=0||!$this->number($sculpt['max_rest_delta']??null)||$sculpt['max_rest_delta']>$height*.04
            ||!$this->number($sculpt['outside_patch_delta']??null)||$sculpt['outside_patch_delta']!=0
            ||!$this->number($sculpt['seam_delta_spread']??null)||$sculpt['seam_delta_spread']>1e-7)throw new RuntimeException('Invalid shape locality proof');
        $seen=[];
        foreach($r['poses']??[] as $pose){
            $degrees=$pose['degrees']??null;$key=(string)$degrees;
            if(!in_array($degrees,[0,22.5,45,67.5,90],true)||isset($seen[$key]))throw new RuntimeException('Invalid shape sample');
            foreach(['max_delta','outside_patch_max_delta','seam_spread'] as $n)if(!$this->number($pose[$n]??null)||$pose[$n]<0)throw new RuntimeException('Missing shape measurement');
            if($pose['max_delta']>$height*.03||$pose['outside_patch_max_delta']!=0||$pose['seam_spread']>1e-6
                ||($degrees===0&&$pose['max_delta']!=0)||($degrees!==0&&(!$this->number($pose['target_error_degrees']??null)||$pose['target_error_degrees']>.01)))throw new RuntimeException('Shape preservation gate failed');
            $seen[$key]=true;
        }
        if(count($seen)!==5)throw new RuntimeException('Missing intermediate shape samples');
        $files=[];$assets=[];$cameras=[];$views=[];
        foreach($r['assets'] as $a){
            $key=($a['mode']??'').'-ThighL-'.($a['degrees']??'');
            if(!in_array($a['mode']??null,['baseline','sculpt'],true)||($a['joint']??null)!=='ThighL'||!in_array($a['degrees']??null,[22.5,45,67.5,90],true)
                ||isset($assets[$key])||($a['static_only']??null)!==true||!$this->number($a['reimport_max_surface_distance']??null)||$a['reimport_max_surface_distance']>$height*1e-6)throw new RuntimeException('Invalid shape snapshot proof');
            $files[$a['sha256'].'.glb']=$this->readProof($dir,$a,'site/snapshots/'.$key.'.glb','glb');$assets[$key]=$a;
        }
        foreach($r['views'] as $v){
            $key=($v['mode']??'').'-ThighL-'.($v['degrees']??'');$orbit=$v['orbit']??null;$name=$key.'-orbit'.$orbit;
            if(!isset($assets[$key])||($v['joint']??null)!=='ThighL'||!in_array($orbit,[1,3,5],true)||isset($views[$name])
                ||($v['snapshot_sha256']??null)!==$assets[$key]['sha256']||($v['right_handed']??null)!==true)throw new RuntimeException('Invalid shape view');
            $camera=$v['camera']??[];$ck=$v['degrees'].'-'.$orbit;
            foreach(['radius','alpha','beta'] as $n)if(!$this->number($camera[$n]??null))throw new RuntimeException('Invalid shape camera');
            if(abs($camera['radius']-$height*.42)>1e-8||abs($camera['alpha']-$orbit*M_PI/4)>1e-8||abs($camera['beta']-1.35)>1e-8
                ||($camera['target']??null)!==$assets[$key]['camera_target_gltf']||(isset($cameras[$ck])&&$cameras[$ck]!==$camera))throw new RuntimeException('Shape camera mismatch');
            $files[$v['sha256'].'.png']=$this->readProof($dir,$v,'screenshots/'.$name.'.png','png');$views[$name]=true;$cameras[$ck]=$camera;
        }
        $proof=$r['sculpt_artifact']??[];$files[($proof['sha256']??'').'.npz']=$this->readProof($dir,$proof,'hip-sculpt.npz','npz');
        $ab=file_get_contents($dir.'/visual-assessment.json');$a=json_decode($ab,true,flags:JSON_THROW_ON_ERROR);
        if(($a['review_id']??null)!==$r['id']||($a['publication_eligible']??true)!==false||($a['qualification_complete']??true)!==false||empty($a['inspected_screenshots']))throw new RuntimeException('Missing shape assessment');
        foreach($a['inspected_screenshots'] as $v)if(!collect($r['views'])->contains(fn($view)=>$view['file']===($v['file']??null)&&$view['sha256']===($v['sha256']??null)))throw new RuntimeException('Unknown assessed shape image');
        $entry=['report'=>$r,'report_sha256'=>hash('sha256',$bytes),'assessment'=>$a,'assessment_sha256'=>hash('sha256',$ab),'publication_eligible'=>false,'qualification_complete'=>false];
        if(is_file($dir.'/geometry-review.json')){
            $gb=file_get_contents($dir.'/geometry-review.json');$g=json_decode($gb,true,flags:JSON_THROW_ON_ERROR);
            if(($g['id']??null)!==$r['id']||($g['compute']??null)!=='google'||($g['visual_report_sha256']??null)!==$entry['report_sha256']||count($g['poses']??[])!==8)throw new RuntimeException('Invalid independent shape review');
            $entry['geometry_review']=$g;$entry['geometry_review_sha256']=hash('sha256',$gb);
        }
        DB::transaction(function()use($run,$r,$entry,$files){
            $locked=AvatarPreparation::lockForUpdate()->findOrFail($run->id);if(!$this->lineage($locked,$r))throw new RuntimeException('Shape lineage changed');
            $state=$locked->state;$prior=$state['localized_shape_reviews'][$r['id']]??null;if($prior&&$prior!=$entry)throw new RuntimeException('Shape evidence is immutable');
            $disk=Storage::disk('local');$prefix='avatar-preparations/'.$run->id.'/localized-shapes/'.$r['id'].'/';
            foreach($files as $name=>$path){$body=file_get_contents($path);$sha=substr($name,0,64);
                if(hash('sha256',$body)!==$sha||($disk->exists($prefix.$name)&&hash('sha256',$disk->get($prefix.$name))!==$sha))throw new RuntimeException('Shape artifact changed');
                if(!$disk->exists($prefix.$name)&&!$disk->put($prefix.$name,$body))throw new RuntimeException('Shape retention failed');
            }
            if($prior)return;$state['localized_shape_reviews'][$r['id']]=$entry;$locked->update(['state'=>$state]);
            app(EvolutionService::class)->audit($r['id'],'avatar.localized-shape-review-retained','owner:authorized-production-avatar-20261026',$entry);
        });
        return ['id'=>$r['id'],'report_sha256'=>$entry['report_sha256'],'screenshots'=>count($views),'snapshots'=>count($assets),'publication_eligible'=>false];
    }
    public function file(AvatarPreparation $run,string $id,string $sha,string $ext):string {
        $entry=$run->state['localized_shape_reviews'][$id]??[];$r=$entry['report']??[];
        abort_unless(in_array($ext,['png','glb','npz'],true)&&($r['id']??null)===$id&&($r['status']??null)==='rendered_for_review'&&($entry['publication_eligible']??true)===false&&$this->lineage($run,$r),404);
        $proofs=$ext==='npz'?[$r['sculpt_artifact']??[]]:($r[$ext==='png'?'views':'assets']??[]);abort_unless(collect($proofs)->contains('sha256',$sha),404);
        $disk=Storage::disk('local');$path='avatar-preparations/'.$run->id.'/localized-shapes/'.$id.'/'.$sha.'.'.$ext;
        abort_unless($disk->exists($path),404);$body=$disk->get($path);abort_unless(hash_equals($sha,hash('sha256',$body)),409);return $body;
    }
}
