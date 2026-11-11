<?php

namespace App\Console\Commands;

use App\Models\{OnlineCatalog,OwnedPlayerCard};
use App\Services\{FpsIdentityEngine,FpsIdentityProfiles,WorldPlayerProfiles};
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FpsIdentityRelease extends Command
{
    protected $signature='fps:identity-release {action=status : status, prepare, enable or disable}';
    protected $description='Prepare persistent FPS identities or switch new allocations between v2 and v3';
    public function handle(): int
    {
        if(!app(FpsIdentityEngine::class)->ready()){$this->error('Run the additive identity migrations first.');return self::FAILURE;}
        $action=$this->argument('action');
        if($action==='prepare') {
            $catalogs=OnlineCatalog::all()->keyBy('id');
            OwnedPlayerCard::orderBy('id')->chunkById(100,function($players)use($catalogs){
                foreach($players as $player){
                    $catalog=$catalogs->get($player->catalog_id);
                    $template=collect($catalog?->payload['cards']??[])->firstWhere('id',$player->definition_id);
                    if($template)DB::transaction(fn()=>app(FpsIdentityProfiles::class)->initialize($player,app(WorldPlayerProfiles::class)->definition($player,$template)));
                }
            });
        } elseif(in_array($action,['enable','disable'],true)) {
            DB::table('fps_identity_settings')->where('id',1)->update(['enabled'=>$action==='enable']);
        } elseif($action!=='status'){$this->error('Unknown action.');return self::FAILURE;}
        $this->line(json_encode(['enabled'=>app(FpsIdentityEngine::class)->enabled(),'profiles'=>DB::table('fps_player_identities')->count(),'unmapped'=>DB::table('fps_player_identities')->whereNull('personality_id')->count(),'official_applications'=>DB::table('fps_identity_applications')->count()],JSON_THROW_ON_ERROR));
        return self::SUCCESS;
    }
}
