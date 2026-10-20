@extends('evolution.layout')
@section('title', ($entry?->name ?? 'New '.$kind).' / Content studio')
@section('content')
@php
    $roles=array_combine($service::ROLES,$service::ROLES);
    $archived=$entry?->status==='archived';
    $selectedRoles=old('data.suitableRoles',$data['suitableRoles']??[]);
    if (!is_array($selectedRoles)) $selectedRoles=[];
@endphp
<a href="{{ route('management.index',$kind) }}">&larr; {{ ucfirst($kind) }} management</a>
<div class="page-heading"><div><p class="eyebrow">{{ $kind === 'avatar' ? 'AVATAR BUILDER' : 'ITEM BUILDER' }}</p><h1>{{ $entry?->name ?? 'Create '.$kind }}</h1><p class="muted">Work through the sections, then save your draft. Fields marked * are required.</p></div>@if($entry)<span class="badge">{{ ['draft'=>'Draft','review'=>'Ready for review','archived'=>'Archived'][$entry->status] }} &middot; v{{ $entry->version }}</span>@endif</div>
<div class="notice">Draft workspace: prompts describe intended behavior and visuals. They do not implement new mechanics, generate images, or publish assets. Mechanical changes need code and balance review; visual jobs remain manual.</div>
@if($archived)<div class="notice">This design is archived. Restore it below before editing.</div>@endif
<nav class="manage-steps" aria-label="Builder sections"><a href="#identity">1. Identity & {{ $kind==='avatar'?'look':'effect' }}</a><a href="#details">2. {{ $kind==='avatar'?'Stats & skills':'Stats & roles' }}</a><a href="#save-design">3. Save draft</a>@if($entry)<a href="#review-design">Review & history</a>@endif</nav>
<form id="content-editor" method="post" action="{{ $entry ? route('management.update',[$kind,$entry]) : route('management.store',$kind) }}" data-content-editor>
@csrf @if($entry) @method('put') @endif
<input type="hidden" name="version" value="{{ old('version',$entry?->version) }}">
<fieldset class="manage-editor" @disabled($archived)>
<section id="identity" class="panel"><p class="eyebrow">STEP 1</p><h2>Identity & {{ $kind==='avatar'?'appearance':'effect' }}</h2>
<div class="manage-grid">
@include('evolution.management.field',['field'=>$kind==='avatar'?'data.displayName':'data.name','label'=>'Display name','value'=>$kind==='avatar'?$data['displayName']:$data['name'],'required'=>true,'max'=>80])
@if($kind==='avatar')
@include('evolution.management.field',['field'=>'data.title','label'=>'Character title','value'=>$data['title'],'required'=>true,'max'=>120])
@include('evolution.management.field',['field'=>'data.primaryRole','label'=>'Primary role','value'=>$data['primaryRole'],'required'=>true,'options'=>$roles])
@include('evolution.management.field',['field'=>'data.secondaryRole','label'=>'Secondary role','value'=>$data['secondaryRole'],'options'=>[''=>'None']+$roles,'hint'=>'Choose a different role from the primary role.'])
@include('evolution.management.field',['field'=>'data.archetype','label'=>'Archetype','value'=>$data['archetype'],'required'=>true,'max'=>120,'hint'=>'For example: elemental mage, armored vanguard, agile duelist.'])
<div class="manage-grid">
@include('evolution.management.field',['field'=>'data.primaryColor','label'=>'Primary color','value'=>$data['primaryColor'],'required'=>true,'type'=>'color'])
@include('evolution.management.field',['field'=>'data.accentColor','label'=>'Accent color','value'=>$data['accentColor'],'required'=>true,'type'=>'color'])
</div>
@else
@include('evolution.management.field',['field'=>'data.cost','label'=>'Cost (gold)','value'=>$data['cost'],'required'=>true,'type'=>'number','min'=>0,'max'=>50000,'step'=>1])
@include('evolution.management.field',['field'=>'data.tier','label'=>'Item tier','value'=>$data['tier'],'required'=>true,'options'=>array_combine(['Starting','Component','Legendary','Mythic'],['Starting','Component','Legendary','Mythic'])])
@include('evolution.management.field',['field'=>'data.icon','label'=>'Icon character','value'=>$data['icon'],'max'=>16,'hint'=>'An emoji or short symbol; not an image upload.'])
@include('evolution.management.field',['field'=>'data.passiveName','label'=>'Passive effect name','value'=>$data['passiveName'],'required'=>true,'max'=>120])
@endif
</div>
@include('evolution.management.field',['field'=>'brief.appearancePrompt','label'=>$kind==='avatar'?'Avatar appearance prompt':'Item appearance prompt','value'=>$brief['appearancePrompt']??'','type'=>'textarea','rows'=>4,'hint'=>$kind==='avatar'?'Describe silhouette, anatomy, outfit, primary weapon, equipment, materials, palette and features to preserve.':'Describe item shape, silhouette, materials, palette, icon composition and readable details.','placeholder'=>$kind==='avatar'?'An original elemental mage with a distinctive high collar, layered robes and three orbiting elemental foci?':'A broad obsidian blade with an amber core, worn brass fittings and a clear silhouette at small icon size?'])
@include('evolution.management.field',['field'=>'data.passiveDesc','label'=>$kind==='avatar'?'Passive gameplay description':'What does this item do?','value'=>$data['passiveDesc'],'required'=>true,'type'=>'textarea','max'=>3000,'hint'=>'Describe rules, conditions and effects. Text alone does not add a new effect to the engine.'])
@include('evolution.management.field',['field'=>$kind==='avatar'?'brief.passivePrompt':'brief.effectPrompt','label'=>$kind==='avatar'?'Passive design prompt':'Item effect prompt','value'=>$brief[$kind==='avatar'?'passivePrompt':'effectPrompt']??'','type'=>'textarea','hint'=>'Explain the intended experience, triggers, feedback, visuals and constraints.'])
</section>
<section id="details" class="panel"><p class="eyebrow">STEP 2</p><h2>{{ $kind==='avatar'?'Base stats':'Item stats & suitable roles' }}</h2><p class="muted">Proposed values only. Input bounds prevent mistakes; they do not establish balance.</p>
<div class="manage-stat-grid">
@foreach(($kind==='avatar'?$service::AVATAR_STATS:$service::ITEM_STATS) as $key=>[$low,$high,$statLabel])
@include('evolution.management.field',['field'=>$kind==='avatar'?'data.'.$key:'data.stats.'.$key,'label'=>$statLabel,'value'=>$kind==='avatar'?($data[$key]??null):($data['stats'][$key]??null),'type'=>'number','min'=>$low,'max'=>$high,'required'=>$kind==='avatar','hint'=>$kind==='item'?'Leave blank for no bonus.':''])
@endforeach
</div>
@if($kind==='item')
<input type="hidden" name="data[suitableRoles]" value=""><fieldset class="manage-roles"><legend>Suitable roles * (choose at least one)</legend>@foreach($roles as $role)<label class="checkbox-label"><input type="checkbox" name="data[suitableRoles][]" value="{{ $role }}" @checked(in_array($role,$selectedRoles,true))>{{ $role }}</label>@endforeach</fieldset>
@endif
</section>
@if($kind==='avatar')
@foreach($service::SLOTS as $slot=>$slotLabel)
<section class="panel"><p class="eyebrow">{{ strtoupper($slotLabel) }}</p><h2>{{ $slotLabel }} &middot; Gameplay, look & animation</h2>
<div class="manage-grid">
@include('evolution.management.field',['field'=>"data.$slot.name",'label'=>'Skill name','value'=>$data[$slot]['name'],'required'=>true,'max'=>100])
@include('evolution.management.field',['field'=>"data.$slot.castType",'label'=>'Targeting','value'=>$data[$slot]['castType']??'unit','required'=>true,'options'=>['unit'=>'Target a unit','point_or_unit'=>'Point or unit','area'=>'Area','no_target'=>'No target','toggle'=>'Toggle']])
@include('evolution.management.field',['field'=>"data.$slot.damage",'label'=>'Base damage','value'=>$data[$slot]['damage'],'required'=>true,'type'=>'number','min'=>0,'max'=>20000])
@include('evolution.management.field',['field'=>"data.$slot.damageType",'label'=>'Damage type','value'=>$data[$slot]['damageType'],'required'=>true,'options'=>['Physical'=>'Physical','Magic'=>'Magic','True'=>'True']])
@include('evolution.management.field',['field'=>"data.$slot.cooldown",'label'=>'Cooldown (seconds)','value'=>$data[$slot]['cooldown'],'required'=>true,'type'=>'number','min'=>0,'max'=>600,'hint'=>'Zero is allowed for special kits; requires mechanical review.'])
</div>
@include('evolution.management.field',['field'=>"data.$slot.desc",'label'=>'Player-facing description','value'=>$data[$slot]['desc'],'required'=>true,'type'=>'textarea','max'=>3000])
@include('evolution.management.field',['field'=>"brief.skills.$slot.gameplayPrompt",'label'=>'Gameplay design prompt','value'=>$brief['skills'][$slot]['gameplayPrompt']??'','type'=>'textarea','hint'=>'Describe targeting, behavior, conditions, counters and intended interactions.'])
@include('evolution.management.field',['field'=>"brief.skills.$slot.appearancePrompt",'label'=>'Skill appearance / VFX prompt','value'=>$brief['skills'][$slot]['appearancePrompt']??'','type'=>'textarea','hint'=>'Describe casting cue, projectile or trail, impact, palette and team readability.'])
@include('evolution.management.field',['field'=>"brief.skills.$slot.animationPrompt",'label'=>'Skill animation prompt','value'=>$brief['skills'][$slot]['animationPrompt']??'','type'=>'textarea','hint'=>'Describe anticipation, wind-up, strike, follow-through and recovery. Match actual gameplay hit timing.'])
</section>
@endforeach
@endif
<div id="save-design" class="panel manage-save"><div><p class="eyebrow">STEP 3</p><h2>Save your draft</h2><p class="muted" data-save-status>Changes are saved only when you select Save draft. Saving a reviewed design returns it to Draft.</p></div><button class="primary" type="submit">Save draft</button></div>
</fieldset>
</form>
@if($entry)
<section id="review-design" class="panel"><h2>Review & export</h2><p class="muted">Save changes above before using these controls. Review checks for a complete design brief; it does not approve or deploy it.</p>
<div class="actions">
@if(!$archived)
<form method="post" action="{{ route('management.action',[$kind,$entry]) }}" data-saved-action>@csrf<input type="hidden" name="version" value="{{ $entry->version }}"><input type="hidden" name="action" value="review"><button>Mark ready for review</button></form>
@endif
<a class="button" href="{{ route('management.download',[$kind,$entry,'format'=>'prompt']) }}" data-saved-action>Download saved prompt</a>
<a class="button" href="{{ route('management.download',[$kind,$entry]) }}" data-saved-action>Export saved design (JSON)</a>
<form method="post" action="{{ route('management.action',[$kind,$entry]) }}" data-saved-action>@csrf<input type="hidden" name="version" value="{{ $entry->version }}"><input type="hidden" name="action" value="{{ $archived?'restore':'archive' }}"><button class="{{ $archived?'':'danger' }}">{{ $archived?'Restore to drafts':'Archive design' }}</button></form>
</div>
@if($kind==='avatar' && $entry->source_id && !$archived)
<p><a class="button" data-saved-action href="{{ route('trellis.index',['design'=>$entry->id]) }}#avatar-{{ $entry->source_id }}">Use saved look in 3D Generation &rarr;</a></p><p class="fine">The concept brief uses this saved appearance prompt. No image provider is configured; create / upload a reference image, then queue TRELLIS manually.</p>
@elseif($kind==='avatar' && !$entry->source_id)
<p class="fine">Custom avatars need a reviewed game / renderer catalog integration before the existing 3D pipeline can process them. You can export the design brief now.</p>
@endif
<details><summary>Read the combined saved prompt</summary><pre>{{ $service->prompt($entry) }}</pre></details>
<p class="fine">Stable identity: {{ $data['id'] }} @if($entry->source_id) &middot; Imported source: {{ $entry->source_id }} @endif &middot; No live content has been overwritten.</p>
</section>
<section class="panel"><h2>Version history</h2><p class="muted">Restoring an earlier version creates a new draft revision and preserves history.</p>
@foreach($history as $revision)<div class="manage-revision"><div><strong>v{{ $revision->version }} &middot; {{ str_replace('_',' ',$revision->action) }}</strong><span class="fine"> &middot; {{ $revision->created_at->format('M j, Y H:i') }} &middot; {{ $revision->status }}</span></div>@if($revision->version !== $entry->version)<form method="post" action="{{ route('management.action',[$kind,$entry]) }}" data-saved-action>@csrf<input type="hidden" name="version" value="{{ $entry->version }}"><input type="hidden" name="action" value="restore_revision"><input type="hidden" name="revision" value="{{ $revision->version }}"><button>Restore v{{ $revision->version }} as draft</button></form>@endif</div>@endforeach
@include('evolution.management.pagination',['pager'=>$history])
</section>
@endif
<script src="{{ asset('content-management.js') }}" defer></script>
@endsection
