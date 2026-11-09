<?php
namespace App\Services;
class WorldClubIdentity {
 public function make(string $key):array {
  $h=hash('sha256',$key);$places=['Harbor','Northstar','Silvervale','Redwood','Bayport','Cinder','Windward','Aurora','Westhaven','Ironvale','Lumin','Stonebridge','Solstice','Riverton','Crestfall','Summervale','Skylark','Evermere','Stormgate','Vesper','Duskport','Pinecrest','Rosegate','Tidehaven'];
  $names=['Aegis','Relay','Owls','Vanguard','Nomads','Union','Ravens','Orbits','Sentinels','Wolves','Lanterns','Pilots','Atlas','Comets','Guard','Array','Lynx','Forge','Academy','Rooks','Kestrels','Drift','Cobalt','Signal'];
  $first=['Ari','Mika','Tala','Jun','Sora','Dani','Eli','Rin','Noa','Sol','Kai','Lena'];$last=['Navarro','Santos','Cruz','Mori','Silva','Reyes','Park','Vale','Torres','Arden','Rivera','Solis'];
  $a=hexdec(substr($h,0,4));$b=hexdec(substr($h,4,4));$colors=['#963144','#3d608b','#7c6141','#537d68','#6b5484','#9b613e'];
  return ['name'=>$places[$a%count($places)].' '.$names[$b%count($names)],'manager'=>$first[$a%count($first)].' '.$last[$b%count($last)],'identity'=>['crest'=>['shape'=>['shield','circle','diamond'][$a%3],'mark'=>['star','bolt','tower'][$b%3]],'colors'=>['primary'=>$colors[$a%count($colors)],'secondary'=>'#f2e9e5','accent'=>['#e6b962','#d5b0c4','#b4d5dc'][$b%3]],'home_jersey'=>['pattern'=>['solid','stripes','diagonal'][$a%3]],'away_jersey'=>['pattern'=>'solid']]];
 }
}
