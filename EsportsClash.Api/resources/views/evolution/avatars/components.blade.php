@php
    $componentService=app(\App\Services\AvatarComponentService::class);
    $componentInventory=$componentService->inventory($avatar['id']);
    $componentCategories=$componentService::CATEGORIES;
    $componentBindings=$componentService::BINDINGS;
@endphp
<section class="panel" id="avatar-components" data-inventory-version="{{ $componentInventory['version'] }}">
    <p class="eyebrow">APPEARANCE / COMPANIONS / VEHICLES</p>
    <h2>Complete the character</h2>
    <p>Store clothing, hair, back-mounted gear, accessories, vehicles and companions separately. Upload PNG references or self-contained GLB models. Fit appearance only after the base rig passes deformation review.</p>
    <p class="muted">Uploads stay unqualified and do not start generation. Vehicles and companions use independent rigs. This inventory also supplies the Web catalog.</p>
    <div class="asset-editor-grid">
    @foreach([...$componentInventory['components'], null] as $component)
        <article class="asset-editor-card">
            <h3>{{ $component['label']??'Add a component' }}</h3>
            @if($component)
                <span class="badge warning">{{ str_replace('_',' ',$component['status']) }}</span>
                @foreach(['reference'=>'Reference PNG','model'=>'Unqualified model'] as $assetKind=>$assetLabel)
                    @if($component[$assetKind])
                        @php($assetLink=route('avatar-components.file',[$avatar['id'],$component[$assetKind]['sha256'],$component[$assetKind]['format']]))
                        @if($assetKind==='reference')<div class="asset-preview checkerboard"><img src="{{ $assetLink }}" alt="{{ $component['label'] }} reference"></div>@endif
                        <p><a href="{{ $assetLink }}" target="_blank" rel="noopener">{{ $assetLabel }}</a> <small>SHA {{ substr($component[$assetKind]['sha256'],0,12) }}</small></p>
                        @if($assetKind==='reference')<p class="fine">{{ ($component[$assetKind]['purpose']??'reconstruction')==='design'?'Design context only — isolate the component before reconstruction.':'Component reconstruction reference — review before generating.' }}</p>@endif
                    @endif
                @endforeach
            @endif
            <form method="post" enctype="multipart/form-data" action="{{ route('avatar-components.save',$avatar['id']) }}" data-no-ajax>
                @csrf
                <input type="hidden" name="version" value="{{ $componentInventory['version'] }}">
                <label>Component ID <input name="component_id" value="{{ $component['id']??'' }}" pattern="[a-z][a-z0-9_-]{0,63}" maxlength="64" required {{ $component?'readonly':'' }} placeholder="e.g. shoulder_cannon"></label>
                <label>Name <input name="label" value="{{ $component['label']??'' }}" maxlength="100" required></label>
                <label>Category <select name="category">@foreach($componentCategories as $key=>$label)<option value="{{ $key }}" @selected(($component['category']??'outfit')===$key)>{{ $label }}</option>@endforeach</select></label>
                <label>Assembly <select name="binding">@foreach($componentBindings as $key=>$label)<option value="{{ $key }}" @selected(($component['binding']??'skinned')===$key)>{{ $label }}</option>@endforeach</select></label>
                <label>Attachment / placement <input name="attachment" value="{{ $component['attachment']??'' }}" maxlength="200" placeholder="e.g. upper back; independent companion"></label>
                <label>Design / generation prompt <textarea name="prompt" maxlength="8000" rows="3">{{ $component['prompt']??'' }}</textarea></label>
                <label>Reference or model <input type="file" name="asset" accept="image/png,.glb" data-max-mib="20"></label>
                <label>PNG purpose <select name="reference_purpose"><option value="reconstruction">Isolated reconstruction input</option><option value="design" @selected(($component['reference']['purpose']??'')==='design')>Design context only</option></select></label>
                <p class="fine">PNG or GLB, up to 20 MiB. PNG replaces only the reference; GLB replaces only the model. Prior revisions are retained.</p>
                <button type="submit">{{ $component?'Save component':'Add component' }}</button>
            </form>
        </article>
    @endforeach
    </div>
</section>
