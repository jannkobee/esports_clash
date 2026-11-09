<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Services\{PersonalThemes,PlayerPresentation,SupporterMembership};
use Illuminate\Http\Request;
class SupporterController extends Controller {
 public function index(Request $r,SupporterMembership $members,PersonalThemes $themes,PlayerPresentation $players){return ['data'=>['membership'=>$members->status($r->user()),'plans'=>$members->plans(),'presets'=>$themes->presets(),'theme'=>$themes->effective($r->user()),'players'=>$players->desk($r->user())]];}
 public function theme(Request $r,PersonalThemes $themes){$v=$r->validate(['id'=>'required|in:cinder,deepwater,evergreen,nocturne,custom','background'=>'required_if:id,custom|regex:/^#[0-9a-fA-F]{6}$/','surface'=>'required_if:id,custom|regex:/^#[0-9a-fA-F]{6}$/','text'=>'required_if:id,custom|regex:/^#[0-9a-fA-F]{6}$/','accent'=>'required_if:id,custom|regex:/^#[0-9a-fA-F]{6}$/','density'=>'required_if:id,custom|in:comfortable,compact']);return ['data'=>$themes->save($r->user(),$v)];}
 public function player(Request $r,string $id,PlayerPresentation $players){
  abort_if(array_diff(array_keys($r->all()),['name','bio','appearance']),422,'Only IGN, biography and portrait style can be changed. Nationality and competitive attributes are fixed.');
  $v=$r->validate(['name'=>['sometimes','required','string','regex:/^[A-Za-z0-9]{3,14}$/'],'bio'=>'sometimes|nullable|string|max:600','appearance'=>'sometimes|array:skin,hair,style,glasses,headset,jersey,accent','appearance.skin'=>'sometimes|integer|between:0,5','appearance.hair'=>'sometimes|integer|between:0,5','appearance.style'=>'sometimes|integer|between:0,6','appearance.glasses'=>'sometimes|boolean','appearance.headset'=>'sometimes|boolean','appearance.jersey'=>'sometimes|regex:/^#[0-9a-fA-F]{6}$/','appearance.accent'=>'sometimes|regex:/^#[0-9a-fA-F]{6}$/']);return ['data'=>$players->save($r->user(),$id,$v)];
 }
}
