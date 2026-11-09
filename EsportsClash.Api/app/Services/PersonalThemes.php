<?php
namespace App\Services;
use App\Models\User;
class PersonalThemes {
 public function presets():array {return [
  ['id'=>'cinder','name'=>'Cinder','background'=>'#141416','surface'=>'#242125','text'=>'#e8e2e6','accent'=>'#bd3049','density'=>'comfortable'],
  ['id'=>'deepwater','name'=>'Deepwater','background'=>'#10181e','surface'=>'#202e37','text'=>'#e1edf1','accent'=>'#24789e','density'=>'comfortable'],
  ['id'=>'evergreen','name'=>'Evergreen','background'=>'#121a17','surface'=>'#22342c','text'=>'#e3eee8','accent'=>'#347b5c','density'=>'comfortable'],
  ['id'=>'nocturne','name'=>'Nocturne','background'=>'#17141e','surface'=>'#2d253b','text'=>'#eee5f5','accent'=>'#8150a3','density'=>'comfortable'],
 ];}
 public function effective(User $user):array {
  $member=app(SupporterMembership::class)->status($user);$saved=$user->theme_preferences;
  if(!$member['active']||!$saved)return $this->presets()[0];
  if(($saved['id']??null)==='custom')return $member['features']['custom_theme']?$saved:$this->presets()[0];
  return collect($this->presets())->firstWhere('id',$saved['id']??'')??$this->presets()[0];
 }
 private function luminance(string $hex):float {$c=array_map(fn($n)=>hexdec($n)/255,str_split(substr($hex,1),2));$c=array_map(fn($v)=>$v<=0.04045?$v/12.92:pow(($v+0.055)/1.055,2.4),$c);return 0.2126*$c[0]+0.7152*$c[1]+0.0722*$c[2];}
 private function contrast(string $a,string $b):float {$x=$this->luminance($a);$y=$this->luminance($b);return (max($x,$y)+.05)/(min($x,$y)+.05);}
 public function save(User $user,array $data):array {
  app(SupporterMembership::class)->requireFeature($user,'themes');
  if($data['id']==='custom'){
   app(SupporterMembership::class)->requireFeature($user,'custom_theme');
   abort_unless($this->contrast($data['text'],$data['background'])>=4.5&&$this->contrast($data['text'],$data['surface'])>=4.5,422,'Text needs at least 4.5:1 contrast against the canvas and panels. Choose a lighter text color or darker surfaces.');
   $theme=['id'=>'custom','name'=>'My Beacon theme',...array_intersect_key($data,array_flip(['background','surface','text','accent','density']))];
  }else{$theme=collect($this->presets())->firstWhere('id',$data['id']);abort_unless($theme,422,'Choose a published theme.');}
  $user->forceFill(['theme_preferences'=>$theme])->save();return $theme;
 }
}
