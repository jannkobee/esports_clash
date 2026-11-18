import {DatabaseSync} from 'node:sqlite';
import {applyFpsPlaybookRound,createFpsTeamPlaybook,loadFpsTeamPlaybook} from '../src/fps/fpsLivePlaybook.ts';
const db=new DatabaseSync('C:/Users/User/AppData/Local/Temp/claude/507d5b041df12d80/b9b2850f-a94b-476b-ac88-c0b91630bca5/scratchpad/soak/data/learning.sqlite',{readOnly:true});
const job=JSON.parse(db.prepare("SELECT body FROM jobs WHERE result IS NULL ORDER BY rowid DESC LIMIT 1").get().body);
console.log('job',job.id,job.mapId,JSON.stringify(job.lineages));
for(const team of ['blue','red']){
  const lineage=job.lineages[team];let book=loadFpsTeamPlaybook(structuredClone(job[team].playbooks?.[job.mapId]))??createFpsTeamPlaybook(job.mapId);
  console.log(team,lineage,'start rounds',book.rounds,'start loaded?',!!job[team].playbooks?.[job.mapId]);
  const recs=db.prepare("SELECT body FROM records WHERE id LIKE ? AND kind='playbook' ORDER BY rowid").all(job.id+'%').map(r=>JSON.parse(r.body)).filter(r=>r.lineage===lineage);
  for(const r of recs){try{const c=applyFpsPlaybookRound(book,r.payload.round);if(c.innovated)console.log('  innovated',c.innovated,'at',r.payload.round.id);}catch(e){console.log('  FAIL at',r.payload.round.id,r.payload.round.playId,'known variants',Object.keys(book[r.payload.round.side]).filter(k=>k.startsWith('v:')));break;}}
}
