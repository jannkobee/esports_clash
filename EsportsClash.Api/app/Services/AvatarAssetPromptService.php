<?php
namespace App\Services;

use Illuminate\Support\Facades\File;

class AvatarAssetPromptService
{
    private const BODY_CONTRACT = 'base-first-a-pose-v1';
    public function defaults(array $avatar, array $weapons): array
    {
        if (($avatar['category'] ?? 'avatar') !== 'avatar') {
            return $this->worldAssetDefaults($avatar);
        }

        $identity = $avatar['name'].' ('.($avatar['role'] ?? 'Hero').'). '
            .'Silhouette: '.($avatar['design']['silhouette'] ?? $avatar['motif'] ?? '').'. '
            .'Costume: '.($avatar['design']['costume'] ?? 'stylized fantasy clothing').'. '
            .'Skin: '.($avatar['design']['skin'] ?? '').'. Hair: '.($avatar['design']['hair'] ?? '').'. ';
        $anatomy = $this->anatomy($avatar['id']);
        $pose = ($anatomy['pose'] ?? 'biped') === 'biped'
            ? 'Strict wide dynamic A-pose used as a symmetrical static rest pose: straight arms angled 45 degrees down and outward from the vertical torso, palms facing down, open hands and separated fingers. Clear air gaps between each arm, underarm and torso. Straight legs slightly apart, feet flat and fully visible. '
            : $anatomy['rest_pose'].' Do not invent human limbs or force a humanoid A-pose onto this anatomy. ';
        $body = 'Create a single full-body 3D base-mesh reference. '
            .'Anatomy only: '.$anatomy['description'].'. '.$pose
            .'Front view, neutral expression, symmetrical silhouette, clean readable surfaces suitable for rigging. '
            .'Neutral matte light-gray anatomical mannequin with a smooth modesty layer and no sexual anatomical detail. '
            .'Keep all real joints, appendage roots and spaces between limbs visible. Preserve the required body proportions, species, tails and wings. '
            .'Bald or undecorated head; no outfit, armor, loose clothing, cape, scarf, boots, hairstyle, jewelry, accessories, weapons or props. '
            .'Defer cosmetic character identity, costume, hair and detailed material textures until after rig validation. '
            .'Whole body and every anatomical appendage in frame with generous padding, even studio lighting, transparent RGBA background. '
            .'No scenery, floor, labels, particles, motion blur or action stance. '.($anatomy['component_note'] ?? '');
        $outfit = 'Create a post-rig outfit and appearance design reference for '.$identity
            .'Design context: '.($avatar['design']['signature'] ?? '').'. '
            .'Use the validated base mesh and its rest pose as the fitting reference. Preserve its anatomy, proportions, joints and bind pose. '
            .'Design clothing, armor, hairstyle, facial styling, colors and detailed material textures as a later appearance stage. '
            .'Keep garments, hair and accessories as separate fit-ready parts with readable silhouettes and clear underarm space. '
            .'Front view, full body, even studio lighting, transparent RGBA background. Handheld equipment is designed separately. '
            .'This is a design reference: fitted clothing still needs skin weights and posed deformation checks before release. '
            .($anatomy['component_note'] ?? '');
        $result = ['body' => $body, 'outfit' => $outfit];
        foreach (['primary' => 'right', 'secondary' => 'left'] as $slot => $hand) {
            $type = $weapons[$slot]['weapon_type'] ?? 'none';
            $result[$slot] = 'Create a single isolated '.(in_array($type,['none','generic'],true) ? 'equipment item' : str_replace('_', ' ', $type))
                .' reference image for the '.$hand.' hand of '.$identity
                .'Design context: '.($avatar['design']['signature'] ?? '').'. Render only the selected item, matching the character palette and costume materials. '
                .'Show its complete silhouette and an unobstructed grip at the center of the image. Even studio lighting, transparent RGBA background. '
                .'No character, hands, fingers, body parts, duplicate items, labels, scenery, particles or cast shadow. '
                .'For a 3D export, place the grip or attachment center at world origin (0, 0, 0); target '.$hand.'_hand_socket. '
                .'A PNG is a design reference only; it does not create or attach a 3D weapon.';
        }
        return $result;
    }

    private function worldAssetDefaults(array $asset): array
    {
        $category = $asset['category'] ?? 'environment';
        $subcategory = $asset['subcategory'] ?? 'prop';
        $name = $asset['name'] ?? 'World Asset';
        $role = $asset['role'] ?? 'Environment Prop';
        $desc = $asset['description'] ?? ($asset['silhouette'] ?? 'Arena asset');
        $costume = $asset['costume'] ?? 'Stylized hand-painted 3D game model';
        $basePrompt = $asset['prompt'] ?? "A stylized fantasy 3D game asset for {$name}.";

        $isStatic = in_array($category, ['environment', 'structure'], true) && !in_array($subcategory, ['critter'], true);
        $isCritterOrCreep = in_array($category, ['creep'], true) || in_array($subcategory, ['critter', 'boss', 'jungle', 'minion'], true);

        if ($isStatic) {
            $pipelineGuidance = "Static unrigged 3D architectural/environment mesh for Trellis glTF generation. Rigid geometry, no skeletal bones or skin weights required. Clean flat ground contact base, hand-painted stylized Blizzard/Valve fantasy aesthetic, isolated on transparent background.";
        } else {
            $pipelineGuidance = "Animated creature model designed for skeletal rigging and animation. Symmetrical rest pose with clear joint clearance between limbs and torso, flat feet, ready for bone weight binding and clips (idle, run, attack, hit, death). Clean stylized silhouette, isolated on transparent background.";
        }

        $bodyPrompt = "{$basePrompt} {$pipelineGuidance}";
        $outfitPrompt = "Material and surface texturing for {$name} ({$role}). Style: {$costume}. Hand-painted stylized fantasy PBR shaders, crisp ambient occlusion, baked normal crevices, optimized for Babylon.js arena rendering.";

        return [
            'body' => $bodyPrompt,
            'outfit' => $outfitPrompt,
            'primary' => "Isolated isometric detail reference for {$name}.",
            'secondary' => "Alternative faction palette or seasonal weathering variant for {$name}."
        ];
    }

    private function anatomy(string $id): array
    {
        $path = resource_path('avatars/base-anatomy.json');
        if (!is_file($path)) throw new \RuntimeException('The reviewed base-anatomy manifest is unavailable.');
        $entries = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        if (empty($entries[$id]['description'])) throw new \RuntimeException('No reviewed base anatomy exists for '.$id.'.');
        return $entries[$id];
    }

    public function prompts(array $avatar, array $weapons): array
    {
        $defaults = $this->defaults($avatar, $weapons);
        $path = storage_path('app/avatars/prompts/'.$avatar['id'].'.json');
        $saved = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        $saved = is_array($saved) ? $saved : [];
        $overrides = array_intersect_key($saved, $defaults);
        $legacyBody = $saved['_legacy_body'] ?? null;
        if (isset($saved['body']) && ($saved['_body_contract'] ?? null) !== self::BODY_CONTRACT) {
            $legacyBody = $saved['body'];
            unset($overrides['body']);
        }
        return ['defaults' => $defaults, 'values' => array_replace($defaults, $overrides), 'legacy_body' => $legacyBody];
    }

    public function save(string $avatar, array $prompts, string $actor): void
    {
        $dir = storage_path('app/avatars/prompts');
        File::ensureDirectoryExists($dir);
        $path = $dir.'/'.$avatar.'.json';
        $saved = is_file($path) ? json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR) : [];
        if (isset($saved['body']) && ($saved['_body_contract'] ?? null) !== self::BODY_CONTRACT) $saved['_legacy_body'] = $saved['body'];
        // Older three-field clients keep any separately saved outfit brief.
        $saved = array_replace($saved, $prompts, ['_body_contract' => self::BODY_CONTRACT]);
        File::replace($path, json_encode($saved, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        app(EvolutionService::class)->audit($avatar, 'trellis.prompts-updated', $actor, []);
    }
}
