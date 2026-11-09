<?php
namespace App\Services;

/** Glickman's March 2022 Glicko-2 algorithm; one verified match is one rating period. */
class GlickoRating
{
    public function update(array $player,array $opponents,float $tau=0.5): array
    {
        $mu=($player['rating']-1500)/173.7178;$phi=$player['deviation']/173.7178;$sigma=$player['volatility'];
        if(!$opponents)return ['rating'=>$player['rating'],'deviation'=>min(350,173.7178*sqrt($phi*$phi+$sigma*$sigma)),'volatility'=>$sigma];
        $variance=0;$sum=0;
        foreach($opponents as $op){$g=1/sqrt(1+3*($op['deviation']/173.7178)**2/M_PI**2);$e=1/(1+exp(-$g*($mu-($op['rating']-1500)/173.7178)));$variance+=$g*$g*$e*(1-$e);$sum+=$g*($op['result']-$e);}
        $v=1/max(1e-12,$variance);$delta=$v*$sum;$a=log($sigma*$sigma);
        $f=fn($x)=>exp($x)*($delta*$delta-$phi*$phi-$v-exp($x))/(2*($phi*$phi+$v+exp($x))**2)-($x-$a)/($tau*$tau);
        $A=$a;
        if($delta*$delta>$phi*$phi+$v)$B=log($delta*$delta-$phi*$phi-$v);
        else { $k=1;while($f($a-$k*$tau)<0 && $k<100)$k++;$B=$a-$k*$tau; }
        $fA=$f($A);$fB=$f($B);
        for($i=0;abs($B-$A)>0.000001 && $i<100;$i++){
            $C=$A+($A-$B)*$fA/($fB-$fA);$fC=$f($C);
            if($fC*$fB<=0){$A=$B;$fA=$fB;}else $fA/=2;
            $B=$C;$fB=$fC;
        }
        $sigma=exp($A/2);$pre=sqrt($phi*$phi+$sigma*$sigma);$newPhi=1/sqrt(1/($pre*$pre)+1/$v);
        return ['rating'=>1500+173.7178*($mu+$newPhi*$newPhi*$sum),'deviation'=>min(350,173.7178*$newPhi),'volatility'=>$sigma];
    }
}
