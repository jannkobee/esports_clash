import hashlib,json,shutil,sys,uuid
from pathlib import Path
source=Path(sys.argv[1]);base=Path(sys.argv[2]);candidate_id=str(uuid.uuid4());target=Path('/avatar-data')/candidate_id;target.mkdir()
for filename in ['mirelle-base-animated.glb','mirelle-base-animated.blend','mirelle-raw-rig.glb','mirelle-raw-rig.blend','rig-motion-report.json','independent-audit.json','motion-idle.png','motion-run.png','motion-attack.png','motion-cast.png','motion-death.png']:
    if (source/filename).is_file():shutil.copy2(source/filename,target/filename)
for filename in ['mirelle-base-unrigged.glb','mirelle-base-unrigged.blend','base-audit.json']:
    shutil.copy2(base/filename,target/filename)
report=json.loads((source/'rig-motion-report.json').read_text())
audit=json.loads((source/'independent-audit.json').read_text()) if (source/'independent-audit.json').is_file() else None
report['independent_audit']=audit
if audit and not audit['structural_passed']:report['remaining_gates']=audit['problems']+report['remaining_gates']
artifacts={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in target.iterdir() if p.is_file()}
bundle={'id':candidate_id,'avatar_id':'c_invoker','status':'animated_base_unqualified','report':report,'artifacts':artifacts}
receipt=Path('/avatar-data/mirelle-current-candidate.json');receipt.write_text(json.dumps(bundle,indent=2)+'\n')
print(json.dumps({'id':candidate_id,'files':len(artifacts),'status':bundle['status']}))
