"""Character-specific donor adaptation; pure metadata/math, no Blender import.

Weapon mass is an explicit authored property, or an identified heuristic. No
class name or IQ changes animation legality, combat speed, or hit timing.
"""
import math

TEMPLATES = {
    'donor_native': {'gain': 1.0, 'coil': 0., 'reach': 0.},
    'heavy_overhead': {'gain': .92, 'coil': 5., 'reach': -3.},
    'staff_sweep': {'gain': .96, 'coil': 7., 'reach': -2.},
    'short_blade': {'gain': .92, 'coil': -3., 'reach': 3.},
    'sword_and_shield': {'gain': .94, 'coil': 2., 'reach': -2.},
    'ranged_release': {'gain': 1.0, 'coil': 0., 'reach': 0.},
}

WEAPON_ALIASES = {'one_handed_sword': 'sword', 'dual_daggers': 'dual_blade', 'two_handed': 'heavy_weapon'}


def bounded_number(value, default, low, high):
    return max(low, min(high, value)) if isinstance(value, (int, float)) and math.isfinite(value) else default


def select_motion_profile(equipment, proportions=None, combat_style=None):
    proportions = proportions or {}
    primary = next((item for item in equipment if item.get('slot') == 'primary'), {})
    types = {WEAPON_ALIASES.get(item.get('weapon_type'), item.get('weapon_type')) for item in equipment}
    source_weapon = primary.get('weapon_type', 'unknown')
    weapon = WEAPON_ALIASES.get(source_weapon, source_weapon)
    length = bounded_number(primary.get('height_cm'), 100, 5, 300)
    authored_mass = primary.get('mass_kg')
    defaults = {'dagger': .6, 'dual_blade': .6, 'sword': 1.5, 'staff': 2., 'hammer': 8., 'heavy_weapon': 6., 'axe': 4., 'bow': 1.5, 'shield': 5.}
    mass = bounded_number(authored_mass, defaults.get(weapon, 1.5), .1, 30)
    arm_ratio = bounded_number(proportions.get('arm_to_height'), .32, .15, .6)
    shoulder_ratio = bounded_number(proportions.get('shoulder_to_height'), .22, .1, .5)
    template = 'donor_native'
    if weapon in {'bow', 'crossbow', 'gun', 'cannon', 'rifle'}:
        template = 'ranged_release'
    elif weapon in {'staff', 'spear', 'polearm'}:
        template = 'staff_sweep'
    elif mass >= 4 or weapon in {'hammer', 'axe'}:
        template = 'heavy_overhead'
    elif weapon in {'dagger', 'knife', 'dual_blade'}:
        template = 'short_blade'
    elif 'shield' in types and weapon == 'sword':
        template = 'sword_and_shield'
    settings = TEMPLATES[template]
    # Keep the character's authored donor motion and adapt it conservatively.
    # Long limbs reduce extension rather than making a long-armed unit swing faster.
    reach_factor = max(.85, min(1.05, .32 / arm_ratio))
    inertia = max(.9, min(1.05, (100 / length) ** .1 * (1.5 / mass) ** .05))
    gain = 1 if template in {'donor_native', 'ranged_release'} else min(1., settings['gain'] * reach_factor * inertia)
    return {'version': 'character-motion-v1', 'template': template,
            'weapon': weapon, 'source_weapon_type': source_weapon, 'weapon_length_cm': length, 'weapon_mass_kg': mass,
            'mass_source': 'authored' if authored_mass is not None else 'weapon_type_heuristic',
            'arm_to_height': arm_ratio, 'shoulder_to_height': shoulder_ratio,
            'combat_style': combat_style or 'preserve_character_donor',
            'amplitude_gain': gain, 'coil_degrees': settings['coil'] * max(.85,min(1.15,.22/shoulder_ratio)), 'reach_degrees': settings['reach'],
            'timing': 'source_clip_unchanged', 'anatomy': 'humanoid_only'}


def attack_adjustment(profile, phase, joint):
    """An additive donor-space pose envelope, zero at both clip boundaries."""
    if profile['template'] in {'donor_native', 'ranged_release'}:
        return 1., (0., 0., 0.)
    phase = max(0., min(1., phase))
    envelope = math.sin(math.pi * phase) ** 2 if 0 < phase < 1 else 0.
    angle = lambda degrees: math.radians(degrees) * envelope
    if joint == 'Chest':
        return profile['amplitude_gain'], (0., 0., angle(profile['coil_degrees']))
    if joint == 'UpperArmR':
        return profile['amplitude_gain'], (angle(profile['reach_degrees']), 0., 0.)
    if joint in {'UpperArmL', 'ForearmL', 'ForearmR', 'HandL', 'HandR'}:
        return profile['amplitude_gain'], (0., 0., 0.)
    return 1., (0., 0., 0.)


def combat_events(release_phase=.42):
    return [{'event': name, 'phase': phase, 'authority': 'presentation_metadata'} for name, phase in [
        ('anticipation_start', 0.), ('windup_start', .15), ('attack_release', release_phase),
        ('hit_frame', release_phase), ('follow_through_start', min(.8, release_phase + .04)),
        ('recovery_start', .72), ('animation_complete', 1.)]]
