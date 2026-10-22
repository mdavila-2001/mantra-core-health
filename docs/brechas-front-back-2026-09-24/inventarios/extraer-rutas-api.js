const fs=require('fs'),path=require('path');
const API=process.argv[2],OUT=process.argv[3];
function walk(d,a=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,a);else if(/\.ts$/.test(f.name)&&!/spec\.ts$/.test(f.name))a.push(p);}return a;}
const out=[];let unresolved=0;
for(const f of walk(API+'/src')){const t=fs.readFileSync(f,'utf8');if(!t.includes('@Controller('))continue;
 const toks=[];const reC=/@Controller\(\s*([^)]*)\)/g;let r;
 while((r=reC.exec(t))){let a=r[1].trim();let pfx=[''];
   const strs=[...a.matchAll(/['"`]([^'"`]*)['"`]/g)].map(x=>x[1]);
   if(a.startsWith('{')){const m=a.match(/path\s*:\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/);pfx=m?[...m[1].matchAll(/['"`]([^'"`]*)['"`]/g)].map(x=>x[1]):[''];}
   else if(strs.length)pfx=strs; else if(a){unresolved++;pfx=['<'+a+'>'];}
   toks.push({pos:r.index,pfx});}
 const reM=/@(Get|Post|Put|Patch|Delete)\(\s*(?:(['"`])([^'"`]*)\2|\[([^\]]*)\])?\s*\)/g;
 while((r=reM.exec(t))){const c=[...toks].reverse().find(x=>x.pos<r.index);if(!c)continue;
   const subs=r[4]?[...r[4].matchAll(/['"`]([^'"`]*)['"`]/g)].map(x=>x[1]):[r[3]||''];
   // method name
   const after=t.slice(r.index,r.index+600);const mn=(after.match(/\n\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/)||[])[1];
   for(const p of c.pfx)for(const s of subs){const full=('/'+p+'/'+s).replace(/\/+/g,'/').replace(/\/$/,'')||'/';
     out.push({m:r[1].toUpperCase(),p:full,file:path.relative(API,f).split(path.sep).join("/"),fn:mn});}}}
fs.writeFileSync(OUT+'/api-routes.json',JSON.stringify(out,null,0));
console.log('routes',out.length,'unresolved controllers',unresolved);
