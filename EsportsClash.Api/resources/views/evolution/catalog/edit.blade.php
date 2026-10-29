@extends('evolution.layout')
@section('title', ($data['name']?:'Create '.$kind).' / Game catalog')
@section('content')
@php($deleted=$entry?->trashed()??false)
<a href="{{ route('catalog.index',$kind) }}">&larr; {{ $kind==='item'?'Items':'Skills & abilities' }}</a>
<div class="page-heading"><div><p class="eyebrow">SHARED GAME CATALOG</p><h1>{{ $data['name']?:'Create '.$kind }}</h1><p class="muted">Names, descriptions and images appear in the web. Supported values apply to new matches after loading the updated catalog.</p></div>@if($entry)<span class="badge">{{ $deleted?'Deleted':'Active' }} &middot; v{{ $entry->version }}</span>@endif</div>
@if($deleted)<div class="notice">This entry is deleted. Restore it to edit or use it in new matches.</div>@endif
<form method="post" enctype="multipart/form-data" action="{{ $entry?route('catalog.update',[$kind,$entry->id]):route('catalog.store',$kind) }}" data-no-ajax data-catalog-editor>
@csrf @if($entry) @method('put') @endif
<input type="hidden" name="version" value="{{ old('version',$entry?->version) }}">
<fieldset class="manage-editor" @disabled($deleted)>
<section class="panel"><h2>Details & image</h2>
@include('evolution.management.field',['field'=>'data.name','label'=>'Name','value'=>$data['name'],'required'=>true,'max'=>100])
<div class="catalog-upload">
@include('evolution.catalog.image',['payload'=>$data,'name'=>$data['name']?:'New '.$kind])
<div><label for="catalog-image">{{ ucfirst($kind) }} image<input id="catalog-image" type="file" name="image" accept="image/png,image/jpeg,image/webp" data-image-input></label><p class="fine">PNG, JPEG or WebP. Maximum 4 MB; 32–4096 pixels per side. A square image works best.</p>
@if(!empty($data['image']))<label class="checkbox-label"><input type="checkbox" name="remove_image" value="1">Remove current image</label>@endif
<p class="fine" data-image-status></p></div></div>
@if($kind==='item')
<div class="manage-grid">
@include('evolution.management.field',['field'=>'data.cost','label'=>'Cost (gold)','value'=>$data['cost'],'type'=>'number','min'=>0,'max'=>50000,'step'=>1,'required'=>true])
@include('evolution.management.field',['field'=>'data.tier','label'=>'Tier','value'=>$data['tier'],'required'=>true,'options'=>array_combine(['Starting','Component','Legendary','Mythic'],['Starting','Component','Legendary','Mythic'])])
@include('evolution.management.field',['field'=>'data.icon','label'=>'Fallback icon','value'=>$data['icon']??'','max'=>16])
@include('evolution.management.field',['field'=>'data.passiveName','label'=>'Passive name','value'=>$data['passiveName'],'max'=>120,'required'=>true])
</div>
@include('evolution.management.field',['field'=>'data.passiveDesc','label'=>'Description','value'=>$data['passiveDesc'],'type'=>'textarea','required'=>true,'max'=>3000])
<p class="fine">Built-in item IDs retain their implemented effects. New items provide the stat bonuses entered below; describing a new proc does not implement it.</p>
@else
@include('evolution.management.field',['field'=>'data.desc','label'=>'Description','value'=>$data['desc'],'type'=>'textarea','required'=>true,'max'=>3000])
@if(($data['slot']??'library')==='library')
<p class="fine">This is a library skill. Save it, then apply its values to an avatar slot below. The target slot keeps its existing effect behavior; new effect types require engine implementation.</p>
@else
<p class="fine">Binding: {{ $data['avatarName'] }} / {{ $data['slot'] }}. This entry keeps the existing targeting, crowd control and effect behavior.</p>
@endif
@if(($data['slot']??'library')!=='passive')
<div class="manage-grid">
@if(isset($data['abilityRuleset']))<input type="hidden" name="data[damage]" value="{{ $data['damage']??0 }}"><p class="muted">Damage is defined by the original kit's effect components. Text, image and base cooldown remain editable.</p>@else
@include('evolution.management.field',['field'=>'data.damage','label'=>'Base damage','value'=>$data['damage']??0,'type'=>'number','min'=>0,'max'=>20000,'required'=>true])
@endif
@include('evolution.management.field',['field'=>'data.cooldown','label'=>'Base cooldown (seconds)','value'=>$data['cooldown']??8,'type'=>'number','min'=>0,'max'=>600,'required'=>true])
</div><p class="fine">Existing rank scaling still applies. Zero cooldown is supported for orb and special kits.</p>
@endif
@endif
</section>
@if($kind==='item')
<section class="panel"><h2>Stat bonuses & roles</h2><div class="manage-stat-grid">
@foreach(\App\Services\ContentManagementService::ITEM_STATS as $key=>[$low,$high,$label])
@include('evolution.management.field',['field'=>'data.stats.'.$key,'label'=>$label,'value'=>$data['stats'][$key]??null,'type'=>'number','min'=>$low,'max'=>$high])
@endforeach
</div><fieldset class="manage-roles"><legend>Suitable roles (choose at least one)</legend>
@foreach(\App\Services\ContentManagementService::ROLES as $role)<label class="checkbox-label"><input type="checkbox" name="data[suitableRoles][]" value="{{ $role }}" @checked(in_array($role,old('data.suitableRoles',$data['suitableRoles']??[]),true))>{{ $role }}</label>@endforeach
</fieldset></section>
@endif
<div class="panel manage-save"><p class="muted" data-save-status>Save to update the shared catalog.</p><button type="submit" class="primary">{{ $entry?'Save changes':'Create '.$kind }}</button></div>
</fieldset></form>
@if($entry)
@if($kind==='skill' && !$deleted && ($data['slot']??'')==='library')
<section class="panel"><h2>Apply saved skill to an avatar slot</h2><p class="muted">Copies the saved name, description, image, damage and cooldown. The selected slot retains its current targeting and effect behavior.</p>
<form method="post" action="{{ route('catalog.assign',[$kind,$entry->id]) }}" data-no-ajax>@csrf<input type="hidden" name="version" value="{{ $entry->version }}">
<label>Avatar slot<select name="binding" required><option value="">Choose a slot</option>
@foreach(\App\Models\GameContent::where('kind','skill')->orderBy('id')->get() as $target)
@if(in_array($target->payload['slot']??'',['skill1','skill2','ultimate'],true))<option value="{{ $target->id }}|{{ $target->version }}">{{ $target->payload['avatarName'] }} / {{ $target->payload['slot'] }} / {{ $target->payload['name'] }}</option>@endif
@endforeach
</select></label><button>Apply saved values</button></form></section>
@endif
<section class="panel"><h2>{{ $deleted?'Restore entry':'Delete entry' }}</h2><p class="muted">{{ $deleted?'Restore this entry for future catalog loads.':'Deletion removes this entry from the web catalog and disables its purchase or active ability in new matches. Existing matches and image history are retained.' }}</p>
@if(($data['slot']??'')==='passive')<p class="fine">Passive deletion hides this catalog entry; its innate engine behavior is retained.</p>@endif
<form method="post" action="{{ $deleted?route('catalog.restore',[$kind,$entry->id]):route('catalog.destroy',[$kind,$entry->id]) }}" data-no-ajax @if(!$deleted) data-catalog-delete @endif>@csrf @if(!$deleted) @method('delete') @endif<input type="hidden" name="version" value="{{ $entry->version }}"><button class="{{ $deleted?'':'danger' }}">{{ $deleted?'Restore entry':'Delete entry' }}</button></form>
<p class="fine">Stable ID: {{ $entry->id }}</p></section>
@endif
<script src="{{ asset('catalog-editor.js') }}" defer></script>
@endsection
