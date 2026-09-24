const fs=require('fs'),path=require('path');
const FRONT=process.argv[2],OUT=process.argv[3];
const api=JSON.parse(fs.readFileSync(OUT+'/api-routes.json','utf8'));
const norm=p=>p.replace(/\$\{[^}]+\}/g,':x').replace(/:[A-Za-z_]\w*/g,':x').replace(/\/$/,'');
function match(m,p){const segs=norm(p).split('/');for(const a of api){if(a.m!==m)continue;const s2=norm(a.p).split('/');if(s2.length!==segs.length)continue;let ok=true;for(let i=0;i<segs.length;i++){if(segs[i]===s2[i]||segs[i]===':x'||s2[i]===':x')continue;ok=false;break;}if(ok)return a;}return null;}
const hdir=FRONT+'/src/app/core/mock/handlers';const mock=[];
for(const f of fs.readdirSync(hdir).filter(f=>f.endsWith('.ts')&&!f.includes('spec'))){const t=fs.readFileSync(path.join(hdir,f),'utf8');const re=/router\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]/g;let r;while((r=re.exec(t)))mock.push({m:r[1].toUpperCase(),p:r[2].replace(/\/\*$/,'').replace(/\/$/,''),file:f});}
const rows=mock.map(x=>({...x,api:match(x.m,x.p)}));const miss=rows.filter(r=>!r.api);
console.log('mock',rows.length,'sin API',miss.length);for(const r of miss)console.log(r.m.padEnd(6),r.p.padEnd(66),r.file);
fs.writeFileSync(OUT+'/mock-missing.json',JSON.stringify(miss,null,1));
const used=new Set(rows.filter(r=>r.api).map(r=>r.api.m+' '+r.api.p));
const unused=api.filter(a=>!used.has(a.m+' '+a.p));fs.writeFileSync(OUT+'/api-unused.json',JSON.stringify(unused,null,1));
const byMod={};for(const a of unused){const k=a.file.split('/')[2]||a.file;byMod[k]=(byMod[k]||0)+1;}
const tot={};for(const a of api){const k=a.file.split('/')[2]||a.file;tot[k]=(tot[k]||0)+1;}
console.log('\nAPI sin consumo por módulo (sin/total):');console.log(Object.keys(tot).sort((a,b)=>byMod[b]-byMod[a]).map(k=>k+' '+(byMod[k]||0)+'/'+tot[k]).join(' · '));
