<?php
namespace App\Services;
use App\Models\User;
use Carbon\CarbonImmutable;
class SupporterMembership {
 public function status(User $user):array {
  $trial=$user->supporter_trial_ends_at?CarbonImmutable::parse($user->supporter_trial_ends_at):null;
  $paid=$user->supporter_until?CarbonImmutable::parse($user->supporter_until):null;
  $admin=(bool)$user->is_game_owner||(bool)$user->is_evolution_admin;
  $active=$admin||$paid?->isFuture()||$trial?->isFuture();
  $end=$admin?null:collect([$trial,$paid])->filter()->sortByDesc(fn($d)=>$d->getTimestamp())->first();
  $level=$active?($admin?'beacon':($user->supporter_level==='beacon'?'beacon':'signal')):'free';
  return ['active'=>$active,'kind'=>$admin?'owner':($paid?->isFuture()?'supporter':($trial?->isFuture()?'trial':'free')),'level'=>$level,'label'=>$level==='beacon'?'Beacon':($level==='signal'?'Signal':'Free'),'unlimited'=>$admin,'ends_at'=>$end?->toIso8601String(),'features'=>['custom_logo'=>$active,'custom_jerseys'=>$active,'themes'=>$active,'custom_theme'=>$level==='beacon','player_identity'=>$level==='beacon']];
 }
 public function requireCustomization(User $user):void {abort_unless($this->status($user)['active'],403,'Custom logos and jerseys require Supporter. New managers receive a one-month trial.');}
 public function requireFeature(User $user,string $feature):void {abort_unless($this->status($user)['features'][$feature]??false,403,in_array($feature,['custom_theme','player_identity'],true)?'This feature requires an active Beacon membership.':'This feature requires an active Signal or Beacon membership.');}
 public function plans():array {return [
  ['id'=>'signal','name'=>'Signal','benefits'=>['Custom club crest uploads','Custom home and away jersey artwork','Four curated interface themes','Signal supporter badge']],
  ['id'=>'beacon','name'=>'Beacon','benefits'=>['Everything in Signal','Personal theme builder and interface density','Player IGN changes: once per 30 days per player','Player biography and portrait style: once per 7 days per player','Beacon supporter badge']],
 ];}
}
