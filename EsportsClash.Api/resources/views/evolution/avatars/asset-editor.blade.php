@php
    $assetPrompts = app(\App\Services\AvatarAssetPromptService::class)->prompts($avatar, $weapon ?? []);
    $briefImported = false;
    if ($selectedDesign ?? null) {
        $context = ' Saved design context: '.($selectedDesign->payload['designBrief']['appearancePrompt']??'').'. For the body, preserve outfit and identity while keeping the T-pose and empty-hand requirements above.';
        foreach (['body','primary','secondary'] as $key) {
            $assetPrompts['defaults'][$key] .= $context;
            if (!str_contains($assetPrompts['values'][$key], $context)) {
                $assetPrompts['values'][$key] .= $context;
                $briefImported = true;
            }
        }
    }
    $weaponTypes = ['generic'=>'Other equipment', 'one_handed_sword'=>'Sword', 'dual_daggers'=>'Dagger / twin blade', 'staff'=>'Staff / wand', 'bow'=>'Bow / crossbow', 'two_handed'=>'Two-handed heavy', 'gun'=>'Gun / firearm', 'shield'=>'Shield', 'orb'=>'Orb / focus'];
@endphp
<section class="panel asset-workspace" id="assets">
    <div class="section-heading">
        <div><p class="eyebrow">01 / SOURCE ASSETS</p><h2>Build your avatar</h2><p class="muted">One body reference is required. Equipment for either hand is optional.</p></div>
        <a class="button quiet" href="#asset-prompts">Write &amp; copy prompts &darr;</a>
    </div>
    <div class="asset-editor-grid">
        <article class="asset-editor-card">
            <div class="section-heading"><h3>T-pose body</h3><span class="badge {{ $currentReference && empty($currentReference['is_legacy']) ? 'good' : 'warning' }}">{{ !empty($currentReference['is_legacy']) ? 'Legacy concept' : ($currentReference ? 'Uploaded' : 'Required') }}</span></div>
            <div class="asset-preview checkerboard" data-preview="body">
                @if($currentReference)<img src="{{ $currentReference['url'] }}" alt="{{ $avatar['name'] }} current body reference">
                @else<div class="asset-placeholder"><span aria-hidden="true">T</span><strong>Add a body reference</strong><p>Front view, arms horizontal,<br>open hands, separated legs.</p></div>@endif
            </div>
            <p class="asset-description">{{ !empty($currentReference['is_legacy']) ? 'This older concept uses a posed or equipped design. Replace it with a clean T-pose body before generating.' : 'Transparent full-body T-pose PNG. Keep hands empty and joints visible.' }}</p>
            <form method="post" enctype="multipart/form-data" action="{{ route('trellis.upload') }}" data-asset-upload="body" data-no-ajax>
                @csrf<input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}"><input type="hidden" name="prompt" value="{{ $assetPrompts['values']['body'] }}">
                <label class="asset-file-label">{{ $currentReference ? 'Replace body reference' : 'Choose body reference' }}<input type="file" name="reference" accept="image/png" data-max-mib="12" required></label>
                <p class="fine file-feedback" role="status">PNG &middot; up to 12 MiB. Uploads also work while the worker is offline.</p>
                <button class="primary asset-save" type="submit">{{ $currentReference ? 'Replace body' : 'Upload body' }}</button>
            </form>
            @if($currentReference)
                <div class="asset-meta"><a href="{{ $currentReference['url'] }}" target="_blank" rel="noopener">Open original &nearr;</a><span title="{{ $currentReference['sha256'] }}">SHA {{ substr($currentReference['sha256'],0,10) }}</span></div>
                <form method="post" action="{{ route('trellis.destroy-reference',$avatar['id']) }}" data-confirm="Remove the active body reference? Old generation inputs are retained. You will need to upload a body before generating again." data-no-ajax>
                    @csrf @method('DELETE')<input type="hidden" name="confirm_delete" value="1"><button class="asset-remove" type="submit">Remove body reference</button>
                </form>
            @endif
        </article>
        @foreach(['primary'=>'Right hand', 'secondary'=>'Left hand'] as $slot=>$hand)
            @php
                $equipment=$weapon[$slot]??[];
                $hasAsset=!empty($equipment['has_custom_asset']);
                $filename=$equipment['filename']??'';
                $isImage=str_ends_with($filename,'.png');
                $type=$equipment['weapon_type']??'none';
                $assetUrl=route('trellis.weapon',[$avatar['id'],$slot]);
                $heightCm=(float)($equipment['height_cm']??(($type==='shield')?90:120));
                $slotRuns=($equipmentRuns[$slot]??collect())->sortBy('created_at')->values();
                $pendingRun=$slotRuns->first(fn($r)=>in_array($r->status,[...\App\Services\TrellisGenerationService::ACTIVE,'installing']));
                $latestRun=$slotRuns->last();
                $hasPngRef=($hasAsset && $isImage) || !empty($equipment['reference_sha256']);
                $workerConnected=($operations['provider']??null)==='trellis2-gguf' && ($operations['equipment']['supported']??false);
            @endphp
            <article class="asset-editor-card">
                <div class="section-heading"><h3>{{ $hand }}</h3><span class="badge {{ $hasAsset ? 'good' : '' }}">{{ $hasAsset ? ($isImage ? 'PNG reference' : '3D file') : 'Optional' }}</span></div>
                <div class="asset-preview {{ $isImage ? 'checkerboard' : '' }}" data-preview="{{ $slot }}">
                    @if($hasAsset && $isImage)<img src="{{ $assetUrl }}?v={{ $equipment['sha256'] }}" alt="{{ $avatar['name'] }} {{ strtolower($hand) }} equipment reference">
                    @else<div class="asset-placeholder"><span aria-hidden="true">{{ $hasAsset ? '3D' : '+' }}</span><strong>{{ $hasAsset ? $filename : 'No custom equipment' }}</strong><p>{{ $hasAsset ? 'Download the model to inspect it.' : 'Uses default equipment or an unarmed hand.' }}</p></div>@endif
                </div>
                <p class="asset-description">{{ $hasAsset && $isImage ? 'Design reference saved. Generate a 3D mesh from it below before preparing your avatar.' : 'A 3D equipment file is fitted to this hand during preparation. Keep weapons out of the body image.' }}</p>
                <form method="post" enctype="multipart/form-data" action="{{ route('trellis.upload-weapon') }}" data-asset-upload="{{ $slot }}" data-no-ajax>
                    @csrf<input type="hidden" name="avatar_id" value="{{ $avatar['id'] }}"><input type="hidden" name="weapon_slot" value="{{ $slot }}"><input type="hidden" name="socket_name" value="{{ $slot==='primary' ? 'right_hand_socket' : 'left_hand_socket' }}">
                    <details class="equipment-settings"><summary>Optional equipment settings &amp; physical scale</summary>
                        <p class="fine">The hand determines socket attachment. The physical scale calibrates against a standardized 180 cm humanoid stature.</p>
                        <label>Equipment label<select name="weapon_type" data-prompt-slot="{{ $slot }}"><option value="">Use avatar default{{ isset($weaponTypes[$type]) ? ' ('.$weaponTypes[$type].')' : '' }}</option>@foreach($weaponTypes as $value=>$label)<option value="{{ $value }}" @selected($hasAsset && $type===$value)>{{ $label }}</option>@endforeach</select></label>
                        <label>Equipment length / height (cm)<input type="number" name="height_cm" min="5" max="300" step="1" value="{{ old('height_cm', $heightCm) }}"></label>
                        <p class="fine">Standard humanoid avatar calibration: 180 cm. Equipment is scaled relative to character stature during rigging.</p>
                    </details>
                    <label class="asset-file-label">{{ $hasAsset ? 'Replace file (optional)' : 'Choose equipment file' }}<input type="file" name="weapon_file" accept="image/png,.glb,.gltf" data-max-mib="20" @required(!$hasAsset)></label>
                    <p class="fine file-feedback" role="status">PNG, GLB or self-contained glTF &middot; up to 20 MiB.</p>
                    <button class="asset-save" type="submit">{{ $hasAsset ? 'Save '.$hand.' changes' : 'Upload '.$hand.' equipment' }}</button>
                </form>
                @if($hasPngRef)
                    <div class="equipment-generation-panel">
                        @if($pendingRun)
                            <div class="equipment-run-notice in-progress" role="status">
                                <span class="status-led amber"></span>
                                <div><strong>3D generation in progress ({{ ucfirst($pendingRun->status) }})</strong><p class="fine">Seed {{ $pendingRun->plan['seed'] ?? '?' }} &middot; Polling worker...</p></div>
                            </div>
                        @else
                            <form method="post" action="{{ route('trellis.generate-weapon', [$avatar['id'], $slot]) }}" class="equipment-generate-action" data-no-ajax>
                                @csrf
                                <button type="submit" class="button primary" @disabled(!$workerConnected)>{{ $isImage ? 'Generate 3D mesh from PNG' : 'Regenerate 3D mesh from reference' }} &rarr;</button>
                            </form>
                            @if(!$workerConnected)<p class="fine generation-blocker">The equipment generation worker is currently offline.</p>@endif
                        @endif
                        @if($latestRun && in_array($latestRun->status, ['failed', 'needs_review', 'waiting_worker', 'superseded']))
                            <div class="notice error equipment-error" role="alert">
                                <strong>Generation {{ $latestRun->status === 'waiting_worker' ? 'paused' : 'failed' }}</strong>
                                <p class="fine">{{ $latestRun->error ?? 'Generation could not complete.' }}</p>
                                @if($latestRun->status !== 'waiting_worker')
                                    <form method="post" action="{{ route('trellis.generate-weapon', [$avatar['id'], $slot]) }}" data-no-ajax style="margin-top:6px;">
                                        @csrf
                                        <button type="submit" class="button quiet" @disabled(!$workerConnected)>Retry 3D generation &rarr;</button>
                                    </form>
                                @endif
                            </div>
                        @endif
                        @if($latestRun && $latestRun->status === 'ready' && !$isImage)
                            <p class="fine equipment-ready-note">Generated 3D mesh installed (Seed {{ $latestRun->plan['seed'] ?? '?' }}). Prepare avatar to fit and rig it.</p>
                        @endif
                    </div>
                @endif
                @if($slotRuns->isNotEmpty())
                    <details class="equipment-history-details">
                        <summary>Generation history ({{ $slotRuns->count() }})</summary>
                        <div class="equipment-history-timeline">
                            @foreach($slotRuns as $run)
                                <div class="history-item">
                                    <div class="history-item-header">
                                        <span class="badge {{ $run->status === 'ready' ? 'good' : (in_array($run->status, ['failed', 'needs_review', 'superseded']) ? 'danger' : 'warning') }}">{{ $run->status }}</span>
                                        <span class="fine">{{ $run->created_at->timezone('Asia/Manila')->format('M j, g:i A') }} &middot; Seed {{ $run->plan['seed'] ?? '?' }}</span>
                                    </div>
                                    @if($run->error)<p class="fine error-text">{{ $run->error }}</p>@endif
                                </div>
                            @endforeach
                        </div>
                    </details>
                @endif
                @if($hasAsset)
                    <div class="asset-meta"><a href="{{ $assetUrl }}" download="{{ $avatar['id'].'-'.$filename }}">Download file &darr;</a><span title="{{ $equipment['sha256'] }}">SHA {{ substr($equipment['sha256']??'',0,10) }}</span></div>
                    <form method="post" action="{{ route('trellis.destroy-weapon',[$avatar['id'],$slot]) }}" data-confirm="Remove this custom {{ strtolower($hand) }} asset? The other hand and body will be kept." data-no-ajax>
                        @csrf @method('DELETE')<input type="hidden" name="confirm_delete" value="1"><button class="asset-remove" type="submit">Remove {{ strtolower($hand) }} asset</button>
                    </form>
                @endif
            </article>
        @endforeach
    </div>
    <details class="asset-prompt-panel" id="asset-prompts" @if($selectedDesign ?? null) open @endif>
        <summary>Prompt studio <span class="muted">Edit, save and copy a brief for each asset</span></summary>
        <p class="muted">Use these briefs in your image tool, then upload the resulting files above. Saving a prompt does not generate an image or change an existing model.</p>
        <form method="post" action="{{ route('trellis.prompts',$avatar['id']) }}" data-prompt-form @if($briefImported) data-imported-brief @endif data-no-ajax>
            @csrf @method('PATCH')
            <div class="prompt-tabs" role="tablist" aria-label="Asset prompts">
                @foreach(['body'=>'Body reference','primary'=>'Right hand','secondary'=>'Left hand'] as $key=>$label)
                    <button type="button" id="prompt-tab-{{ $key }}" role="tab" aria-selected="{{ $key==='body' ? 'true' : 'false' }}" aria-controls="prompt-panel-{{ $key }}" data-prompt-tab="{{ $key }}">{{ $label }}</button>
                @endforeach
            </div>
            @foreach(['body'=>'Body reference','primary'=>'Right hand','secondary'=>'Left hand'] as $key=>$label)
                <div id="prompt-panel-{{ $key }}" role="tabpanel" aria-labelledby="prompt-tab-{{ $key }}" data-prompt-panel="{{ $key }}">
                    <label for="prompt-{{ $key }}">{{ $label }} prompt<textarea id="prompt-{{ $key }}" name="{{ $key }}" rows="7" maxlength="8000" required data-default="{{ $assetPrompts['defaults'][$key] }}">{{ old($key,$assetPrompts['values'][$key]) }}</textarea></label>
                    <div class="actions"><button type="button" data-copy-prompt="{{ $key }}">Copy prompt</button><button type="button" class="quiet" data-reset-prompt="{{ $key }}">Reset to suggested</button><span class="fine" data-prompt-feedback="{{ $key }}" role="status"></span></div>
                </div>
            @endforeach
            <div class="prompt-save-row"><span class="fine" data-prompt-save-status role="status">Prompts are saved per avatar.</span><button type="submit" class="primary">Save all prompts</button></div>
        </form>
    </details>
</section>
<script src="{{ asset('avatar-assets.js') }}" defer></script>
