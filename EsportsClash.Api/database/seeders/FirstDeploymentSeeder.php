<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
class FirstDeploymentSeeder extends Seeder {
 public function run():void {
  $email=(string)config('game_bootstrap.owner_email');$password=(string)config('game_bootstrap.owner_password');
  app(\App\Services\GameInitialization::class)->run($email,$password);
 }
}
