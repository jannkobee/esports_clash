/** Convert operational JSON to renderable values, including optional nested metrics. */
export function displayMetrics(value:unknown,prefix='',depth=0):[string,string][] {
  if(!value||typeof value!=='object'||Array.isArray(value)||depth>3)return [];
  return Object.entries(value).flatMap(([key,item]):[string,string][]=>{
    const label=(prefix?prefix+' / ':'')+key.replaceAll('_',' ');
    if(item===null||item===undefined)return [[label,'Not recorded']];
    if(typeof item==='object')return Array.isArray(item)?[[label,`${item.length} entries`]]:displayMetrics(item,label,depth+1);
    if(typeof item==='boolean')return [[label,item?'Yes':'No']];
    return [[label,String(item)]];
  });
}
