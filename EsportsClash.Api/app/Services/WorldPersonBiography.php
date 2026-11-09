<?php
namespace App\Services;
use App\Models\{CompetitionGeography,OnlineClub,OwnedPlayerCard};

/** Fictional biographical facts, separate from performance and legal nationality. */
class WorldPersonBiography {
 public function initialize(OwnedPlayerCard $player):void {
  if($player->personal_details||!$player->nationality_id||!$player->world_profile)return;
  $country=CompetitionGeography::find($player->nationality_id);if(!$country)return;
  $origins=[
   'PH'=>[['Adrian','Miguel','Rafael','Nico','Gabriel','Marco','Eli','Luis','Enzo','Paolo'],['Reyes','Santos','Navarro','Cruz','Bautista','Ramos','Torres','Rivera','Mercado','Dizon'],['Manila','Quezon City','Cebu City','Davao City','Iloilo City']],
   'KR'=>[['Ji-ho','Min-jun','Seo-jun','Do-yun','Hyun-woo','Jun-seo','Si-woo','Tae-jun'],['Kim','Lee','Park','Choi','Jung','Kang','Han','Yoon'],['Seoul','Busan','Incheon','Daejeon','Daegu']],
   'JP'=>[['Haruto','Ren','Sota','Yuto','Kaito','Riku','Itsuki','Haru'],['Sato','Suzuki','Takahashi','Tanaka','Ito','Yamamoto','Mori','Nakamura'],['Tokyo','Osaka','Yokohama','Fukuoka','Kyoto']],
   'BR'=>[['Lucas','Gabriel','Rafael','Mateus','Pedro','Bruno','Caio','Thiago'],['Silva','Santos','Oliveira','Costa','Pereira','Almeida','Lima','Rocha'],['São Paulo','Rio de Janeiro','Curitiba','Recife','Belo Horizonte']],
   'FR'=>[['Lucas','Hugo','Louis','Jules','Arthur','Noah','Ethan','Leo'],['Martin','Bernard','Dubois','Laurent','Moreau','Simon','Roux','Petit'],['Paris','Lyon','Marseille','Lille','Bordeaux']],
   'ZA'=>[['Thabo','Sipho','Liam','Lunga','Neo','Kabelo','Ethan','Sibusiso'],['Nkosi','Dlamini','Mokoena','Khumalo','Molefe','Naidoo','Jacobs','Ndlovu'],['Johannesburg','Cape Town','Durban','Pretoria','Gqeberha']],
   'US'=>[['Alex','Jordan','Evan','Noah','Miles','Ryan','Owen','Eli'],['Brooks','Reed','Morgan','Hayes','Bennett','Cole','Parker','Foster'],['Los Angeles','Chicago','Seattle','Austin','New York']],
  ];
  [$first,$last,$cities]=$origins[$country->code]??[['Alex','Rin','Kai','Noa','Ari','Sam'],['Vale','Mori','Arden','Silva','Reyes','Chen'],[$country->name]];
  $hash=hash('sha256',$player->id.':biography-v1');$pick=fn($offset,$items)=>$items[hexdec(substr($hash,$offset,4))%count($items)];
  $given=$pick(0,$first);$family=$pick(4,$last);$city=$pick(8,$cities);$hobby=$pick(12,['drawing','cooking','cycling','photography','music','puzzle games','hiking','reading']);
  $details=['version'=>1,'real_name'=>$country->code==='KR'?$family.' '.$given:$given.' '.$family,'given_name'=>$given,'family_name'=>$family,'birth_date'=>$player->world_profile['birth_date'],'birthplace'=>$city,'residence'=>['city'=>$city,'country'=>$country->name,'code'=>$country->code],
   'languages'=>match($country->code){'PH'=>['Filipino','English'],'KR'=>['Korean'],'JP'=>['Japanese'],'FR'=>['French'],'BR'=>['Portuguese'],'ZA','US'=>['English'],default=>['English']},'hobby'=>$hobby,
   'trivia'=>['Enjoys '.$hobby.' away from competition.','Grew up in '.$city.'.'],
   'introduction'=>[['question'=>'Where did your story begin?','answer'=>'I grew up in '.$city.'. The local gaming scene made me want to find a team of my own.'],['question'=>'How do you spend a day away from the Arena?','answer'=>'Usually '.$hobby.'. Having something outside the game helps me come back with a clear head.'],['question'=>'What do you want to achieve?','answer'=>'Earn a starting place, keep improving, and help my club build a record we can be proud of.']],
   'source'=>'world-biography-v1'];
  $player->update(['personal_details'=>$details]);
 }
}
