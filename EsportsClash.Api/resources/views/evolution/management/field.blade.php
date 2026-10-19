@php
    $inputName = preg_replace('/\.([^.]+)/', '[$1]', $field);
    $inputId = str_replace('.', '-', $field);
    $current = old($field, $value ?? '');
    if (!is_scalar($current) && $current !== null) $current = '';
@endphp
<div class="manage-field">
<label for="{{ $inputId }}">{{ $label }} @if($required ?? false)<span aria-label="required">*</span>@else<span class="fine">(optional)</span>@endif</label>
@if(($type ?? '') === 'textarea')
<textarea id="{{ $inputId }}" name="{{ $inputName }}" rows="{{ $rows ?? 3 }}" maxlength="{{ $max ?? 6000 }}" @required($required ?? false) @error($field) aria-invalid="true" @enderror aria-describedby="{{ $inputId }}-help {{ $inputId }}-error" placeholder="{{ $placeholder ?? '' }}">{{ $current }}</textarea>
@elseif(isset($options))
<select id="{{ $inputId }}" name="{{ $inputName }}" @required($required ?? false) @error($field) aria-invalid="true" @enderror aria-describedby="{{ $inputId }}-help {{ $inputId }}-error">
@foreach($options as $optionValue=>$optionLabel)<option value="{{ $optionValue }}" @selected((string)$current === (string)$optionValue)>{{ $optionLabel }}</option>@endforeach
</select>
@else
<input id="{{ $inputId }}" name="{{ $inputName }}" type="{{ $type ?? 'text' }}" value="{{ $current }}" @required($required ?? false) @if(isset($min)) min="{{ $min }}" @endif @if(isset($max)) {{ ($type ?? '') === 'number' ? 'max' : 'maxlength' }}="{{ $max }}" @endif @if(($type ?? '') === 'number') step="{{ $step ?? 'any' }}" @endif @error($field) aria-invalid="true" @enderror aria-describedby="{{ $inputId }}-help {{ $inputId }}-error">
@endif
<small id="{{ $inputId }}-help" class="fine">{{ $hint ?? '' }}</small>
<span id="{{ $inputId }}-error" class="error-text">@error($field){{ $message }}@enderror</span>
</div>
