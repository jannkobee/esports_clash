/** Original, transparent illustrated portraits. A person's UUID fixes their face through transfers. */
export function WorldPlayerPortrait({id,name,size=96,jersey='#39728c'}:{id:string;name:string;size?:number;jersey?:string}) {
  let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const pick=(offset:number,count:number)=>(seed>>>offset)%count;
  const skin=['#f3ccaa','#dfae85','#c88e64','#ad7050','#88533d','#603f34'][pick(0,6)];
  const hair=['#272527','#52382b','#805237','#d6b16b','#4a4442','#ad6742'][pick(5,6)];
  const accent=['#70e1d0','#f0b765','#8bb7ff','#e38ac8','#c9e475'][pick(27,5)];
  const style=pick(10,7),wide=pick(14,5),glasses=pick(18,5)===0,brow=pick(21,3),headset=pick(25,4)!==0;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width={size} height={Math.round(size*7/6)} role="img" aria-label={`${name}, illustrated player portrait`} className="world-player-portrait">
    <g stroke="#302c2a" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 140v-15q2-17 29-24h42q27 7 29 24v15" fill={jersey}/>
      <path d="m35 104 25 20 25-20-9-3H44Z" fill="#f1e9dc"/>
      <path d="M46 91v17q14 17 28 0V91" fill={skin}/>
      <path d="M46 97q14 10 28 0v7q-14 10-28-1" fill="#402b22" opacity=".17" stroke="none"/>
      <ellipse cx={33-wide/2} cy="68" rx="8" ry="12" fill={skin}/><ellipse cx={87+wide/2} cy="68" rx="8" ry="12" fill={skin}/>
      <path d={`M${34-wide} 42Q60 18 ${86+wide} 42l-1 32q-2 31-25 35Q37 105 ${35-wide} 74Z`} fill={skin}/>
      <path d="M48 77q12 8 24 0" fill="none" stroke="#714b38" opacity=".3"/>
      <path d="m60 67-4 16h8" fill="none" stroke="#81583f"/>
      <path d={brow===0?'m40 59 12-3m16 0 12 3':brow===1?'m40 56h12m16 0h12':'m40 58 12 1m16 0 12-1'} fill="none" stroke={hair} strokeWidth="3"/>
      <path d="M40 66q6-5 12 0m16 0q6-5 12 0" fill="#fff"/>
      <ellipse cx="47" cy="66" rx="2.2" ry="3" fill="#302c2a"/><ellipse cx="73" cy="66" rx="2.2" ry="3" fill="#302c2a"/>
      <path d={pick(23,2)?'M49 91q11 8 22-1':'M50 92q10 3 20-1'} fill="none" strokeWidth="2"/>
      {style===0?<path d="M31 58V40q2-25 29-25 27 0 30 25v18l-9-22q-21 8-42 0Z" fill={hair}/>:
       style===1?<path d="m31 62-2-23 8-9-3-12 16 4 9-13 11 12 17-4-1 14 7 9-4 22-9-25-12 7-9-8-19 8Z" fill={hair}/>:
       style===2?<path d="M31 61V39q4-22 29-22 21-1 29 19l1 22-9-13-1-11q-18 19-41 16Z" fill={hair}/>:
       style===3?<path d="M31 61q-8-12-1-20-4-12 6-16 0-12 14-10 10-8 20 0 16-4 17 10 13 5 7 16 5 11-5 19l-7-22q-9 7-16-1-9 8-17 0-8 6-10 0Z" fill={hair}/>:
       style===4?<path d="M31 58V40q3-22 29-22 28 0 29 22v18l-7-20q-22-13-44 0Z" fill={hair}/>:
       style===5?<path d="M31 67 27 42q2-27 33-28 31 1 32 28l-3 25-8-29q-16 18-43 9Z" fill={hair}/>:
       <path d="M31 60V39q1-21 29-21 27 0 29 21v21l-7-25q-22-10-44 0Z" fill={hair}/>}
      {glasses&&<g fill="none" stroke="#333b42" strokeWidth="2.4"><rect x="36" y="61" width="20" height="14" rx="4"/><rect x="64" y="61" width="20" height="14" rx="4"/><path d="M56 65h8m-33-2 5 2m48 0 5-2"/></g>}
      {pick(26,5)===0&&<path d="M42 89q2 15 18 17 16-2 18-17l-7 10-11-2-11 2Z" fill={hair} stroke="none" opacity=".75"/>}
      <path d="M27 119v21m66-21v21M56 123v17h8v-17" fill="none" stroke="#f1e9dc" strokeWidth="3"/>
      <path d="m18 140 10-20 8 4-6 16m72 0-10-20-8 4 6 16" fill="none" stroke={accent} strokeWidth="2.5" opacity=".9"/>
      <path d="M56 130h8m-8 5h8" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/>
    </g>
    {headset&&<g strokeLinejoin="round" strokeLinecap="round">
      <path d="M29 61V48Q30 17 60 16q30 1 31 32v13" fill="none" stroke="#202a31" strokeWidth="8"/>
      <path d="M29 58V47Q31 20 60 19q27 1 30 28v12" fill="none" stroke={accent} strokeWidth="2.5"/>
      <rect x="24" y="55" width="13" height="25" rx="5" fill="#26353d" stroke="#172128" strokeWidth="2"/>
      <rect x="83" y="55" width="13" height="25" rx="5" fill="#26353d" stroke="#172128" strokeWidth="2"/>
      <path d="M27 62v9m63-9v9" stroke={accent} strokeWidth="2"/>
      <path d="M91 77q7 6 3 12l-8 2" fill="none" stroke="#26353d" strokeWidth="3"/>
      <circle cx="85" cy="91" r="2" fill={accent} stroke="none"/>
    </g>}
    <path d="M39 112 60 128 81 112" fill="none" stroke={accent} strokeWidth="1.5" opacity=".75"/>
  </svg>;
}
