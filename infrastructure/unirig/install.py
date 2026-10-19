"""Constrained configuration changes; upstream model and sampler code unchanged."""
import json
from pathlib import Path
import yaml

UPSTREAM = Path('/opt/UniRig')
PINS = json.loads(Path('/opt/unirig-service/model-pins.json').read_text())
INFERENCE = json.loads(Path('/opt/unirig-service/inference-pins.json').read_text())
for filename, checkpoint in [('quick_inference_skeleton_articulationxl_ar_256.yaml',PINS['files'][0]),('quick_inference_unirig_skin.yaml',PINS['files'][1])]:
    path = UPSTREAM / 'configs/task' / filename
    config = yaml.safe_load(path.read_text())
    config['resume_from_checkpoint'] = '/unirig-data/models/' + (INFERENCE['path'] if filename=='quick_inference_unirig_skin.yaml' else checkpoint['path'])
    path.write_text(yaml.safe_dump(config))
path = UPSTREAM / 'configs/model/unirig_ar_350m_1024_81920_float32.yaml'
config = yaml.safe_load(path.read_text())
config['llm']['pretrained_model_name_or_path'] = '/unirig-data/models/opt-350m'
path.write_text(yaml.safe_dump(config))
path = UPSTREAM / 'configs/data/quick_inference.yaml'
config = yaml.safe_load(path.read_text())
config['predict_dataset_config']['num_workers'] = 0
path.write_text(yaml.safe_dump(config))
