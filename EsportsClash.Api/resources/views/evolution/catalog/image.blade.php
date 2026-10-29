@if(!empty($payload['image']))
<img class="catalog-image" src="{{ route('catalog.image',$payload['image']) }}" alt="{{ $name }}" width="72" height="72" loading="lazy">
@else
<span class="catalog-image catalog-image-fallback" role="img" aria-label="{{ $name }} placeholder">{{ $payload['icon']??mb_substr($name,0,1) }}</span>
@endif
