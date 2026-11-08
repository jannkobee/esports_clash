import {TrendingDown,TrendingUp,Minus,Activity} from 'lucide-react';
import {ratingWord} from '../matchRatingScale';
import type {PlayerFormData} from '../playerForm';
export function PlayerForm({form,detail=false}:{form?:PlayerFormData;detail?:boolean}) {
  const Trend=form?.trend==='rising'?TrendingUp:form?.trend==='falling'?TrendingDown:Minus;
  return <div className="player-form" title="Verified ratings from the last 56 days. Weighted by recency and tempered by two neutral prior appearances. No combat-stat bonus.">
    <span className="player-form__score"><Activity size={13}/>{form?.score!=null?<><strong>{form.score.toFixed(1)}</strong><span>{ratingWord(form.score)}</span></>:<span>Unrated</span>}</span>
    {form?.score!=null&&<span className={'player-form__trend '+form.trend}><Trend size={14}/><small>{detail?form.evidence:form.sample_count+' games'}</small></span>}
    {detail&&<><small>{form?.sample_count??0} verified appearances · Last 56 days</small><span className="player-form__results">{form?.samples.slice(0,5).map((r,i)=><b key={r.date+'-'+i} className={r.won?'form-win':'form-loss'} title={r.rating.toFixed(1)+' / 10 · '+r.date}>{r.won?'W':'L'}</b>)}</span></>}
  </div>;
}
