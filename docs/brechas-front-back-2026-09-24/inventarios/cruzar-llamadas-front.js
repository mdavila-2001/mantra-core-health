const fs=require('fs'),path=require('path');
const FRONT=process.argv[2],OUT=process.argv[3];
const api=JSON.parse(fs.readFileSync(OUT+'/api-routes.json','utf8'));
function walk(d,a=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(f.name==='mock')continue;walk(p,a);}else if(/\.ts$/.test(f.name)&&!/spec\.ts$/.test(f.name))a.push(p);}return a;}
const norm=p=>p.split('?')[0].replace(/\$\{[^}]+\}/g,':x').replace(/:[A-Za-z_]\w*/g,':x').replace(/\/$/,'');
function match(m,p){const segs=norm(p).split('/');for(const a of api){if(a.m!==m)continue;const s2=norm(a.p).split('/');if(s2.length!==segs.length)continue;let ok=true;for(let i=0;i<segs.length;i++){if(segs[i]===s2[i]||segs[i]===':x'||s2[i]===':x')continue;ok=false;break;}if(ok)return a;}return null;}
const calls=[];let dyn=0;
for(const f of walk(FRONT+'/src/app')){const t=fs.readFileSync(f,'utf8');
 const re=/\.(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(?:this\.(?:url|u|api|endpoint|path)\(|apiUrl\([^,]+,\s*)?\s*([`'"])(\/[^`'"]*)\2/g;let r;
 while((r=re.exec(t))){calls.push({m:r[1].toUpperCase(),p:r[3],file:path.relative(FRONT,f).split(path.sep).join('/')});}}
const uniq=new Map();for(const c of calls){const k=c.m+' '+norm(c.p);if(!uniq.has(k))uniq.set(k,{...c,files:new Set()});uniq.get(k).files.add(c.file);}
const rows=[...uniq.values()].map(c=>({m:c.m,p:c.p,files:[...c.files],api:match(c.m,c.p)}));
const miss=rows.filter(r=>!r.api);
console.log('llamadas únicas',rows.length,'sin ruta API',miss.length);
for(const r of miss)console.log(r.m.padEnd(6),r.p.padEnd(70),r.files[0]);
fs.writeFileSync(OUT+'/client-calls.json',JSON.stringify(rows.map(r=>({...r,api:r.api&&r.api.m+' '+r.api.p})),null,1));
