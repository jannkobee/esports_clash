@extends('evolution.layout')
@section('title', 'Battlefield 3D Asset Studio')
@section('content')

<div class="page-heading studio-heading">
    <div>
        <p class="eyebrow">MOBA MAP &amp; ENVIRONMENT PIPELINE</p>
        <h1>Battlefield 3D Asset Studio</h1>
        <p class="muted">Generate game-ready 3D models for arena terrain, ambient wildlife, lane defensive towers, barracks, minions, and epic bosses via Google Colab TRELLIS.2.</p>
    </div>
    <div class="actions">
        <a class="button quiet" href="{{ route('trellis.index') }}">&larr; Champion Studio (45 Avatars)</a>
        <a class="button" href="{{ route('preparations.index') }}">Asset Preparation &rarr;</a>
    </div>
</div>

<div class="studio-stats">
    <div><strong>{{ $stats['total'] }}</strong><span>Total World Assets</span></div>
    <div><strong>{{ $stats['structures'] }}</strong><span>Towers &amp; Nexus</span></div>
    <div><strong>{{ $stats['environment'] }}</strong><span>Terrain &amp; Wildlife</span></div>
    <div><strong>{{ $stats['creeps'] }}</strong><span>Creeps &amp; Bosses</span></div>
    <div><strong>{{ $stats['has_ref'] }}/{{ $stats['total'] }}</strong><span>References Ready</span></div>
    <div><strong>{{ $stats['generated'] }}</strong><span>3D Models Ready</span></div>
    <div><strong>{{ $stats['queued'] }}</strong><span>Active Jobs</span></div>
    <div class="studio-worker">
        <span class="status-led {{ ($operations['models']['ready'] ?? false) ? 'green' : '' }}"></span>
        <span>
            {{ ($operations['models']['ready'] ?? false) ? (($operations['provider'] ?? null) === 'google-colab' ? 'Google TRELLIS.2 ready' : 'Local TRELLIS.2 ready') : 'TRELLIS.2 setup needed' }}
            <small>{{ $operations['hardware']['gpu'] ?? 'Google Colab T4 Connected' }}</small>
        </span>
    </div>
</div>

{{-- Interactive Tactical Battlefield Map Schematic --}}
<section class="panel" style="margin-bottom: 24px; padding: 20px;">
    <div class="section-heading" style="margin-bottom: 14px;">
        <div>
            <p class="eyebrow">TACTICAL ARENA SCHEMATIC &middot; 2600 &times; 1440</p>
            <h2>Battlefield Asset Distribution Map</h2>
            <p class="muted">Click any structure, camp, or environmental hotspot to jump directly to its 3D generation studio.</p>
        </div>
        <span class="badge good">Authoritative Coordinates Synced</span>
    </div>

    <div style="background: #070d14; border: 1px solid #1a2a3a; border-radius: 8px; padding: 16px; position: relative; overflow-x: auto;">
        <svg viewBox="0 0 1300 720" style="width: 100%; min-width: 700px; height: auto; display: block; border-radius: 4px;" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0b1622" />
                    <stop offset="50%" stop-color="#0f1f2e" />
                    <stop offset="100%" stop-color="#09131c" />
                </linearGradient>
                <linearGradient id="laneGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stop-color="#1e3a5f" />
                    <stop offset="40%" stop-color="#2d3748" />
                    <stop offset="60%" stop-color="#2d3748" />
                    <stop offset="100%" stop-color="#5a2228" />
                </linearGradient>
            </defs>

            <!-- Map Background & Canyon Basin -->
            <rect x="0" y="0" width="1300" height="720" fill="url(#bgGrad)" />
            <ellipse cx="650" cy="360" rx="600" ry="320" fill="#0d1b2a" stroke="#1c2f42" stroke-width="2" />
            <path d="M 650,60 Q 640,240 650,360 Q 660,480 650,660" stroke="#162b3d" stroke-width="64" fill="none" opacity="0.4" />

            <!-- Raised Causeway Lane -->
            <rect x="180" y="320" width="940" height="80" rx="8" fill="url(#laneGrad)" stroke="#3b4d61" stroke-width="2" />
            <line x1="180" y1="360" x2="1120" y2="360" stroke="#4a607a" stroke-dasharray="8 6" stroke-width="2" />

            <!-- River Bed Water -->
            <rect x="620" y="40" width="60" height="640" rx="30" fill="#133e54" opacity="0.3" />

            <!-- BLUE BASE SANCTUARY (Left) -->
            <g transform="translate(60, 260)">
                <rect x="0" y="0" width="140" height="200" rx="12" fill="#0a2540" stroke="#00a3ff" stroke-width="2" />
                <text x="70" y="24" fill="#60a5fa" font-size="11" font-weight="bold" text-anchor="middle">RADIANT SANCTUARY</text>
                <!-- Nexus Core -->
                <a href="{{ route('battlefield.show', 'struct_nexus_core_blue') }}">
                    <circle cx="50" cy="100" r="18" fill="#0284c7" stroke="#38bdf8" stroke-width="2" style="cursor:pointer;" />
                    <text x="50" y="104" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">NEXUS</text>
                </a>
                <!-- Barracks -->
                <a href="{{ route('battlefield.show', 'struct_barracks_melee') }}"><rect x="100" y="45" width="22" height="22" rx="4" fill="#0369a1" stroke="#38bdf8" style="cursor:pointer;" /><text x="111" y="60" fill="#fff" font-size="8" text-anchor="middle">M</text></a>
                <a href="{{ route('battlefield.show', 'struct_barracks_ranged') }}"><rect x="100" y="90" width="22" height="22" rx="4" fill="#0369a1" stroke="#38bdf8" style="cursor:pointer;" /><text x="111" y="105" fill="#fff" font-size="8" text-anchor="middle">R</text></a>
                <a href="{{ route('battlefield.show', 'struct_barracks_siege') }}"><rect x="100" y="135" width="22" height="22" rx="4" fill="#0369a1" stroke="#38bdf8" style="cursor:pointer;" /><text x="111" y="150" fill="#fff" font-size="8" text-anchor="middle">S</text></a>
            </g>

            <!-- RED BASE SANCTUARY (Right) -->
            <g transform="translate(1100, 260)">
                <rect x="0" y="0" width="140" height="200" rx="12" fill="#3b1117" stroke="#f43f5e" stroke-width="2" />
                <text x="70" y="24" fill="#fda4af" font-size="11" font-weight="bold" text-anchor="middle">DIRE CITADEL</text>
                <!-- Nexus Core -->
                <a href="{{ route('battlefield.show', 'struct_nexus_core_red') }}">
                    <circle cx="90" cy="100" r="18" fill="#e11d48" stroke="#fb7185" stroke-width="2" style="cursor:pointer;" />
                    <text x="90" y="104" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">NEXUS</text>
                </a>
                <!-- Barracks -->
                <a href="{{ route('battlefield.show', 'struct_barracks_melee') }}"><rect x="18" y="45" width="22" height="22" rx="4" fill="#be123c" stroke="#fb7185" style="cursor:pointer;" /><text x="29" y="60" fill="#fff" font-size="8" text-anchor="middle">M</text></a>
                <a href="{{ route('battlefield.show', 'struct_barracks_ranged') }}"><rect x="18" y="90" width="22" height="22" rx="4" fill="#be123c" stroke="#fb7185" style="cursor:pointer;" /><text x="29" y="105" fill="#fff" font-size="8" text-anchor="middle">R</text></a>
                <a href="{{ route('battlefield.show', 'struct_barracks_siege') }}"><rect x="18" y="135" width="22" height="22" rx="4" fill="#be123c" stroke="#fb7185" style="cursor:pointer;" /><text x="29" y="150" fill="#fff" font-size="8" text-anchor="middle">S</text></a>
            </g>

            <!-- LANE TOWERS (Scaled from 2600 to 1300 width) -->
            <!-- Blue Towers: Nexus (270), Inner (410), Outer (560) -->
            <a href="{{ route('battlefield.show', 'struct_turret_nexus') }}">
                <circle cx="270" cy="360" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="2" style="cursor:pointer;" />
                <text x="270" y="388" fill="#38bdf8" font-size="9" font-weight="bold" text-anchor="middle">Blue Nexus T</text>
            </a>
            <a href="{{ route('battlefield.show', 'struct_turret_inner') }}">
                <circle cx="410" cy="360" r="14" fill="#0369a1" stroke="#38bdf8" stroke-width="2" style="cursor:pointer;" />
                <text x="410" y="388" fill="#38bdf8" font-size="9" font-weight="bold" text-anchor="middle">Blue Inner T</text>
            </a>
            <a href="{{ route('battlefield.show', 'struct_turret_outer_blue') }}">
                <circle cx="560" cy="360" r="15" fill="#0284c7" stroke="#7dd3fc" stroke-width="3" style="cursor:pointer;" />
                <text x="560" y="390" fill="#7dd3fc" font-size="10" font-weight="bold" text-anchor="middle">Blue Outer T</text>
            </a>

            <!-- Red Towers: Outer (740), Inner (890), Nexus (1030) -->
            <a href="{{ route('battlefield.show', 'struct_turret_outer_red') }}">
                <circle cx="740" cy="360" r="15" fill="#e11d48" stroke="#fca5a5" stroke-width="3" style="cursor:pointer;" />
                <text x="740" y="390" fill="#fca5a5" font-size="10" font-weight="bold" text-anchor="middle">Red Outer T</text>
            </a>
            <a href="{{ route('battlefield.show', 'struct_turret_inner') }}">
                <circle cx="890" cy="360" r="14" fill="#be123c" stroke="#fb7185" stroke-width="2" style="cursor:pointer;" />
                <text x="890" y="388" fill="#fb7185" font-size="9" font-weight="bold" text-anchor="middle">Red Inner T</text>
            </a>
            <a href="{{ route('battlefield.show', 'struct_turret_nexus') }}">
                <circle cx="1030" cy="360" r="14" fill="#be123c" stroke="#fb7185" stroke-width="2" style="cursor:pointer;" />
                <text x="1030" y="388" fill="#fb7185" font-size="9" font-weight="bold" text-anchor="middle">Red Nexus T</text>
            </a>

            <!-- BOSS PITS & JUNGLE HOTSPOTS -->
            <!-- North Jungle: Dragon Embermaw Pit -->
            <a href="{{ route('battlefield.show', 'creep_boss_embermaw') }}">
                <ellipse cx="650" cy="180" rx="46" ry="34" fill="#4c0519" stroke="#f43f5e" stroke-width="2" style="cursor:pointer;" />
                <circle cx="650" cy="180" r="14" fill="#e11d48" />
                <text x="650" y="184" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">🐉 EMBERMAW</text>
            </a>

            <!-- South Jungle: Siege Golem Gravemarch Pit -->
            <a href="{{ route('battlefield.show', 'creep_boss_gravemarch') }}">
                <ellipse cx="650" cy="540" rx="46" ry="34" fill="#1e293b" stroke="#38bdf8" stroke-width="2" style="cursor:pointer;" />
                <circle cx="650" cy="540" r="14" fill="#0284c7" />
                <text x="650" y="544" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle">🗿 GOLEM</text>
            </a>

            <!-- River Critters Hotspots -->
            <!-- River Amber Frog -->
            <a href="{{ route('battlefield.show', 'env_critter_river_frog') }}">
                <circle cx="650" cy="315" r="12" fill="#15803d" stroke="#4ade80" stroke-width="2" style="cursor:pointer;" />
                <text x="650" y="319" fill="#fff" font-size="8" font-weight="bold" text-anchor="middle">🐸</text>
                <text x="650" y="300" fill="#4ade80" font-size="8" font-weight="bold" text-anchor="middle">River Frog</text>
            </a>
            <!-- River Dragonfly -->
            <a href="{{ route('battlefield.show', 'env_critter_dragonfly') }}">
                <circle cx="668" cy="405" r="10" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" style="cursor:pointer;" />
                <text x="668" y="408" fill="#fff" font-size="7" text-anchor="middle">🪰</text>
            </a>
            <!-- Pebble Crab -->
            <a href="{{ route('battlefield.show', 'env_critter_scuttle_crab') }}">
                <circle cx="632" cy="405" r="10" fill="#b45309" stroke="#f59e0b" stroke-width="1.5" style="cursor:pointer;" />
                <text x="632" y="408" fill="#fff" font-size="7" text-anchor="middle">🦀</text>
            </a>

            <!-- Jungle Camps -->
            <!-- Brambleback (Northwest) -->
            <a href="{{ route('battlefield.show', 'creep_neutral_brambleback') }}">
                <circle cx="430" cy="180" r="16" fill="#713f12" stroke="#eab308" stroke-width="2" style="cursor:pointer;" />
                <text x="430" y="184" fill="#fff" font-size="8" font-weight="bold" text-anchor="middle">🐗 RED</text>
            </a>
            <!-- Sentinel (Southeast) -->
            <a href="{{ route('battlefield.show', 'creep_neutral_sentinel') }}">
                <circle cx="870" cy="540" r="16" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2" style="cursor:pointer;" />
                <text x="870" y="544" fill="#fff" font-size="8" font-weight="bold" text-anchor="middle">💎 BLUE</text>
            </a>

            <!-- Environment Trees & Rocks -->
            <a href="{{ route('battlefield.show', 'env_tree_canopy_oak') }}"><text x="320" y="140" font-size="14" style="cursor:pointer;">🌳</text></a>
            <a href="{{ route('battlefield.show', 'env_tree_ancient_pine') }}"><text x="960" y="140" font-size="14" style="cursor:pointer;">🌲</text></a>
            <a href="{{ route('battlefield.show', 'env_rock_river_boulder') }}"><text x="615" y="270" font-size="12" style="cursor:pointer;">🪨</text></a>
            <a href="{{ route('battlefield.show', 'env_rock_canyon_cliff') }}"><text x="675" y="460" font-size="12" style="cursor:pointer;">⛰️</text></a>
            <a href="{{ route('battlefield.show', 'env_bush_river_stealth') }}"><text x="600" y="360" font-size="12" style="cursor:pointer;">🌾</text></a>
            <a href="{{ route('battlefield.show', 'env_bush_river_stealth') }}"><text x="700" y="360" font-size="12" style="cursor:pointer;">🌾</text></a>
        </svg>
    </div>
</section>

{{-- 3 MOBA Asset Suites --}}
@foreach($groups as $groupKey => $group)
<section class="panel" id="{{ $groupKey }}" style="margin-bottom: 28px;">
    <div class="section-heading">
        <div>
            <p class="eyebrow">{{ strtoupper($groupKey) }} SUITE &middot; {{ count($group['assets']) }} ASSETS</p>
            <h2>{{ $group['icon'] }} {{ $group['title'] }}</h2>
            <p class="muted">{{ $group['description'] }}</p>
        </div>
        <span class="badge">{{ count($group['assets']) }} Models</span>
    </div>

    <div class="generation-roster studio-roster" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        @foreach($group['assets'] as $asset)
            @php
                $ref = $references[$asset['id']] ?? null;
                $hasModel = $completedModels->has($asset['id']);
                $isPending = $activeRuns->firstWhere('avatar_id', $asset['id']);
                $statusKey = $isPending ? 'queued' : ($hasModel ? 'generated' : ($ref ? 'has_ref' : 'needs_ref'));
                $statusBadge = match($statusKey) {
                    'queued' => 'In progress',
                    'generated' => '3D model ready',
                    'has_ref' => 'Reference ready',
                    default => 'Needs reference'
                };
                $cardUrl = route('battlefield.show', $asset['id']);
                $icon = $asset['icon'] ?? '📦';
            @endphp
            <article class="panel generation-card studio-avatar-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <a class="studio-avatar-art" href="{{ $cardUrl }}" aria-label="Inspect {{ $asset['name'] }}" style="height: 180px; display:flex; align-items:center; justify-content:center; background:#0b131e; border-bottom:1px solid #1c2738;">
                        @if($ref)
                            <img loading="lazy" src="{{ route('trellis.reference', [$asset['id'], $ref['sha256']]) }}" alt="{{ $asset['name'] }} reference" style="max-height: 160px; object-fit: contain;">
                        @else
                            <div class="asset-placeholder">
                                <span aria-hidden="true" style="font-size:32px;">{{ $icon }}</span>
                                <strong>Reference needed</strong>
                            </div>
                        @endif
                        <span class="badge {{ $hasModel ? 'good' : '' }}" style="position:absolute; bottom:8px; right:8px;">{{ $icon }} {{ $asset['role'] }}</span>
                    </a>
                    <div style="padding: 12px 14px 6px;">
                        <div class="run-title" style="margin-bottom: 6px;">
                            <h3 style="font-size: 15px; margin:0;"><a href="{{ $cardUrl }}">{{ $asset['name'] }}</a></h3>
                            <span class="studio-state state-{{ $statusKey }}">{{ $statusBadge }}</span>
                        </div>
                        <p class="generation-identity" style="font-size:12px; margin-bottom: 4px;">{{ $asset['silhouette'] ?? '' }}</p>
                        <p class="studio-costume" style="font-size:11px; color:#8ba0b5;">{{ $asset['description'] ?? '' }}</p>
                    </div>
                </div>
                <div style="padding: 0 14px 14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:10px; color:#627d98;">
                        <span><strong>Subcategory:</strong> {{ ucfirst($asset['subcategory'] ?? 'Prop') }}</span>
                        @if($hasModel)
                            <span style="color:#22c55e;">&#x2713; GLB Baked</span>
                        @endif
                    </div>
                    <a class="button studio-open" href="{{ $cardUrl }}" style="width:100%; text-align:center;">Open Asset Studio &rarr;</a>
                </div>
            </article>
        @endforeach
    </div>
</section>
@endforeach

@endsection

