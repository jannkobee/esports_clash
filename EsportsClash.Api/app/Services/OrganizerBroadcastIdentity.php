<?php
namespace App\Services;

/** A stable broadcast identity belongs to the Hexapedia organizer, including generated organizers. */
class OrganizerBroadcastIdentity
{
    public static function profile(string $slug, string $name, mixed $branding = null): array
    {
        $branding = is_string($branding) ? json_decode($branding, true) : $branding;
        $seed = ['signal-circuit'=>0, 'harbor-stage'=>1, 'meridian-relay'=>2, 'patchline-studio'=>3][$slug] ?? hexdec(substr(hash('sha256', $slug), 0, 6));
        $layouts = ['arena', 'competition', 'spotlight'];
        $colors = ['#e89c58', '#6dd5c3', '#c2a2ef', '#d6dc78', '#86bce8', '#ed998e'];
        $identity = [
            'version' => 1, 'layout' => $layouts[$seed % 3],
            'accent' => $colors[$seed % count($colors)],
            'package' => $name.' Matchday',
            'intro' => ['signal-circuit'=>'THE VILLAGE TAKES THE STAGE','harbor-stage'=>'FROM THE QUAYS TO THE MAIN STAGE','meridian-relay'=>'THE WORLD MEETS HERE','patchline-studio'=>'THE NEXT PLAY IS YOURS'][$slug] ?? mb_strtoupper($name).' PRESENTS',
            'round' => ['signal-circuit'=>'ROUND SECURED','harbor-stage'=>'ROUND WON','meridian-relay'=>'MOMENT CLAIMED','patchline-studio'=>'ANOTHER PLAY ON THE BOARD'][$slug] ?? 'ROUND SECURED',
        ];
        $saved = is_array($branding) ? ($branding['broadcast'] ?? []) : [];
        if (!is_array($saved)) return $identity;
        foreach (['package', 'intro', 'round'] as $key) {
            if (is_string($saved[$key] ?? null) && trim($saved[$key]) !== '') $identity[$key] = mb_substr($saved[$key], 0, 100);
        }
        if (in_array($saved['layout'] ?? '', $layouts, true)) $identity['layout'] = $saved['layout'];
        if (is_string($saved['accent'] ?? null) && preg_match('/^#[0-9a-f]{6}$/i', $saved['accent'])) $identity['accent'] = $saved['accent'];
        return $identity;
    }
}
