import { readdirSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function intelligenceSourceHash(){
  const files=readdirSync('src',{recursive:true}).filter(f=>/\.(tsx?|css|json)$/.test(f)).map(f=>'src/'+f.replaceAll('\\','/')).sort();
  return hash(JSON.stringify(files.map(file=>[file,hash(readFileSync(file))])));
}
