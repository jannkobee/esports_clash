<?php
namespace App\Services;

/** Narrow compatibility review for replacing kit mechanics while retaining ownership. */
class OriginalRosterUpgrade {
    public static function validate(array $previous,array $next):void {
        foreach(['cards','coaches','starter'] as $key){
            if(($previous[$key]??null)!==($next[$key]??null))throw new \RuntimeException("Original-roster upgrade cannot change {$key} definitions.");
        }
        $old=collect($previous['avatars'])->keyBy('id');$new=collect($next['avatars'])->keyBy('id');
        if($old->count()!==45||$new->count()!==45||$old->keys()->sort()->values()->all()!==$new->keys()->sort()->values()->all())
            throw new \RuntimeException('Original-roster upgrade must preserve all 45 avatar IDs.');
        foreach($new as $id=>$kit){
            if(($kit['abilityRuleset']??null)!=='original-v3-preview-2')throw new \RuntimeException('Every replacement must bind to the original V3 runtime.');
            foreach(['name','primaryRole','secondaryRole','hp','ad','armor','mr','aspd','range'] as $field){
                if(($kit[$field]??null)!==($old[$id][$field]??null))throw new \RuntimeException("Original-roster upgrade changed base/ownership field {$id}:{$field}.");
            }
        }
    }
}
