<?php
namespace App\Services;
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\{DB,Storage};
use RuntimeException;

/** Combined-motion evidence is never a substitute for production qualification. */
class AvatarCombinedMotionReviewService
{
    private function canonical(array $value):string {
        $sort=function($item)use(&$sort){if(!is_array($item))return $item;if(!array_is_list($item))ksort($item);foreach($item as $key=>$child)$item[$key]=$sort($child);return $item;};
        return json_encode($sort($value),JSON_THROW_ON_ERROR);
    }
    public function retain(AvatarPreparation $run,string $dir):array {
        $read=fn($name)=>json_decode(file_get_contents($dir.'/'.$name),true,flags:JSON_THROW_ON_ERROR);
        $motion=$read('combined-motion-report.json');$visual=$read('combined-visual-report.json');$controls=$read('combined-control-report.json');$assessment=$read('combined-assessment.json');
        $source=$motion['source_sha256']??'';$parent=$run->state['animation_playback_reviews'][$source]??null;
        if(!$parent||($parent['export']['sha256']??null)!==$source)throw new RuntimeException('Missing exact exported parent');
        foreach([$motion,$visual,$controls] as $r)if(($r['compute']??null)!=='google'||($r['source_sha256']??null)!==$source||($r['publication_eligible']??true)!==false||($r['qualification_complete']??true)!==false)throw new RuntimeException('Invalid combined evidence lineage');
        if(($motion['method']??null)!=='exported-combined-motion-v1'||($motion['status']??null)!=='requires_visual_review'||($motion['bones']??null)!==52||($motion['max_influences']??null)!==7||count($motion['poses']??[])!==17||($visual['status']??null)!=='rendered_for_review'||($visual['errors']??null)!==[]||count($visual['views']??[])!==34||($controls['status']??null)!=='controls_complete'||count($controls['controls']??[])!==21)throw new RuntimeException('Incomplete combined motion coverage');
        $controlCases=[];foreach([0,.25,.5,.75,1] as $strength)$controlCases[]=['ThighL',90,90,20,'world_target',$strength];
        foreach(['UpperArmL','UpperArmR'] as $role)foreach([60,90] as $angle)foreach([0,60] as $child)foreach(['world_target','coordinated'] as $mode)$controlCases[]=[$role,$angle,$child,0,$mode,0];
        foreach($controls['controls'] as $i=>$c){
            if([$c['role']??null,$c['angle']??null,$c['child_local_x']??null,$c['twist']??null,$c['mode']??null,$c['corrective_strength']??null]!==$controlCases[$i]||($c['collision']['finite']??null)!==true||!is_int($c['collision']['self_intersections']??null)||$c['collision']['self_intersections']<0)throw new RuntimeException('Invalid isolation controls');
        }
        $expected=[];
        foreach([['ThighL',60,60],['ThighL',90,90],['ThighR',60,60],['UpperArmL',60,60],['UpperArmR',60,60]] as [$role,$angle,$child])foreach([-20,0,20] as $twist)$expected[]=[$role,$angle,$child,$twist];
        $expected[]=['UpperArmL',90,90,0];$expected[]=['UpperArmR',90,90,0];$cases=[];$failed=0;
        foreach($motion['poses'] as $i=>$p){
            if([$p['role']??null,$p['bend']??null,$p['child_local_x_degrees']??null,$p['twist']??null]!==$expected[$i]||isset($cases[$p['case']]))throw new RuntimeException('Changed combined pose coverage');
            $expectedCase=sprintf('%02d-%s-%d-child%d-twist%d',$i,...$expected[$i]);
            if(($p['case']??null)!==$expectedCase)throw new RuntimeException('Invalid pose label');
            $n=$p['collision']['self_intersections']??null;
            if(!is_int($n)||$n<0||($p['collision']['finite']??null)!==true)throw new RuntimeException('Invalid contact measurement');
            $failed+=(int)($n>0);$cases[$p['case']]=[];
        }
        if(($motion['sampled_contact_pass']??null)!==($failed===0))throw new RuntimeException('Contradictory motion pass');
        $files=[];
        foreach($visual['views'] as $v){
            $case=$v['case']??'';$view=$v['view']??'';$hash=$v['sha256']??'';
            if(!isset($cases[$case])||!in_array($view,['front','side'],true)||isset($cases[$case][$view])||!preg_match('/^[a-f0-9]{64}$/D',$hash)||($v['file']??null)!=='combined-screenshots/'.$case.'-'.$view.'.png')throw new RuntimeException('Incomplete combined views');
            $body=file_get_contents($dir.'/'.$v['file']);if(!str_starts_with($body,"\x89PNG\r\n\x1a\n")||hash('sha256',$body)!==$hash)throw new RuntimeException('Combined image mismatch');
            $files[$hash]=$body;$cases[$case][$view]=true;
        }
        if(($assessment['publication_eligible']??true)!==false||($assessment['qualification_complete']??true)!==false)throw new RuntimeException('Assessment cannot qualify avatar');
        $id=hash_file('sha256',$dir.'/combined-motion-report.json');
        $entry=['source_sha256'=>$source,'report_sha256'=>$id,'motion'=>$motion,'visual'=>$visual,'controls'=>$controls,'assessment'=>$assessment,
            'failed_pose_count'=>$failed,'motion_qualification_pass'=>false,'publication_eligible'=>false,'qualification_complete'=>false,
            'skin_profile'=>['name'=>'diagnostic-eight-influence','capacity'=>8,'actual_max'=>7,'production_admitted'=>false], 'files'=>array_fill_keys(array_keys($files),true)];
        DB::transaction(function()use($run,$id,$entry,$files){
            $fresh=AvatarPreparation::lockForUpdate()->findOrFail($run->id);$state=$fresh->state;
            if(($state['animation_playback_reviews'][$entry['source_sha256']]['export']['sha256']??null)!==$entry['source_sha256'])throw new RuntimeException('Parent lineage changed');
            if(isset($state['combined_motion_reviews'][$id])&&$this->canonical($state['combined_motion_reviews'][$id])!==$this->canonical($entry))throw new RuntimeException('Immutable combined review conflict');
            foreach($files as $hash=>$body){$path='avatar-combined-reviews/'.$run->id.'/'.$id.'/'.$hash.'.png';if(Storage::disk('local')->exists($path)&&hash('sha256',Storage::disk('local')->get($path))!==$hash)throw new RuntimeException('Stored combined image changed');Storage::disk('local')->put($path,$body);}
            $state['combined_motion_reviews'][$id]=$entry;$fresh->state=$state;$fresh->save();
        });return $entry;
    }
    public function file(AvatarPreparation $run,string $id,string $sha):string {
        if(!preg_match('/^[a-f0-9]{64}$/D',$id)||!preg_match('/^[a-f0-9]{64}$/D',$sha))abort(404);
        $state=$run->state;$entry=$state['combined_motion_reviews'][$id]??null;
        if(!$entry||!isset($entry['files'][$sha])||!isset($state['animation_playback_reviews'][$entry['source_sha256']]))abort(404);
        $body=Storage::disk('local')->get('avatar-combined-reviews/'.$run->id.'/'.$id.'/'.$sha.'.png');
        if(hash('sha256',$body)!==$sha)throw new RuntimeException('Combined image hash mismatch');return $body;
    }
}
