<?php
namespace App\Services;

use Illuminate\Support\Facades\File;

class AvatarAssetPromptService
{
    public function defaults(array $avatar, array $weapons): array
    {
        $identity = $avatar['name'].' ('.($avatar['role'] ?? 'Hero').'). '
            .'Silhouette: '.($avatar['design']['silhouette'] ?? $avatar['motif'] ?? '').'. '
            .'Costume: '.($avatar['design']['costume'] ?? 'stylized fantasy clothing').'. '
            .'Skin: '.($avatar['design']['skin'] ?? '').'. Hair: '.($avatar['design']['hair'] ?? '').'. ';
        $body = 'Create a single full-body character reference image of '.$identity
            .'Front view, upright symmetrical neutral T-pose: arms straight out horizontally at shoulder height, palms down, open hands and separated fingers. '
            .'Straight legs shoulder-width apart, both feet visible and flat. Show the entire character with padding around the hands and feet. '
            .'Keep neck, shoulders, elbows, wrists, hips, knees and ankles readable; arrange hair and clothing so limbs do not overlap. '
            .'Stylized MOBA proportions, consistent materials, even studio lighting, transparent RGBA background. '
            .'No handheld equipment, weapons, shields, props, scenery, floor, text, particles, motion blur or action pose. Create equipment separately.';
        $result = ['body' => $body];
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

    public function prompts(array $avatar, array $weapons): array
    {
        $defaults = $this->defaults($avatar, $weapons);
        $path = storage_path('app/avatars/prompts/'.$avatar['id'].'.json');
        $saved = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        return ['defaults' => $defaults, 'values' => array_replace($defaults, array_intersect_key($saved ?? [], $defaults))];
    }

    public function save(string $avatar, array $prompts, string $actor): void
    {
        $dir = storage_path('app/avatars/prompts');
        File::ensureDirectoryExists($dir);
        File::replace($dir.'/'.$avatar.'.json', json_encode($prompts, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        app(EvolutionService::class)->audit($avatar, 'trellis.prompts-updated', $actor, []);
    }
}
