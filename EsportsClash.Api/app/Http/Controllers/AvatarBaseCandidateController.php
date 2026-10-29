<?php
namespace App\Http\Controllers;
use App\Models\AvatarBaseCandidate;
use App\Services\AvatarEvolutionService;
class AvatarBaseCandidateController extends Controller {
    public function preview(string $avatar,AvatarBaseCandidate $candidate){
        abort_unless($candidate->avatar_id===$avatar,404);
        $name=\App\Models\GameContent::where('kind','avatar')->find($avatar)?->payload['displayName']??$avatar;
        $files=collect(array_keys($candidate->artifacts));
        $assetFile=$files->first(fn($file)=>$file==='candidate-01.glb'||str_ends_with($file,'-animated.glb'))
            ??$files->first(fn($file)=>str_ends_with($file,'.glb'));
        abort_unless($assetFile,409,'This candidate has no recorded GLB to inspect.');
        $diagnostics=\Illuminate\Support\Facades\DB::table('evolution_audits')
            ->where('action','avatar.pipeline-diagnostic-completed')
            ->where('details->plan->source_candidate_id',$candidate->id)->latest('id')->limit(5)->get()
            ->map(fn($row)=>['id'=>$row->subject_id,...json_decode($row->details,true)]);
        return response()->view('evolution.registry.base-preview',compact('avatar','candidate','name','diagnostics','assetFile'))->header('Cache-Control','private, no-store');
    }
    public function file(string $avatar,AvatarBaseCandidate $candidate,string $file,AvatarEvolutionService $worker){
        abort_unless($candidate->avatar_id===$avatar&&preg_match('/^[a-z0-9-]+\.(glb|blend|png|json)$/',$file),404);
        $artifact=$candidate->artifacts[$file]??null;abort_unless($artifact,404);
        $response=$worker->worker()->timeout(45)->get($worker->endpoint('/files/'.$candidate->id.'/'.$file))->throw();$body=$response->body();
        abort_unless(strlen($body)===$artifact['bytes']&&hash_equals($artifact['sha256'],hash('sha256',$body)),409,'Base artifact identity mismatch');
        return response($body,200,['Content-Type'=>$response->header('Content-Type'),'Cache-Control'=>'private, no-store','X-Content-Type-Options'=>'nosniff']);
    }
}
