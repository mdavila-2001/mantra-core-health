const fs=require('fs'),path=require('path');
function walk(d,a=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p,a);else if(f.name.endsWith('.ts')&&!f.name.endsWith('spec.ts'))a.push(p);}return a;}
const files=walk('src');const ctrls=[];const regs=new Set();
for(const f of files){const t=fs.readFileSync(f,'utf8');
 if(f.endsWith('.module.ts')){const re=/controllers\s*:\s*\[([^\]]*)\]/g;let r;while((r=re.exec(t)))for(const w of r[1].match(/\w+/g)||[])regs.add(w);
   const re2=/const\s+\w*CONTROLLERS\w*\s*=\s*\[([^\]]*)\]/gi;while((r=re2.exec(t)))for(const w of r[1].match(/\w+/g)||[])regs.add(w);}
 const re=/@Controller\([^)]*\)[\s\S]{0,600}?export\s+class\s+(\w+)/g;let r;while((r=re.exec(t)))ctrls.push({c:r[1],f});}
const miss=ctrls.filter(x=>!regs.has(x.c));console.log('controllers',ctrls.length,'no registrados',miss.length);miss.forEach(x=>console.log(x.c,x.f));
