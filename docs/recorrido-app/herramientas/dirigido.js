const { chromium } = require('playwright'); const fs=require('fs');
function uuid(seed){let h1=0x811c9dc5,h2=0x01000193;for(let i=0;i<seed.length;i++){const c=seed.charCodeAt(i);h1=Math.imul(h1^c,0x01000193)>>>0;h2=Math.imul(h2^c,0x811c9dc5)>>>0;}const hex=n=>n.toString(16).padStart(8,'0');const raw=`${hex(h1)}${hex(h2)}${hex((h1*31+h2)>>>0)}${hex((h2*17+h1)>>>0)}`;return `${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-a${raw.slice(17,20)}-${raw.slice(20,32)}`;}
const B='http://localhost:4200'; fs.mkdirSync('out/dirigido',{recursive:true});
const res=[];
async function sesion(browser,cuenta){const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'es-BO',timezoneId:'America/La_Paz'});const p=await ctx.newPage();
 p._c=[];p.on('console',m=>{if(m.type()==='error'||/sin manejador/.test(m.text()))p._c.push(m.text().replace(/\{.*/,'').slice(0,160))});p.on('pageerror',e=>p._c.push('EXC '+e.message.slice(0,160)));
 if(cuenta){await p.goto(B+'/auth');await p.getByTestId('login-identifier').fill(cuenta);await p.getByTestId('login-password').fill('mock');await p.getByTestId('login-submit').click();
 await p.waitForURL(u=>!u.pathname.startsWith('/auth')||u.pathname.includes('organization'),{timeout:60000});if(p.url().includes('/auth/organization')){await p.getByTestId('tenant-opcion').first().click();await p.waitForURL(u=>!u.pathname.startsWith('/auth'));}}
 else {await p.goto(B+'/posts');} await p.waitForTimeout(1500); return p;}
async function ver(p,cuenta,url,nombre){p._c=[];await p.evaluate(d=>{history.pushState({},'',d);dispatchEvent(new PopStateEvent('popstate',{state:{}}))},url);await p.waitForTimeout(2200);
 const t=await p.evaluate(()=>({f:location.pathname,h1:[...document.querySelectorAll('h1')].map(h=>h.textContent.trim())[0]||'',tx:(document.querySelector('main')||document.body).innerText.slice(0,900)}));
 await p.screenshot({path:`out/dirigido/${nombre}.jpg`,type:'jpeg',quality:55});res.push({cuenta,url,nombre,final:t.f,h1:t.h1,texto:t.tx,consola:[...new Set(p._c)]});console.log(nombre,'->',t.f,'|',t.h1,'|',[...new Set(p._c)].slice(0,2));}
(async()=>{const b=await chromium.launch();
 let p=await sesion(b,'paciente@alovida.mock');
 await ver(p,'paciente','/psychological-help','pac-psico');
 await ver(p,'paciente','/directory/'+uuid('hpid-medica'),'pac-ficha-medica');
 const cupo=p.locator('a[href*="/book/"], button:has-text(":")').first();
 if(await cupo.count()){await cupo.click().catch(()=>{});await p.waitForTimeout(2500);await p.screenshot({path:'out/dirigido/pac-reserva.jpg',type:'jpeg',quality:55});res.push({cuenta:'paciente',nombre:'pac-reserva',final:new URL(p.url()).pathname,texto:(await p.locator('main').innerText().catch(()=>'')).slice(0,900)});console.log('reserva ->',p.url());}
 await ver(p,'paciente','/my-account/pharmacy-orders','pac-pedidos');
 const ped=await p.locator('a[href*="/pharmacy-orders/"]').first().getAttribute('href').catch(()=>null);
 if(ped){await ver(p,'paciente',ped.replace(/\/(receipt|invoice)$/,'')+'/invoice','pac-factura');}
 await ver(p,'paciente','/pharmacies-directory','pac-farmacias');
 const far=await p.locator('a[href^="/pharmacies-directory/"]').first().getAttribute('href').catch(()=>null);
 if(far){await ver(p,'paciente',far,'pac-ficha-farmacia');await ver(p,'paciente','/f/'+far.split('/').pop(),'pac-f-slug');}
 await ver(p,'paciente','/posts','pac-posts');
 const post=await p.locator('a[href*="/post/"]').first().getAttribute('href').catch(()=>null); if(post) await ver(p,'paciente',post,'pac-post');
 await p.context().close();
 p=await sesion(b,'medica@alovida.mock');
 await ver(p,'medica',`/medical-records/${uuid('pid-paciente')}/consultation`,'med-consulta');
 await ver(p,'medica',`/medical-records/${uuid('pid-paciente')}/request-access`,'med-vinculo');
 await ver(p,'medica','/schedule','med-agenda');
 await p.context().close();
 p=await sesion(b,'admin@alovida.mock');
 await ver(p,'admin',`/administration/identity-assurance/cases/${uuid('case-cola-1')}`,'adm-caso-identidad');
 await ver(p,'admin',`/administration/organizations/${uuid('tenant-clinica-los-olivos')}/child-organizations/new`,'adm-suborg');
 await ver(p,'admin','/administration/medical-center-setup','adm-centro-medico');
 await ver(p,'admin',`/administration/geolocation/subjects/last-position/${uuid('tracked-subject-demo')}`,'adm-geo');
 await ver(p,'admin','/administration/identity-assurance/queue','adm-cola-identidad');
 await p.context().close();
 fs.writeFileSync('out/dirigido/filas.json',JSON.stringify(res,null,1));await b.close();})();
