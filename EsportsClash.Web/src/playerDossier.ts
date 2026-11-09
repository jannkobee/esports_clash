export interface PersonalDetails {
 real_name:string;birth_date:string;birthplace:string;residence:{city:string;country:string;code:string};languages:string[];hobby:string;trivia:string[];introduction:{question:string;answer:string}[];
}
export interface CareerDossier {
 played:number;wins:number;losses:number;win_rate:number|null;mvps:number;average_rating:number|null;kills:number;deaths:number;assists:number;kda:number|null;damage_per_minute:number|null;
 win_estimate:{percent:number;low:number;high:number;samples:number;method:string}|null;
 team_history:{club_id:number;club_name:string;first_appearance:string;last_appearance:string;games:number}[];
 personal_bests:{stat:string;value:number;fixture_id:number;match_id:string;competition:string;date:string}[];
 awards:{year:number;category:string;position:number;score:number;name:string}[];note:string;
}
export interface CareerRecord {id:number;match_id:string;fixture_id:number;competition:string;club_name:string;scope:string;played_at:string;won:boolean;match_mvp:boolean;rating:number|null;kills:number;deaths:number;assists:number;cs:number;gold:number;damage:number;duration_seconds:number;result_hash:string}
