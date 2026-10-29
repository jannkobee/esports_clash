from pathlib import Path
path=Path('EsportsClash.Api/resources/views/evolution/registry/index.blade.php')
text=path.read_text(encoding='utf-8').replace('Original character art and animation qualification pending. Existing artwork remains available.',"{{ ($p['assets']['status']??null)==='missing' ? 'Previous model and picture versions deleted. New base, rig and animation pipeline pending.' : 'Original character art and animation qualification pending.' }}")
path.write_text(text,encoding='utf-8')
path=Path('EsportsClash.Api/resources/views/evolution/registry/edit.blade.php')
text=path.read_text(encoding='utf-8').replace('Appearance: existing artwork; original character qualification pending.',"Appearance: {{ ($data['assets']['status']??null)==='missing' ? 'previous assets deleted; fresh pipeline pending' : 'new base pipeline in progress; not qualified' }}.")
text=text.replace(":'Bundled artwork'",":'No active visual asset'")
path.write_text(text,encoding='utf-8')
