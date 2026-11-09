import designs from '../data/v3RosterDesign.json';
import {V3_PAGE_NAMES,V3_PAGE_COOLDOWNS} from '../v3Combat';
const pages=designs.heroes.find(h=>h.canonicalId==='mirelle-vane')!.rPageSpells!;
export function MirellePatternBook(){return <section className="space-y-2" aria-label="Mirelle fabric patterns">
  <h5 className="font-black text-cyan-200">Ten fabric patterns</h5>
  {pages.map((page,i)=><details key={page.page} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs">
    <summary>{page.page}. {V3_PAGE_NAMES[i]} ? {V3_PAGE_COOLDOWNS[i]}s</summary>
    <p className="mt-2 text-slate-200">{page.requirementsAndEffect}</p><p className="mt-1 text-amber-200">Counterplay: {page.counterplay}</p>
  </details>)}
</section>;}
