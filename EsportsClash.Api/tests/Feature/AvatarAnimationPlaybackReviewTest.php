<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Models\AvatarPreparation;
use App\Services\AvatarAnimationPlaybackReviewService;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
class AvatarAnimationPlaybackReviewTest extends TestCase
{
    private function fixture():array {
        Storage::fake('local');$key=str_repeat('a',64);$hash=hash('sha256','diagnostic');$parent=str_repeat('b',64);$weight=str_repeat('c',64);
        $run=new AvatarPreparation();$run->id='fixture';$run->state=['localized_shape_reviews'=>['parent'=>['report_sha256'=>$parent,'report'=>['weight_sha256'=>$weight]]],
            'animation_playback_reviews'=>[$key=>['parent_review_id'=>'parent','parent_report_sha256'=>$parent,'export'=>['weight_sha256'=>$weight],'files'=>[$hash.'.glb'=>true]]]];
        $path='avatar-animation-reviews/fixture/'.$key.'/'.$hash.'.glb';Storage::disk('local')->put($path,'diagnostic');return [$run,$key,$hash,$path];
    }
    public function test_exact_retained_bytes_are_returned():void {
        [$run,$key,$hash]=$this->fixture();$this->assertSame('diagnostic',app(AvatarAnimationPlaybackReviewService::class)->file($run,$key,$hash,'glb'));
    }
    public function test_tampered_file_is_rejected():void {
        [$run,$key,$hash,$path]=$this->fixture();Storage::disk('local')->put($path,'changed');$this->expectException(RuntimeException::class);$this->expectExceptionMessage('artifact hash mismatch');app(AvatarAnimationPlaybackReviewService::class)->file($run,$key,$hash,'glb');
    }
    public function test_changed_parent_is_rejected():void {
        [$run,$key,$hash]=$this->fixture();$s=$run->state;$s['localized_shape_reviews']['parent']['report_sha256']=str_repeat('d',64);$run->state=$s;
        $this->expectException(RuntimeException::class);$this->expectExceptionMessage('lineage mismatch');app(AvatarAnimationPlaybackReviewService::class)->file($run,$key,$hash,'glb');
    }
}
