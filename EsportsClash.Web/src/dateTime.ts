// Laravel query-builder timestamps can arrive without an offset; server storage is UTC.
export function parseGameDate(value?:string|null):Date|null{
  if(!value)return null;
  const normalized=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?value.replace(' ','T')+'Z':value;
  const date=new Date(normalized);return Number.isFinite(date.getTime())?date:null;
}
const timeFormat=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});
const dayFormat=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'long'});
export const gameTime=(value?:string|null)=>{const date=parseGameDate(value);return date?timeFormat.format(date):'To be announced';};
export const gameDate=(value?:string|null)=>{const date=parseGameDate(value);return date?dayFormat.format(date):'Not recorded';};
export function relativeGameTime(value:string){
  const date=parseGameDate(value);if(!date)return 'Date unavailable';const seconds=(Date.now()-date.getTime())/1000;
  if(seconds<0)return gameTime(value);
  if(seconds<60)return 'now';if(seconds<3600)return Math.floor(seconds/60)+'m';if(seconds<86400)return Math.floor(seconds/3600)+'h';return gameDate(value);
}
