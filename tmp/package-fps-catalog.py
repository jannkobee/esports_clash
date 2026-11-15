from pathlib import Path
b=Path('EsportsClash.Web')
source=Path('EsportsClash.Api/resources/fps-player-architecture-v4.json')
(b/'src/fps/fps-player-architecture-v4.json').write_bytes(source.read_bytes())
p=b/'src/fps/fpsPlayerArchitecture.ts';s=p.read_text(encoding='utf-8').replace("../../../EsportsClash.Api/resources/fps-player-architecture-v4.json",'./fps-player-architecture-v4.json');p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
# Packaged API data is a generated mirror of the frontend-local canonical catalog.
p=Path('EsportsClash.Api/app/Services/FpsPlayerArchitecture.php');s=p.read_text(encoding='utf-8');s=s.replace("return $catalog ??= json_decode(file_get_contents(resource_path('fps-player-architecture-v4.json')), true, 512, JSON_THROW_ON_ERROR);", """$source=base_path('../EsportsClash.Web/src/fps/fps-player-architecture-v4.json');
        $packaged=resource_path('fps-player-architecture-v4.json');
        if(is_file($source)&&!hash_equals(hash_file('sha256',$source),hash_file('sha256',$packaged)))throw new \\RuntimeException('FPS architecture package differs from its canonical source. Run the catalog sync script.');
        return $catalog ??= json_decode(file_get_contents(is_file($source)?$source:$packaged), true, 512, JSON_THROW_ON_ERROR);""")
s=s.replace("ucwords(strtolower(str_replace('_',' ',$p['temperament'])))", "($p['temperament']==='ICE_COLD'?'Ice-Cold':ucwords(strtolower($p['temperament'])))")
p.write_bytes(s.replace('\r\n','\n').encode('utf-8'))
for name in ['Dockerfile','Dockerfile.identities']:
 p=Path('infrastructure/online')/name;s=p.read_text(encoding='utf-8');s='\n'.join(line for line in s.splitlines() if 'COPY EsportsClash.Api/resources/fps-player-architecture-v4.json' not in line)+'\n';p.write_bytes(s.encode('utf-8'))
