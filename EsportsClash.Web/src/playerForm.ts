export interface PlayerFormData {
  score:number|null; sample_count:number; evidence:string;
  trend:'rising'|'falling'|'steady'|'insufficient'; trend_delta:number|null;
  samples:{rating:number;date:string;won:boolean}[];
  model:string; window_days:number; half_life_days:number; prior_rating:number; prior_weight:number;
}
