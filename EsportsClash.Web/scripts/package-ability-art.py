import json,hashlib,struct,html
from pathlib import Path
root=Path(__file__).resolve().parents[2];p=root/'docs/arena-2d/ability-drawings-v1/manifest.json';m=json.loads(p.read_text(encoding='utf-8'));cards=[]
for a in m['atlases']:
 slug=a['canonicalId'];receipt=json.loads((p.parent/(slug+'.json')).read_text(encoding='utf-8'));asset=root/'EsportsClash.Web/public/art/ability-drawings-v1'/(slug+'.png');data=asset.read_bytes();w,h,depth,ct=struct.unpack('>IIBB',data[16:26]);assert ct==6
 cols,rows=(5,2) if slug=='mirelle-pages' else (2,2)
 a.update(status='drawn-live-token-trial',file=str(asset.relative_to(root)).replace('\\','/'),source=receipt['source'],sha256=hashlib.sha256(data).hexdigest(),promptSha256=hashlib.sha256(a['prompt'].encode()).hexdigest(),width=w,height=h,alpha=True,columns=cols,rows=rows)
 cells=[]
 names=[x['patternRole'].replace('**','') for x in a['pages']] if 'pages' in a else [k+': '+v['name'] for k,v in a['slots'].items()]
 a['cells']=[]
 for i,name in enumerate(names):
  x=i%cols;y=i//cols;a['cells'].append({'name':name,'rect':[int(x*w/cols),int(y*h/rows),int((x+1)*w/cols),int((y+1)*h/rows)]})
  pad=.015;us=(1-pad*2)/cols;vs=(1-pad*2)/rows;px=100*((x+pad)/cols)/(1-us);py=100*((y+pad)/rows)/(1-vs)
  cells.append('<figure><div class="token" style="background-image:url('+slug+'.png);background-size:'+str(100/us)+'% '+str(100/vs)+'%;background-position:'+str(px)+'% '+str(py)+'%"></div><figcaption>'+html.escape(name)+'</figcaption></figure>')
 cards.append('<section><h2>'+html.escape(a['name'])+'</h2><div class="cells">'+''.join(cells)+'</div><a href="'+slug+'.png" download>Download full sheet</a></section>')
p.write_text(json.dumps(m,indent=2),encoding='utf-8')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Avatar ability artwork</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#111c19;color:#eee5cd;font:16px system-ui}h1{font-size:36px}p{color:#aab9b0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:24px}section{padding:20px;border:1px solid #43564b;border-radius:12px;background:#1c2c24}.cells{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0}figcaption{font-size:13px;min-height:36px}.token{aspect-ratio:1;background-repeat:no-repeat;background-color:#263b30;border-radius:8px}a{color:#e2c483}</style><h1>Avatar ability artwork</h1><p>180 ability slots across 45 avatars, plus Mirelle’s ten named patterns. Painted tokens accompany the match’s exact effect outlines.</p><main>CARDS</main></html>'''
(root/'EsportsClash.Web/public/art/ability-drawings-v1/index.html').write_text(page.replace('CARDS',''.join(cards)),encoding='utf-8')
print(len(m['atlases']),'sheets;',sum(len(a['cells']) for a in m['atlases']),'cells packaged with hashes.')

