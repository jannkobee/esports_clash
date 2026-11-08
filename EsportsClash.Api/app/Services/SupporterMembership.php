<?php
namespace App\Services;
use App\Models\User;
use Carbon\CarbonImmutable;
class SupporterMembership {
 public function status(User $user):array {
  $trial=$user->supporter_trial_ends_at?CarbonImmutable::parse($user->supporter_trial_ends_at):null;
  $paid=$user->supporter_until?CarbonImmutable::parse($user->supporter_until):null;
  $admin=(bool)$user->is_evolution_admin;
  $active=$admin||$paid?->isFuture()||$trial?->isFuture();
  $end=$admin?null:collect([$trial,$paid])->filter()->sortByDesc(fn($d)=>$d->getTimestamp())->first();
  return ['active'=>$active,'kind'=>$admin?'supporter':($paid?->isFuture()?'supporter':($trial?->isFuture()?'trial':'free')),'ends_at'=>$end?->toIso8601String(),'features'=>['custom_logo'=>$active,'custom_jerseys'=>$active]];
 }
 public function requireCustomization(User $user):void {abort_unless($this->status($user)['active'],403,'Custom logos and jerseys require Supporter. New managers receive a one-month trial.');}
}
