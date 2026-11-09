"""Durable v3 intelligence studies. Fixed judge; no generated commands or evaluator edits."""
import base64
import fcntl
import hashlib
import hmac
import json
import math
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from operations import Operations

TOOLS = Path(os.environ.get('INTELLIGENCE_TOOLS', '/workspace/infrastructure/evolution'))
WEB = Path(os.environ.get('INTELLIGENCE_WEB', '/workspace/EsportsClash.Web'))
MATCH_SECONDS = 900
ACCEPTANCE={'version':1,'minimumIndependentSeeds':32,'minimumDrafts':2,'confidence':.95,'minimumWinDelta':0,
            'maximumExtraTeamDeathCases':0,'requireTerminal':True,'requireRepeatedControls':True,'requireHistoricalOpponents':True}
FIELDS = {'version','policy_scope','domain','seed_start','reservation','max_minutes','total_minutes',
          'generations','training_matches','evaluation_seeds','incumbent','incumbent_id','opponents','automatic_promotion'}

def arena_mode(plan):return plan['version']==4 and plan['domain']=='arena'
def acceptance(plan):return {**ACCEPTANCE,'version':2,'maximumExtraTeamDeathCases':None} if arena_mode(plan) else ACCEPTANCE
def reference_policy(plan,policy):
    if arena_mode(plan):
        p=json.loads(json.dumps(policy));p['w2'][0]+=.1;return p
    return {**policy,'farmStrategic':.52,'farmTactical':.46,'farmConversionTactical':.75}
def training_metrics(folder):
    return [read(p) for p in sorted((folder/'checkpoints').glob('metrics-*.json'),key=lambda p:int(p.stem.split('-')[-1]))]


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def read(path):
    return json.loads(path.read_text())


def write(path, value, immutable=False):
    data = json.dumps(value, allow_nan=False, indent=2) + '\n'
    if immutable:
        if path.exists():
            if path.read_text() != data: raise ValueError('Immutable artifact mismatch: ' + path.name)
            return
        with path.open('x') as file: file.write(data); file.flush(); os.fsync(file.fileno())
    else:
        temporary = path.with_suffix(path.suffix+'.tmp')
        with temporary.open('w') as file: file.write(data); file.flush(); os.fsync(file.fileno())
        temporary.replace(path)


def validate_plan(plan, run_id, token):
    if set(plan) != FIELDS|({'teaching','initialization'} if plan.get('version')==4 else set()) or plan['version'] not in (3,4) or plan['policy_scope'] != 'autonomous-intelligence':
        raise ValueError('Unsupported intelligence plan')
    if (plan['domain'] not in (('arena',) if plan['version']==4 else ('parameter','marl','source'))) or plan['automatic_promotion'] is not False:
        raise ValueError('Unsupported optimization domain')
    for field, lower, upper in [('seed_start',56001,999000),('max_minutes',16,90),('total_minutes',16,10080),
                                ('generations',1,8),('training_matches',1,16),('evaluation_seeds',32,32)]:
        if type(plan[field]) is not int or not lower <= plan[field] <= upper: raise ValueError('Invalid '+field)
    receipt = plan['reservation']
    payload = base64.b64decode(receipt['payload'], validate=True)
    if not token or not hmac.compare_digest(receipt['signature'],hmac.new(token.encode(),payload,hashlib.sha256).hexdigest()):
        raise ValueError('Unverified database seed reservation')
    if json.loads(payload) != {'run_id':run_id,'domain':plan['domain'],'first':plan['seed_start'],'count':1000}:
        raise ValueError('Reservation does not bind this study')
    if not isinstance(plan['opponents'],list) or len(plan['opponents']) > 64: raise ValueError('Invalid opponent league')
    if plan['total_minutes']<plan['max_minutes']:raise ValueError('Total budget smaller than invocation')
    if arena_mode(plan):
        teaching=plan['teaching']
        if set(teaching)!={'version','playbook_sha256','foundation_sha256'} or teaching['version'] not in (3,4,5,6):
            raise ValueError('Unsupported arena teaching version')
        for key in ('playbook_sha256','foundation_sha256'):
            value=teaching[key]
            if not isinstance(value,str) or len(value)!=64 or any(c not in '0123456789abcdef' for c in value):raise ValueError('Invalid teaching hash')
        initial=plan['initialization']
        if initial is not None:
            if set(initial)!={'id','policy_bytes','source_hash','run_id'}:raise ValueError('Invalid experimental initialization')
            data=base64.b64decode(initial['policy_bytes'],validate=True)
            if sha(data)!=initial['id'] or json.loads(data).get('kind')!='arena-actor':raise ValueError('Invalid experimental initialization')
    return True


class Pause(Exception): pass
class ResourcePause(Exception): pass


class Study:
    def __init__(self, folder):
        self.folder=folder; self.plan=read(folder/'plan.json'); self.started=time.monotonic()
        self.stopped=False; self.active=None
        validate_plan(self.plan,folder.name,os.environ.get('EVOLUTION_WORKER_TOKEN',''))
        self.journal=read(folder/'journal.json') if (folder/'journal.json').exists() else {'seconds':0,'invocations':0}
        self.journal['invocations']+=1
        for name in ('raw','tools','checkpoints','source'): (folder/name).mkdir(exist_ok=True)
        self.budget=min(self.plan['max_minutes']*60,self.plan['total_minutes']*60-self.journal['seconds'])
        # Reserve the whole invocation before spawning children. Abrupt death is
        # charged this reservation; orderly checkpoints refund unused seconds.
        self.journal['seconds']+=max(0,self.budget)
        write(folder/'journal.json',self.journal)
        signal.signal(signal.SIGTERM,self.stop); signal.signal(signal.SIGINT,self.stop)

    def stop(self,*_):
        self.stopped=True
        if self.active and self.active.poll() is None: os.killpg(self.active.pid,signal.SIGTERM)

    def check(self, required=0):
        if self.stopped or (self.folder/'cancel').exists(): raise InterruptedError('Owner cancelled; evidence retained')
        if self.budget-(time.monotonic()-self.started)<required: raise Pause('Invocation budget reached; checkpoint retained')

    def command(self,args,timeout):
        self.check()
        with (self.folder/'worker-detail.log').open('ab') as log:
            self.active=subprocess.Popen(args,cwd=WEB,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            try:
                self.active.wait(timeout=timeout)
                if self.stopped: raise InterruptedError('Cancelled')
                if self.active.returncode: raise RuntimeError('Trusted command failed; inspect worker-detail.log')
            except subprocess.TimeoutExpired:
                os.killpg(self.active.pid,signal.SIGTERM)
                try:self.active.wait(timeout=5)
                except subprocess.TimeoutExpired:os.killpg(self.active.pid,signal.SIGKILL);self.active.wait()
                raise RuntimeError('Trusted command timeout')
            finally:self.active=None

    def tool(self,action,value):
        key=sha({'action':action,'value':value}); request=self.folder/'tools'/(key+'.input.json'); output=self.folder/'tools'/(key+'.json')
        write(request,value,True)
        if not output.exists(): self.command(['node','--experimental-strip-types',str(TOOLS/'intelligence-tools.mjs'),action,str(request),str(output)],90)
        return read(output)

    def manifest(self):
        # Never cache a source check on recovery.
        nonce=self.journal['invocations']
        current=self.tool('manifest',{'invocation':nonce,**({'engine':'arena'} if arena_mode(self.plan) else {})})
        worker={p.name:sha(p.read_bytes()) for p in Path(__file__).parent.glob('*.py')}
        current['worker']=worker
        current['runtime']={'python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),
                            'chromium':subprocess.check_output(['chromium','--version'],text=True).strip()}
        return current

    def episode(self,item,label):
        key=sha({'item':item,'label':label}); path=self.folder/'raw'/(key+'.json')
        if path.exists():
            raw=read(path)
            if raw['item']!=item: raise ValueError('Cached match allocation mismatch')
            witness=read(path.with_suffix('.sha.json'))
            if sha(path.read_bytes())!=witness['sha256']:raise ValueError('Cached raw evidence corrupted')
            return raw
        self.check(MATCH_SECONDS+10) # Do not begin a match at the end of a budget window.
        manager=Operations(self.folder.parent)
        try:pressure=manager.pressure()
        finally:manager.db.close()
        if pressure:raise ResourcePause(pressure)
        marker=path.with_suffix('.attempt.json')
        if marker.exists():
            return {'item':item,'episode':{'status':'incomplete','reason':'interrupted-prior-attempt'},'rows':[]}
        request=path.with_suffix('.request.json');write(request,item,True)
        write(marker,{'itemHash':sha(item),'label':label,'started':time.time()},True)
        self.command(['node',str(TOOLS/'episode-host.mjs'),str(request),str(path)],MATCH_SECONDS+90)
        write(path.with_suffix('.sha.json'),{'sha256':sha(path.read_bytes())},True)
        return read(path)

    def progress(self,stage,**values):
        if arena_mode(self.plan):
            values['training']=training_metrics(self.folder)
        write(self.folder/'state.json',{'status':'running','progress':{'domain':self.plan['domain'],'stage':stage,**values}})

    def baseline(self):
        results=[]
        for swapped in (False,True):
            for repeat in (0,1):
                self.progress('baseline',complete=len(results),planned=4)
                results.append(self.episode({'seed':47,'draft':2,'swapped':swapped,'maxSeconds':1200,'wallSeconds':MATCH_SECONDS,
                    **({'controller':'arena'} if arena_mode(self.plan) else {})},'baseline-'+str(repeat)))
        for a,b in ((results[0],results[1]),(results[2],results[3])):
            allowed=('terminal','censored') if arena_mode(self.plan) else ('terminal',)
            if a['episode']['status'] not in allowed or b['episode']['status'] not in allowed:raise ValueError('Full-match baseline incomplete')
            if stable(a)!=stable(b):raise ValueError('Baseline controls diverged')
        write(self.folder/'baseline.json',{'verified':True,'sourceHash':self.execution['sourceHash'],'results':[sha(r) for r in results],
            **({'scope':'repeatability-only','terminal':sum(r['episode']['status']=='terminal' for r in results),
                'censored':sum(r['episode']['status']=='censored' for r in results),'benefitEvidence':False} if arena_mode(self.plan) else {})},True)

    def train(self):
        domain=self.plan['domain']; seed=self.plan['seed_start']; incumbent=self.plan['incumbent'] or self.execution['defaultPolicy']
        if arena_mode(self.plan):return self.train_arena(incumbent)
        if domain=='marl':
            from marl import Learner
            learner=Learner(seed); metadata={'execution':sha(self.execution),'plan':sha(self.plan)}
            learner.initialize_actor(incumbent)
            state_path=self.folder/'learning.json'; state=read(state_path) if state_path.exists() else {'generation':0,'history':[]}
            checkpoint=self.folder/'checkpoints'/('generation-'+str(state['generation'])+'.pt')
            if state['generation']:learner.load(checkpoint,metadata)
            for generation in range(state['generation'],self.plan['generations']):
                policy=learner.export(); episodes=[]
                # Historical snapshots are immutable; opponent rows are excluded from PPO.
                league=[incumbent]+[p['policy'] for p in self.plan['opponents']]+state['history']
                for match in range(self.plan['training_matches']):
                    self.progress('self-play',generation=generation,match=match,planned=self.plan['training_matches'])
                    own='blue' if match%2==0 else 'red'; enemy='red' if own=='blue' else 'blue'
                    item={'seed':seed+generation*16+match,'draft':2+match%2,'swapped':match%2==1,
                          'maxSeconds':1200,'wallSeconds':MATCH_SECONDS,'training':True,
                          'policies':{own:policy,enemy:league[(generation+match)%len(league)]}}
                    raw=self.episode(item,'training-'+str(generation))
                    # Train both teams only when both actually used this exact actor.
                    filtered={**raw,'rows':[r for r in raw['rows'] if r['team']==own]};episodes.append(filtered)
                self.check(30)
                metrics=learner.update(episodes)
                self.progress('trained',generation=generation+1,metrics=metrics)
                write(self.folder/'checkpoints'/('metrics-'+str(generation)+'.json'),metrics,True)
                state['history'].append(policy);state['generation']=generation+1
                learner.save(self.folder/'checkpoints'/('generation-'+str(generation+1)+'.pt'),metadata)
                write(state_path,state)
            return learner.export()
        if domain=='parameter':
            candidates=self.tool('propose',{'policy':incumbent,'seed':seed})
        else:
            # Deterministic, bounded algorithm hypotheses. No arbitrary executable payloads.
            candidates=[]
            # Seeded search around the retained program, guided by the common
            # stagnation symptom: little optional-action differentiation.
            parent=incumbent if incumbent.get('kind')=='macro-program' else None
            for direction in (-1,1):
                weights=[[0.]*20 for _ in range(5)];bias=[0.]*5
                weights[0][0]=direction*.4;weights[0][16]=-direction*.5
                weights[3][8]=-direction*.3;weights[3][18]=direction*.2
                weights[4][17]=direction*.5;weights[4][18]=direction*.3
                scale=.5+(seed%997)/1994
                weights=[[v*scale for v in row] for row in weights]
                if parent:
                    weights=[[max(-2,min(2,parent['weights'][a][f]+weights[a][f])) for f in range(20)] for a in range(5)]
                    bias=parent['bias'][:]
                candidates.append({'kind':'macro-program','version':1,'weights':weights,'bias':bias})
            for i,candidate in enumerate(candidates):
                proof=self.tool('source',{'policy':candidate,'folder':str(self.folder/'source'/str(i))})
                write(self.folder/'source'/('proposal-'+str(i)+'.json'),proof,True)
        fitting=[]
        for i,candidate in enumerate(candidates):
            rows=[]
            for offset in (0,1):
                for swapped in (False,True):
                    self.progress('fitting',candidate=i,seed=seed+offset)
                    row=self.pair(candidate,{'seed':seed+offset,'draft':2+offset,'swapped':swapped,'opponentHash':sha(incumbent)},incumbent,'fit')
                    rows.append(row)
            if all(r['status']=='terminal' and r['controlsMatch'] for r in rows):
                fitting.append({'candidate':candidate,'score':sum(r['winDelta'] for r in rows)/len(rows)})
        if not fitting:raise ValueError('No reproducible fitting candidate')
        write(self.folder/'fitting.json',fitting,True)
        return sorted(fitting,key=lambda r:(-r['score'],sha(r['candidate'])))[0]['candidate']

    def train_arena(self,incumbent):
        from arena_marl import ArenaLearner
        initial=self.plan['initialization'];starting=json.loads(base64.b64decode(initial['policy_bytes'])) if initial else (
            self.execution['defaultPolicy'] if self.plan['teaching']['version']>=4 else incumbent)
        learner=ArenaLearner(self.plan['seed_start'],starting['input'],starting['version'],
            'terminal-potential-outcomes-v2' if self.plan['teaching']['version']==6 else 'terminal-potential-v1')
        learner.initialize_actor(starting)
        metadata={'execution':sha(self.execution),'plan':sha(self.plan)}
        state_path=self.folder/'learning.json';state=read(state_path) if state_path.exists() else {'generation':0,'history':[]}
        if state['generation']:learner.load(self.folder/'checkpoints'/('generation-'+str(state['generation'])+'.pt'),metadata)
        total_updates=self.plan['generations']*self.plan['training_matches']
        for update in range(state['generation'],total_updates):
            generation,match=divmod(update,self.plan['training_matches'])
            policy=learner.export();league=[incumbent]+[p['policy'] for p in self.plan['opponents']]+state['history']
            self.progress('self-play',generation=update,match=match,planned=total_updates)
            own='blue' if update%2==0 else 'red';enemy='red' if own=='blue' else 'blue'
            item={'seed':self.plan['seed_start']+generation*16+match,'draft':2+update%2,'swapped':update%2==1,
                  'maxSeconds':1200,'wallSeconds':MATCH_SECONDS,'training':True,'controller':'arena',
                  'compactTrajectories':True,'learningTeam':own,
                  'policies':{own:policy,enemy:league[update%len(league)]}}
            raw=self.episode(item,'arena-training-'+str(update))
            self.check(30);metrics=learner.update([raw]);policy=learner.export()
            del raw
            write(self.folder/'checkpoints'/('metrics-'+str(update)+'.json'),metrics,True)
            learner.save(self.folder/'checkpoints'/('generation-'+str(update+1)+'.pt'),metadata)
            candidate={'policy':policy,'hash':sha(policy),'source_hash':self.execution['sourceHash'],
                       'generation':update+1,'metrics':metrics,'qualification':'learning','run_id':self.folder.name}
            write(self.folder/'checkpoints'/('candidate-'+str(update+1)+'.json'),candidate,True)
            write(self.folder/'live-checkpoint.json',candidate)
            state['history'].append(policy);state['generation']=update+1;write(state_path,state)
            self.progress('trained',generation=update+1,metrics=metrics)
        return learner.export()

    def pair(self,candidate,item,opponent,label):
        team='red' if item['swapped'] else 'blue';enemy='blue' if team=='red' else 'red'
        incumbent=self.plan['incumbent'] or self.execution['defaultPolicy']
        base={'seed':item['seed'],'draft':item['draft'],'swapped':item['swapped'],'maxSeconds':1200,'wallSeconds':MATCH_SECONDS,
              'policies':{team:incumbent,enemy:opponent},**({'controller':'arena'} if arena_mode(self.plan) else {})}
        control=self.episode(base,label+'-control');repeat=self.episode(base,label+'-repeat')
        challenger=self.episode({**base,'policies':{team:candidate,enemy:opponent}},label+'-challenger-'+sha(candidate))
        envelope={'item':item,'candidateHash':sha(candidate),'sourceHash':self.execution['sourceHash'],
                  'control':control,'repeat':repeat,'challenger':challenger}
        raw=self.folder/'raw'/(sha(envelope)+'.pair.json');write(raw,envelope,True)
        return observation(envelope,sha(raw.read_bytes()))

    def run(self):
        current=self.manifest();execution_path=self.folder/'execution.json'
        if execution_path.exists():
            prior=read(execution_path)
            for key in ('source','sourceHash','judge','acceptance','worker','runtime'):
                if prior[key]!=current[key]:raise ValueError('Frozen simulation/judge changed; cannot resume')
            self.execution=prior
        else:
            self.execution={**current,'planHash':sha(self.plan),'started_unix':time.time()};write(execution_path,self.execution,True)
        if self.execution['planHash']!=sha(self.plan):raise ValueError('Plan changed')
        if arena_mode(self.plan):
            files=dict(self.execution['source']);teaching=self.plan['teaching']
            version=teaching['version']
            if files.get(f'src/data/arenaPlaybookV{version}.json')!=teaching['playbook_sha256'] or files.get(f'src/data/arena-v{version}/arenaFoundation.json')!=teaching['foundation_sha256']:
                raise ValueError('Frozen teaching materials do not match this engine')
            if self.plan['initialization']:
                if self.plan['initialization']['source_hash']!=self.execution['sourceHash']:raise ValueError('Incompatible prior learning checkpoint')
                self.tool('validate',json.loads(base64.b64decode(self.plan['initialization']['policy_bytes'])))
        if self.execution['acceptance']!=acceptance(self.plan):raise ValueError('Frozen acceptance threshold changed')
        if not (self.folder/'checks.json').exists():
            self.progress('software-checks');self.check(750 if arena_mode(self.plan) else 300)
            self.command(['npm','run','check:game'],600 if arena_mode(self.plan) else 240)
            self.command(['npm','run','build'],120)
            if arena_mode(self.plan) and self.plan['teaching']['version']==6:
                self.command(['node','--test',str(TOOLS/'trajectory-storage.test.mjs')],60)
            write(self.folder/'checks.json',{'check_game':True,'build':True,'executionHash':sha(self.execution)},True)
        self.baseline()
        frozen_path=self.folder/'freeze.json'
        if frozen_path.exists():candidate=read(frozen_path)['policy']
        else:
            candidate=self.train();self.tool('validate',candidate)
            write(frozen_path,{'policy':candidate,'hash':sha(candidate),'executionHash':sha(self.execution)},True)
        incumbent=self.plan['incumbent'] or self.execution['defaultPolicy']
        # Every retained historical opponent plus a fixed distinct authored reference.
        opponents={sha(incumbent):incumbent}
        for p in self.plan['opponents']:opponents[sha(p['policy'])]=p['policy']
        reference=reference_policy(self.plan,self.execution['defaultPolicy'])
        opponents[sha(reference)]=reference
        cases=[{'seed':self.plan['seed_start']+256+i,'draft':2+i%2,'swapped':swapped,'opponentHash':identity}
               for i in range(32) for identity in opponents for swapped in (False,True)]
        evaluation={'acceptance':self.execution['acceptance'],'sourceHash':self.execution['sourceHash'],
                    'candidateHash':sha(candidate),'incumbentHash':sha(incumbent),'seedReservationVerified':True,'evaluationCases':cases}
        write(self.folder/'evaluation-plan.json',evaluation,True)
        observations=[]
        for item in cases:
            complete=[r for r in observations if r['status']=='terminal' and r['controlsMatch']]
            partial={'terminal':len(complete),'wins_gained':sum(r['winDelta']>0 for r in complete),
                     'wins_lost':sum(r['winDelta']<0 for r in complete),'unchanged':sum(r['winDelta']==0 for r in complete)}
            self.progress('held-out',complete=len(observations),planned=len(cases),candidate=sha(candidate),partial=partial)
            observations.append(self.pair(candidate,item,opponents[item['opponentHash']],'held-out'))
            write(self.folder/'observations.json',observations)
        assessment=self.tool('assess',{'plan':evaluation,'observations':observations})
        # Recompute from immutable raw match envelopes before declaring eligibility.
        evidence=qualify(self.folder)
        if any(evidence['assessment'][k]!=assessment[k] for k in ('status','reasons','measured','independentSeeds','extraTeamDeathCases')):
            raise ValueError('Independent judge mismatch')
        write(self.folder/'state.json',{'status':'completed','progress':{'stage':'complete'},'result':evidence})


def stable(raw):
    e=raw['episode'];return {'states':e.get('states'),'result':e.get('result'),'second':e.get('second')}


def observation(envelope,raw_hash):
    item=envelope['item'];team='red' if item['swapped'] else 'blue'
    control,repeat,challenger=[envelope[k] for k in ('control','repeat','challenger')]
    terminal=all(r['episode']['status']=='terminal' for r in (control,repeat,challenger))
    if terminal:
        for raw in (control,repeat,challenger):
            episode=raw['episode'];result=episode.get('result',{});stats=result.get('stats',[]);states=episode.get('states',[])
            if result.get('winner') not in ('blue','red') or len(stats)!=10 or len({u.get('id') for u in stats})!=10:
                raise ValueError('Malformed terminal roster/result')
            if any(sum(u.get('team')==side for u in stats)!=5 for side in ('blue','red')):
                raise ValueError('Malformed terminal teams')
            if any(type(u.get('deaths')) is not int or u['deaths']<0 for u in stats):raise ValueError('Invalid death telemetry')
            if not states or states[0].get('second')!=0 or not states[-1].get('finished') or not 0<episode.get('second',0)<=1200:
                raise ValueError('Terminal match lacks complete states')
        if control['episode']['states'][0]!=challenger['episode']['states'][0]:raise ValueError('Initial worlds differ')
    row={**item,'sourceHash':envelope['sourceHash'],'candidateHash':envelope['candidateHash'],'rawHash':raw_hash,
         'status':'terminal' if terminal else 'incomplete','controlsMatch':stable(control)==stable(repeat)}
    if terminal:
        results=[r['episode']['result'] for r in (control,challenger)]
        deaths=[sum(u['deaths'] for u in r['stats'] if u['team']==team) for r in results]
        row.update(winDelta=int(results[1]['winner']==team)-int(results[0]['winner']==team),teamDeathDelta=deaths[1]-deaths[0])
    return row


def qualify(folder):
    plan=read(folder/'evaluation-plan.json');candidate=read(folder/'freeze.json')
    original=read(folder/'plan.json');execution=read(folder/'execution.json')
    validate_plan(original,folder.name,os.environ.get('EVOLUTION_WORKER_TOKEN',''))
    if execution['planHash']!=sha(original) or candidate['executionHash']!=sha(execution):raise ValueError('Frozen provenance mismatch')
    if plan['sourceHash']!=execution['sourceHash'] or plan['acceptance']!=execution['acceptance'] or not plan['seedReservationVerified']:
        raise ValueError('Judge contract changed')
    if plan['acceptance']!=acceptance(original):raise ValueError('Acceptance criteria changed')
    if read(folder/'checks.json')!={'check_game':True,'build':True,'executionHash':sha(execution)}:raise ValueError('Missing software checks')
    cases=plan['evaluationCases'];seen=set()
    for case in cases:
        key=(case['seed'],case['draft'],case['swapped'],case['opponentHash'])
        if key in seen or not original['seed_start']+256<=case['seed']<original['seed_start']+288:
            raise ValueError('Duplicate or unreserved evaluation world')
        seen.add(key)
    if len({c['seed'] for c in cases})!=32:raise ValueError('Held-out seed count changed')
    if sha(candidate['policy'])!=candidate['hash']:raise ValueError('Frozen policy hash changed')
    if original['domain']=='source':
        matching=[]
        for proof_path in (folder/'source').glob('proposal-*.json'):
            proof=read(proof_path)
            if proof.get('policy')!=candidate['policy']:continue
            index=proof_path.stem.split('-')[-1]
            if not index.isdigit():raise ValueError('Invalid source proposal identity')
            generated=folder/'source'/index/'macroCandidate.ts'
            if proof.get('allowlist')!=['macroCandidate.ts'] or proof.get('tests')!={'typecheck':True,'compiledInterpreterParity':65}:
                raise ValueError('Source candidate lacks required compiler/parity checks')
            if sha(generated.read_bytes())!=proof.get('sourceHash'):raise ValueError('Source candidate changed after compilation')
            matching.append(proof)
        if len(matching)!=1:raise ValueError('Missing or ambiguous compiled source candidate')
    incumbent=original['incumbent'] or execution['defaultPolicy']
    opponents={sha(incumbent):incumbent}
    for p in original['opponents']:opponents[sha(p['policy'])]=p['policy']
    reference=reference_policy(original,execution['defaultPolicy'])
    opponents[sha(reference)]=reference
    expected=[{'seed':original['seed_start']+256+i,'draft':2+i%2,'swapped':swapped,'opponentHash':identity}
              for i in range(32) for identity in opponents for swapped in (False,True)]
    if cases!=expected:raise ValueError('Predeclared side/draft/opponent coverage changed')
    if sha(candidate['policy'])!=plan['candidateHash']:raise ValueError('Candidate hash mismatch')
    rows=[];outcomes={'control_wins':0,'challenger_wins':0,'terminal_pairs':0};behavior={'eligible':0,'changed':0,'intents_recorded':0}
    comparison={k:{'control':0.,'candidate':0.} for k in ('deaths','cs','gold','damage','durationSeconds')}
    command_counts={}
    envelopes={}
    for path in (folder/'raw').glob('*.pair.json'):
        raw=read(path)
        envelopes.setdefault((sha(raw['item']),raw.get('candidateHash')),[]).append((path,raw))
    for item in plan['evaluationCases']:
        matches=[]
        for path,raw in envelopes.get((sha(item),plan['candidateHash']),[]):
            if raw['item']==item and raw['candidateHash']==plan['candidateHash']:
                if sha(raw)!=path.name.split('.')[0]:raise ValueError('Raw envelope corrupted')
                own='red' if item['swapped'] else 'blue';enemy='blue' if own=='red' else 'red'
                for name in ('control','repeat','challenger'):
                    match=raw[name]['item']
                    if any(match[k]!=item[k] for k in ('seed','draft','swapped')):raise ValueError('Raw world allocation mismatch')
                    expected_policies={own:candidate['policy'] if name=='challenger' else incumbent,enemy:opponents[item['opponentHash']]}
                    if match.get('policies')!=expected_policies or match.get('training') or match.get('terminalFixture'):raise ValueError('Policy identity or inference mode mismatch')
                    if arena_mode(original) and match.get('controller')!='arena':raise ValueError('Arena inference was bypassed')
                if all(raw[name]['episode']['status']=='terminal' for name in ('control','repeat','challenger')):
                    outcomes['terminal_pairs']+=1
                    outcomes['control_wins']+=int(raw['control']['episode']['result']['winner']==own)
                    outcomes['challenger_wins']+=int(raw['challenger']['episode']['result']['winner']==own)
                    if arena_mode(original):
                        for name,arm in (('control','control'),('challenger','candidate')):
                            episode=raw[name]['episode'];stats=[u for u in episode['result']['stats'] if u['team']==own]
                            for metric in comparison:
                                value=episode['second'] if metric=='durationSeconds' else sum(u[metric] for u in stats)
                                comparison[metric][arm]+=value
                counters=raw['challenger']['episode'].get('learning') or {}
                behavior['eligible']+=counters.get('eligible',0);behavior['changed']+=counters.get('changed',0)
                behavior['intents_recorded']+=counters.get('executed',0)
                if arena_mode(original):
                    behavior['controllerDecisions']=behavior.get('controllerDecisions',0)+counters.get('decisions',0)
                    for action,count in counters.get('byAction',{}).items():command_counts[action]=command_counts.get(action,0)+count
                matches.append(observation(raw,sha(path.read_bytes())))
        if len(matches)!=1:raise ValueError('Missing or ambiguous raw envelope')
        rows.append(matches[0])
    clusters={};sides={'original':[],'swapped':[]};missing=unsafe=invalid=0
    for r in rows:
        if r['status']!='terminal':missing+=1;continue
        if not r['controlsMatch'] or r['sourceHash']!=plan['sourceHash']:invalid+=1;continue
        if r['teamDeathDelta']>0:unsafe+=1
        clusters.setdefault(r['seed'],[]).append(r['winDelta']);sides['swapped' if r['swapped'] else 'original'].append(r['winDelta'])
    values=[sum(v)/len(v) for v in clusters.values()];mean=sum(values)/len(values) if values else None
    radius=2*math.sqrt(math.log(2/(1-.95))/(2*len(values))) if values else None
    reasons=[]
    if missing:reasons.append('incomplete-full-matches')
    if invalid:reasons.append('invalid-or-unstable-evidence')
    death_gate=unsafe and not arena_mode(original)
    if death_gate:reasons.append('team-survival-regression')
    if len(values)<32:reasons.append('insufficient-independent-seeds')
    if len({r['draft'] for r in rows if r['status']=='terminal' and r['controlsMatch']})<2:reasons.append('insufficient-draft-diversity')
    if any(not any(r['status']=='terminal' and r['controlsMatch'] and r['opponentHash']==o for r in rows) for o in {r['opponentHash'] for r in rows}):reasons.append('missing-opponent-coverage')
    if mean is None or mean-radius<=0:reasons.append('improvement-not-established')
    by_side={k:{'measured':len(v),'winDelta':sum(v)/len(v) if v else None} for k,v in sides.items()}
    side_regression=any(v['winDelta'] is not None and v['winDelta']<0 for v in by_side.values())
    if side_regression:reasons.append('side-regression')
    status='reject' if invalid or death_gate or side_regression or (mean is not None and mean+radius<0) else 'inconclusive' if reasons else 'promote'
    assessment={'status':status,'reasons':reasons,'bySide':by_side,'independentSeeds':len(values),'planned':len(rows),
                'measured':sum(map(len,clusters.values())),'winDelta':None if mean is None else {'estimate':mean,'lower':max(-1,mean-radius),
                'upper':min(1,mean+radius),'confidence':.95,'method':'seed-cluster-hoeffding','assumption':'Independent planned seeds; sides clustered'},
                'extraTeamDeathCases':unsafe,'productionEligible':False}
    behavior['change_rate']=behavior['changed']/behavior['eligible'] if behavior['eligible'] else None
    if arena_mode(original):
        behavior['actionCounts']=command_counts
        if outcomes['terminal_pairs']:
            outcomes['averages']={k:{'control':v['control']/outcomes['terminal_pairs'],'candidate':v['candidate']/outcomes['terminal_pairs'],
                'delta':(v['candidate']-v['control'])/outcomes['terminal_pairs']} for k,v in comparison.items()}
    return {'assessment':assessment,'candidate':candidate,'behavior':behavior,'outcomes':outcomes,
            'training':training_metrics(folder),
            'source_proposals':[read(p) for p in sorted((folder/'source').glob('proposal-*.json'))],
            'policy_bytes':base64.b64encode(canonical(candidate['policy'])).decode(),
            'source_hash':plan['sourceHash'],'evidence_hash':sha(rows),
            'incumbent_id':read(folder/'plan.json')['incumbent_id'],'production_promoted':False}


def main(folder):
    folder=folder.resolve()
    with (folder/'lease.lock').open('a') as lease:
        fcntl.flock(lease,fcntl.LOCK_EX|fcntl.LOCK_NB) # OS releases after abrupt worker death.
        study=Study(folder)
        try:study.run()
        except ResourcePause as error:
            write(folder/'state.json',{'status':'paused_resource','error':str(error),'progress':read(folder/'state.json').get('progress',{})})
        except Pause as error:
            remaining=study.plan['total_minutes']*60-(study.journal['seconds']-max(0,study.budget)+time.monotonic()-study.started)
            exhausted=remaining<MATCH_SECONDS+10
            write(folder/'state.json',{'status':'completed' if exhausted else 'paused_budget','progress':read(folder/'state.json').get('progress',{}),
                  'result':{'assessment':{'status':'inconclusive','reasons':['total-budget-exhausted' if exhausted else str(error)]},'production_promoted':False}})
        except InterruptedError as error:write(folder/'state.json',{'status':'cancelled','error':str(error)})
        except Exception as error:
            write(folder/'state.json',{'status':'failed','error':str(error)});raise
        finally:
            study.journal['seconds']+=time.monotonic()-study.started-max(0,study.budget);write(folder/'journal.json',study.journal)
            manager=Operations(folder.parent)
            try:
                for path in folder.rglob('*'):
                    if path.is_file() and not path.is_symlink() and path.name not in ('lease.lock',):
                        manager.register(str(path.relative_to(folder.parent)),'intelligence-evidence',folder.name,['study:'+folder.name])
            finally:manager.db.close()


if __name__=='__main__':main(Path(sys.argv[1]))
