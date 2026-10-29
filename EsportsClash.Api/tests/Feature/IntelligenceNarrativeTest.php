<?php
namespace Tests\Feature;
use App\Models\EvolutionRun;
use App\Services\IntelligenceNarrative;
use Tests\TestCase;

class IntelligenceNarrativeTest extends TestCase {
    private function story(array $values):array {
        return app(IntelligenceNarrative::class)->describe(new EvolutionRun($values));
    }
    public function test_avatar_guide_is_bound_to_exact_frozen_version_and_hash():void {
        foreach([3,4,5,6] as $version){
            $path=resource_path('game/arena-playbook-v'.$version.'.json');
            $plan=['domain'=>'arena','teaching'=>['version'=>$version,'playbook_sha256'=>hash_file('sha256',$path)]];
            $story=$this->story(['status'=>'running','plan'=>$plan]);$this->assertSame($version,$story['playbook']['version']);
            if($version===4)$this->assertCount(45,$story['playbook']['avatars']);
            $plan['teaching']['playbook_sha256']=str_repeat('0',64);
            $this->assertSame([],$this->story(['status'=>'running','plan'=>$plan])['playbook']);
        }
    }
    public function test_running_and_failed_studies_do_not_invent_improvement():void {
        $s=$this->story(['status'=>'running','plan'=>['domain'=>'arena'],'progress'=>['stage'=>'self-play','generation'=>0]]);
        $this->assertStringContainsString('No independent improvement',$s['verdict']);
        $this->assertStringContainsString('actual matches',$s['stage']);
        $this->assertSame([],$s['training']);
        $s=$this->story(['status'=>'failed','plan'=>['domain'=>'arena']]);
        $this->assertStringContainsString('not evidence that gameplay improved',$s['verdict']);
        $this->assertStringContainsString('stopped on an error',$s['stage']);
        $s=$this->story(['status'=>'cancelled','plan'=>['domain'=>'arena']]);
        $this->assertStringContainsString('no additional matches',$s['stage']);
    }
    public function test_measured_changes_uncertainty_and_training_are_explained_separately():void {
        $s=$this->story(['status'=>'completed','plan'=>['domain'=>'arena'],'result'=>[
            'assessment'=>['status'=>'inconclusive','independentSeeds'=>32,'winDelta'=>['estimate'=>.1,'lower'=>-.2,'upper'=>.4],'reasons'=>['improvement-not-established']],
            'outcomes'=>['terminal_pairs'=>64,'control_wins'=>30,'challenger_wins'=>36,'averages'=>['deaths'=>['control'=>10,'candidate'=>8,'delta'=>-2]]],
            'behavior'=>['controllerDecisions'=>1000,'intents_recorded'=>800],
            'training'=>[['updated'=>true,'transitions'=>250,'actor_loss'=>.01]]]]);
        $text=implode(' ',$s['findings']);$this->assertStringContainsString('46.9%',$text);
        $this->assertStringContainsString('+10.00 percentage points',$text);$this->assertStringContainsString('team deaths: 10.0',$text);
        $this->assertStringContainsString('800 commands actually started',$text);
        $this->assertStringContainsString('includes no improvement',implode(' ',$s['limits']));
        $this->assertArrayNotHasKey('value_loss',$s['training'][0]);
    }
}
