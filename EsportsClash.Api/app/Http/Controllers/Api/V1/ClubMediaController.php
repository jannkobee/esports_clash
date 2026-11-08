<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Models\{ClubFixture,OnlineClub};
use App\Services\{OnlineService,SupporterMembership};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB,Storage};
use Illuminate\Support\Str;
class ClubMediaController extends Controller {
 public function upload(Request $r,OnlineService $online,SupporterMembership $membership){
  $membership->requireCustomization($r->user());
  $v=$r->validate(['kind'=>'required|in:logo,home_jersey,away_jersey','revision'=>'required|integer|min:1','image'=>'required|file|image|mimes:png,jpg,jpeg,webp|max:4096|dimensions:min_width=32,min_height=32,max_width=1024,max_height=1024']);
  $club=$online->provision($r->user());$image=$r->file('image');$mime=$image->getMimeType();
  abort_unless(in_array($mime,['image/png','image/jpeg','image/webp'],true),422,'Upload a PNG, JPEG or WebP image.');
  $id=(string)Str::uuid();$path='club-identity/'.$club->id.'/'.$id.'.'.(['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'][$mime]);
  $dimensions=getimagesize($image->getRealPath());$sha=hash_file('sha256',$image->getRealPath());
  Storage::disk('local')->put($path,file_get_contents($image->getRealPath()));
  try{$club=DB::transaction(function()use($club,$r,$v,$id,$path,$mime,$dimensions,$sha){
   $locked=OnlineClub::whereKey($club->id)->lockForUpdate()->firstOrFail();abort_unless(isset($locked->identity['crest'],$locked->identity['colors']),422,'Save your basic club identity before uploading artwork.');abort_if(ClubFixture::awaitingSnapshot($locked->id),409,'A fixture is locking the club identity. Try again shortly.');abort_unless($locked->revision===$v['revision'],409,'The club changed. Refresh before uploading.');
   DB::table('club_identity_assets')->insert(['id'=>$id,'club_id'=>$locked->id,'user_id'=>$r->user()->id,'kind'=>$v['kind'],'path'=>$path,'mime'=>$mime,'sha256'=>$sha,'width'=>$dimensions[0],'height'=>$dimensions[1],'created_at'=>now()]);
   $identity=$locked->identity??[];$identity['assets'][$v['kind']]='/club-media/'.$id;$locked->update(['identity'=>$identity,'revision'=>$locked->revision+1]);return $locked;
  },3);}catch(\Throwable $e){Storage::disk('local')->delete($path);throw $e;}
  return ['data'=>$club];
 }
 public function show(string $id){$asset=DB::table('club_identity_assets')->where('id',$id)->first();abort_unless($asset&&Storage::disk('local')->exists($asset->path),404);return response()->file(Storage::disk('local')->path($asset->path),['Content-Type'=>$asset->mime,'X-Content-Type-Options'=>'nosniff','Cache-Control'=>'public, max-age=31536000, immutable','Content-Security-Policy'=>"default-src 'none'; sandbox"]);}
}
