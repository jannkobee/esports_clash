"""Publish kit facts and adapt the GENERAL foundation, without avatar teachers.

This is not model fitting: extra factual inputs start with zero weights and are
learned during real self-play. Historical role-guided artifacts stay immutable.
"""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];data=ROOT/'EsportsClash.Web/src/data'
catalog=json.loads((ROOT/'EsportsClash.Api/resources/game/catalog.json').read_text())
old=json.loads((data/'arenaPlaybookV3.json').read_text())
book={'version':5,'title':'Clash Arena: game rules, kit facts and learning through experience',
 'scope':'Factual reference for a shared learned controller. There are no authored per-avatar playstyles or role-specific reward weights. Strategies must be learned from match experience.',
 'mechanics':old['mechanics'],
 'lessons':[
  {'id':'kit-facts','title':'Understand the information supplied to the learner','directions':[
   'Your own health, mana, level, cooldowns, shields, attack reach and legal commands are observations. They describe what is possible, not which action to select.',
   'Each own or visible target kit is represented by base stats, roles, and ability damage, cooldown, scaling, damage type and described control, protection, mobility and channel properties.',
   'These kit features are derived automatically from the playable catalog. A new avatar does not require a handwritten strategy entry. The engine must still implement its mechanics correctly.',
   'Capability flags currently summarize catalog descriptions; they are not a full simulation of every passive, combo, travel path or spell interaction. Missing observations can limit what the policy learns.']},
  {'id':'discovery','title':'Discover strategy through actual matches','directions':[
   'The policy may explore any mechanically legal choice. No role script forces a tank to engage, a support to protect or an assassin to chase.',
   'All avatars share the team win/loss objective and the same team-progress potential. There is no bonus for acting like an authored avatar guide, casting often or taking damage.',
   'Shared kit features allow experience with one ability pattern to help another. A new kit still needs exploration and evaluation; transfer is not guaranteed.',
   'The starting model retains basic generic command preferences from an earlier foundation. Extra kit and card inputs begin with zero weights and learn from self-play; this is not a from-scratch experiment.',
   'Training duration, changed decisions and optimization loss cannot establish professional skill. Independent complete matches against capable opponents must establish improvement.']}],
 'player_identity':[
  'A player card and an avatar are separate identities. The card supplies its stable ID, six attributes, preferred-role fit, signatures, morale, fatigue and both personality categories.',
  'Identities and attributes are observations, not extra damage, range, immunity or a mandatory personality script. Fictional card aliases remain presentation only.',
  'Avatar names and IDs identify reports; the current actor uses transferable kit facts instead of a fixed 45-avatar one-hot table. Identical kits have identical kit inputs even with a new ID.',
  'A shared policy can develop different decisions for different kits and card contexts. Per-card or per-avatar mastery must be measured rather than inferred from seeing that identity in training.'],
 'knowledge_only':True,'roles':[],
 'avatars':[{'id':a['id'],'name':a['displayName'],'role':a['primaryRole'],'archetype':a['archetype'],
             'abilities':[{'slot':s,'name':a[s]['name'],'description':a[s]['desc']} for s in ['skill1','skill2','ultimate']]} for a in catalog['avatars']],
 'rewards':{'version':'terminal-potential-v1','directions':[
  'Every avatar has the same actual Nexus win/loss objective. Common discounted potential shaping reflects team deaths, structures, economy, health and objectives; the potential closes to zero at real termination.',
  'Confirmed health damage, objective damage and control-follow-up counters are diagnostics. No avatar-specific weights turn them into personal rewards in this version.',
  'Internal training scores update model weights. Club coins, card XP and prizes are separate game systems.',
  'Interrupted matches cannot train. Full-cap censored unrolls bootstrap and receive no fabricated terminal win. Independent qualification still requires complete fresh matched games.']}}
book_bytes=(json.dumps(book,ensure_ascii=False,indent=2)+'\n').encode()
(data/'arenaPlaybookV5.json').write_bytes(book_bytes)
parent_bytes=(data/'arena-v3/arenaFoundation.json').read_bytes();policy=json.loads(parent_bytes)
policy.update(version=3,input=224,w1=[row+[0.]*176 for row in policy['w1']])
folder=data/'arena-v5';folder.mkdir(exist_ok=True)
policy_bytes=json.dumps(policy,separators=(',',':')).encode()
for name,contents in [('arenaFoundation.json',policy_bytes),('arenaFoundationTeaching.json',json.dumps({
 'kind':'general-foundation-factual-input-adapter','revision':5,'parent_foundation_sha256':hashlib.sha256(parent_bytes).hexdigest(),
 'playbook_version':5,'playbook_sha256':hashlib.sha256(book_bytes).hexdigest(),'observation_schema':'transferable-kit-facts-224-v3',
 'avatar_specific_teacher_used':False,'avatar_specific_rewards':False,'new_fitted_examples':0,
 'extra_input_weights_initially_zero':True,'gameplay_improvement_measured':False,'video_examples':0,
 'limitation':'General starting command preferences are inherited; kit/card context is learned from subsequent self-play.'},indent=2).encode())]:
    target=folder/name
    if target.exists() and target.read_bytes()!=contents:raise ValueError('Do not overwrite an existing frozen factual foundation')
    target.write_bytes(contents)
api=ROOT/'EsportsClash.Api/resources/game'
(api/'arena-playbook-v5.json').write_bytes(book_bytes)
(api/'arena-teaching-v5.json').write_text(json.dumps({'version':5,'playbook_sha256':hashlib.sha256(book_bytes).hexdigest(),
 'foundation_sha256':hashlib.sha256(policy_bytes).hexdigest()},indent=2)+'\n')
lines=['# Learning from kit facts instead of avatar strategy guides','','The current version uses factual inputs and self-play. It has no authored per-avatar strategy or reward weights.','']
lines+=['## '+l['title']+'\n\n'+'\n'.join('- '+s for s in l['directions'])+'\n' for l in book['lessons']]
lines+=['## Player card identity\n\n'+'\n'.join('- '+s for s in book['player_identity']),
        '\n## Shared learning objective\n\n'+'\n'.join('- '+s for s in book['rewards']['directions'])]
(ROOT/'docs/arena-learning-kit-facts.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'version':5,'avatars':len(book['avatars']),'model_version':3,'avatar_strategy_teacher':False}))
