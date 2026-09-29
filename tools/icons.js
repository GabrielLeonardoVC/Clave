const fs=require('fs'), path=require('path');
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else out.push(p);}return out;}
const usados=new Set();
for(const f of walk('.')){ if(!/\.(js|html)$/.test(f))continue; if(f.includes('tools'))continue;
  const s=fs.readFileSync(f,'utf8'); let m;
  const re=/data-lucide['"]?\s*[:=]\s*['"]([a-z0-9-]+)['"]/g; while((m=re.exec(s))) usados.add(m[1]);
  const re2=/icone:\s*'([a-z0-9-]+)'/g; while((m=re2.exec(s))) usados.add(m[1]);
}
console.log('total icones: '+usados.size);
console.log(Array.from(usados).sort().join(' '));
