<?php
namespace App\Services;
use App\Models\AvatarPreparation;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Retained diagnostic playback only. Never changes publication eligibility. */
class AvatarAnimationPlaybackReviewService
{
    public function file(AvatarPreparation $run,string $review,string $sha,string $ext):string
    {
        if(!preg_match('/^[a-f0-9]{64}$/D',$review)||!preg_match('/^[a-f0-9]{64}$/D',$sha)||!in_array($ext,['png','glb'],true))abort(404);
        $state=$run->state;$entry=$state['animation_playback_reviews'][$review]??null;
        if(!$entry||!isset($entry['files'][$sha.'.'.$ext]))abort(404);
        $parent=$state['localized_shape_reviews'][$entry['parent_review_id']]??[];
        if(($parent['report_sha256']??null)!==$entry['parent_report_sha256']||($parent['report']['weight_sha256']??null)!==$entry['export']['weight_sha256'])throw new RuntimeException('Animation review lineage mismatch');
        $path='avatar-animation-reviews/'.$run->id.'/'.$review.'/'.$sha.'.'.$ext;
        $body=Storage::disk('local')->get($path);
        if(hash('sha256',$body)!==$sha)throw new RuntimeException('Animation artifact hash mismatch');
        return $body;
    }
}
