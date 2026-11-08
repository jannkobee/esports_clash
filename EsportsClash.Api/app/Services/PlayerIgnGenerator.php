<?php

namespace App\Services;

/** Original pronounceable gamer aliases, independent of legacy pros and database IDs. */
class PlayerIgnGenerator
{
    public function generate(string $entropy): string
    {
        $bytes = array_values(unpack('C*', hash('sha256', $entropy, true)));
        $starts = ['v', 'k', 'r', 's', 'n', 'z', 'l', 't', 'd', 'f', 'm', 'b', 'c', 'j', 'p', 'x', 'ry', 'ky', 'sy', 'vy', 'ny', 'th', 'kr', 'sk'];
        $vowels = ['a', 'e', 'i', 'o', 'u', 'ae', 'ai', 'io'];
        $ends = ['n', 'x', 'r', 's', 'l', 'k', 'v', 'th', 'sh', 'zen', 'rin', 'vek', 'ra', 'no', 'ri', 'va'];
        $name = $starts[$bytes[0] % count($starts)].$vowels[$bytes[1] % count($vowels)]
            .$starts[$bytes[2] % count($starts)].$vowels[$bytes[3] % count($vowels)].$ends[$bytes[4] % count($ends)];
        $roots=['hush','rift','cinder','vex','fable','nori','lumen','wisp','onyx','sora','quill','kairo','vel','echo','jolt','mori','nox','piko','sable','kest','nyro','flux','rune','vesper','aero','zeph','tavi','neon','ember','clove','vanta','lyra','miso','volt','roan','kova','dash','cove','lark','prism'];
        $tails=['','x','z','n','s','io','en','ix','o','y','er','in','a','u','iq','sy'];
        $pattern=$bytes[5]%10;
        if($pattern<5)$name=$roots[$bytes[6]%count($roots)].$tails[$bytes[7]%count($tails)];
        elseif($pattern<8)$name=$roots[$bytes[6]%count($roots)].$roots[$bytes[8]%count($roots)];
        if($bytes[9]%12===0)$name=str_replace(['a','e','i','o'],['4','3','1','0'],$name);
        elseif($bytes[9]%16===0)$name.=(string)(2+$bytes[10]%8);
        return strtolower(substr($name,0,13));
    }
}
