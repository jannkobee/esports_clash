<?php
namespace App\Services;
use App\Models\{CompetitionGeography,NationalTeam};
use Illuminate\Support\Facades\DB;

/** ISO country identities and CLDR geography; never rewrites an existing nationality or edition. */
class CountryCatalog {
 public function install():array {
  return DB::transaction(function(){
   $rows=json_decode(file_get_contents(resource_path('game/countries.json')),true,512,JSON_THROW_ON_ERROR);
   $continents=['AS'=>'Asia','AF'=>'Africa','EU'=>'Europe','AM'=>'Americas','OC'=>'Oceania','AN'=>'Antarctica'];$parents=[];
   foreach($continents as $code=>$name)$parents[$code]=CompetitionGeography::firstOrCreate(['kind'=>'continent','code'=>$code],['name'=>$name,'timezone'=>'UTC','eligible'=>true]);
   $added=0;
   foreach($rows as $row){
    $region=CompetitionGeography::firstOrCreate(['kind'=>'region','code'=>$row['region_code']],['name'=>$row['region_name'],'parent_id'=>$parents[$row['continent_code']]->id,'timezone'=>'UTC','eligible'=>false]);
    $country=CompetitionGeography::firstOrCreate(['kind'=>'country','code'=>$row['code']],['name'=>$row['name'],'parent_id'=>$region->id,'timezone'=>'UTC','eligible'=>!in_array($row['code'],['AQ','BV','HM'],true)]);
    if($country->wasRecentlyCreated)$added++;
    NationalTeam::firstOrCreate(['geography_id'=>$country->id],['name'=>$country->name,'flag'=>$country->code]);
   }
   return ['added'=>$added,'countries'=>CompetitionGeography::where('kind','country')->count()];
  },3);
 }
}
