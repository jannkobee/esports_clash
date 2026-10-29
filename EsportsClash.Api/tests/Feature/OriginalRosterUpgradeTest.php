<?php
namespace Tests\Feature;
use App\Services\OriginalRosterUpgrade;
use Tests\TestCase;

class OriginalRosterUpgradeTest extends TestCase {
    private function catalogs():array {
        $next=json_decode(file_get_contents(resource_path('game/catalog.json')),true,flags:JSON_THROW_ON_ERROR);
        foreach($next['avatars'] as &$kit)$kit['abilityRuleset']='original-v3-preview-2';unset($kit);
        $previous=$next;foreach($previous['avatars'] as &$kit){unset($kit['abilityRuleset']);$kit['skill1']['name']='Retired historical skill';}unset($kit);
        return [$previous,$next];
    }
    public function test_kit_replacement_preserves_all_ownership_and_base_fields():void {
        [$previous,$next]=$this->catalogs();OriginalRosterUpgrade::validate($previous,$next);$this->assertCount(45,$next['avatars']);
    }
    public function test_review_rejects_player_card_definition_changes():void {
        [$previous,$next]=$this->catalogs();$next['cards'][0]['name']='Different card';
        $this->expectException(\RuntimeException::class);OriginalRosterUpgrade::validate($previous,$next);
    }
    public function test_review_rejects_avatar_id_or_stat_changes():void {
        [$previous,$next]=$this->catalogs();$next['avatars'][0]['hp']++;
        $this->expectException(\RuntimeException::class);OriginalRosterUpgrade::validate($previous,$next);
    }
}
