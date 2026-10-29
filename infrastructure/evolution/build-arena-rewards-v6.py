"""Create a fresh reward revision, preserving the factual v5 model/observations.

No old artifacts are rewritten; changing rewards does not itself train weights.
"""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];data=ROOT/'EsportsClash.Web/src/data'
book=json.loads((data/'arenaPlaybookV5.json').read_text(encoding='utf-8'))
config=json.loads((data/'arenaOutcomeRewardV2.json').read_text())
book.update(version=6,title='Clash Arena: factual kit learning with outcome-based rewards')
book['rewards']={'version':config['version'],'configuration':config,'directions':[
 'Winning by destroying the enemy Nexus earns a terminal outcome of +5 before time discount; losing earns -5. The previous reward was +1/-1. Censored matches never receive a win or loss.',
 'The per-second discount is 0.9998. A win at 1,200 seconds retains about 79% of its terminal value; the previous 0.999 discount retained about 30%. Longer-term outcomes can influence learning more.',
 'The bounded team-progress potential weights actual structure progress at 50%, economy advantage at 15%, favorable team trades at 15%, living team health at 10%, Dragon captures at 4%, Siege Golem captures at 4% and mana readiness at 2%. These percentages describe shaping weights, not win probabilities or guaranteed strategy.',
 'Actual fractional damage to the real structure roster counts as progress, including deeper objectives. Overkill and repeated commands to a protected building do not increase that progress. Losing your own structures decreases the same signal.',
 'Economy includes held gold and purchased items, so buying an item does not erase earned resources. Team deaths, lost health and spent mana can reduce progress; a decisive trade or protective spell can still be worthwhile because winning remains the objective.',
 'Objective captures are counted when the real boss is secured. Consuming the captured siege unit successfully does not erase the capture count. Counts are bounded in the potential and cannot replace a terminal win.',
 'No direct reward is granted for clicking the enemy base, walking distance, casting, missing, overkill, raw damage dealt or raw damage taken. All avatars use the same team formula; supports and tanks are not scored by a personal damage quota.',
 'The shaping reward is a discounted difference in bounded state potential, closed to zero at real termination. Repeating a damage/heal, mana recovery or movement cycle cannot add a separate cumulative bonus. This is a training aid, not a guarantee that a finite neural learner will discover good play.',
 'The critic carries the seven actual outcome features and uses a longer 0.98-per-second advantage trace. The Python learner independently checks discounts, component totals and terminal outcomes before updating.',
 'Reward changes affect subsequent optimization. The starting model bytes are unchanged and retain the known forward/structure preference; there is no claim that base clicking disappears immediately or that more wins have already been measured.',
 'Internal ML scores do not mint club coins, card XP or prizes. New checkpoints remain experimental until independent complete matched games establish improvement.'
]}
book_bytes=(json.dumps(book,indent=2,ensure_ascii=False)+'\n').encode()
parent=(data/'arena-v5/arenaFoundation.json').read_bytes();model_hash=hashlib.sha256(parent).hexdigest()
metadata={'kind':'reward-only-factual-foundation-revision','revision':6,'parent_foundation_sha256':model_hash,
 'playbook_version':6,'playbook_sha256':hashlib.sha256(book_bytes).hexdigest(),'reward_version':config['version'],
 'actor_version':3,'input':224,'new_optimizer_updates':0,'avatar_specific_teacher_used':False,'avatar_specific_rewards':False,
 'starting_forward_structure_bias_removed':False,'gameplay_improvement_measured':False}
outputs={data/'arenaPlaybookV6.json':book_bytes,data/'arena-v6/arenaFoundation.json':parent,
 data/'arena-v6/arenaFoundationTeaching.json':(json.dumps(metadata,indent=2)+'\n').encode(),
 ROOT/'EsportsClash.Api/resources/game/arena-playbook-v6.json':book_bytes,
 ROOT/'EsportsClash.Api/resources/game/arena-teaching-v6.json':(json.dumps({'version':6,
 'playbook_sha256':hashlib.sha256(book_bytes).hexdigest(),'foundation_sha256':model_hash},indent=2)+'\n').encode()}
for path,contents in outputs.items():
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and path.read_bytes()!=contents:raise ValueError('Frozen reward revision already exists with different bytes')
 path.write_bytes(contents)
print(json.dumps({'version':6,'reward':config['version'],'model_bytes_unchanged':True}))
