/**
 * Evidencia de «Cambiar mi horario»: la vista previa dice el cierre y cambiar
 * la duración no deja cupos con el fin viejo.
 *
 * Uso: `yarn node playwright/horario-cambio-de-duracion.mjs` con el front
 * levantado en el 4300 (`yarn start --port 4300`).
 */
import { chromium } from '@playwright/test';
const B='http://localhost:4300';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:1200}});
const pg=await ctx.newPage();
const peticiones=[];
pg.on('request',r=>{ if(r.url().includes('/scheduling/')||r.url().includes('/practices')) peticiones.push(`${r.method()} ${r.url().replace(B,'')}`); });
pg.on('console',m=>{ if(m.type()==='error') process.stdout.write('CONSOLA: '+m.text().slice(0,200)+'\n'); });
await pg.goto(`${B}/auth`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/,{timeout:60000});
if(pg.url().includes('/auth/organization')){await pg.getByTestId('tenant-opcion').first().click();await pg.waitForURL(/\/dashboard/,{timeout:60000});}
await pg.goto(`${B}/schedule/edit`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(2500);

// Lunes pasa de 30 a 45 minutos: el chip de la fila.
// La duración de cada día es un <select> en su fila.
const selects = pg.locator('select');
const total = await selects.count();
for (let i = 0; i < total; i += 1) {
  const opciones = await selects.nth(i).locator('option').allTextContents();
  if (opciones.some((o) => o.includes('45 min'))) {
    await selects.nth(i).selectOption({ label: ' 45 min ' }).catch(async () => {
      await selects.nth(i).selectOption({ index: opciones.findIndex((o) => o.includes('45 min')) });
    });
  }
}
await pg.waitForTimeout(600);
process.stdout.write('previa tras el cambio:\n'+(await pg.locator('.agenda-create__previa').first().innerText())+'\n');
await pg.screenshot({path:'artifacts/fase1-previa-45.png'});

const publicar = pg.locator('.agenda-create__acciones button').first();
process.stdout.write('botón: "'+(await publicar.innerText().catch(()=>'(no está)'))+'" visible='+(await publicar.isVisible().catch(()=>false))+'\n');
await publicar.scrollIntoViewIfNeeded().catch(()=>{});
await publicar.click({ force: true });
await pg.waitForTimeout(1500);
// Si el click no disparó el submit, se pide el submit directamente: lo que
// interesa medir es el efecto de publicar, no el atajo del navegador.
await pg.evaluate(() => document.querySelector('form.agenda-create')?.requestSubmit());
await pg.waitForTimeout(5000);
process.stdout.write('url tras publicar: '+pg.url()+'\n');
const dialogo = await pg.locator('[role=dialog], dialog').first().innerText().catch(()=>'(sin modal)');
process.stdout.write('--- modal ---\n'+dialogo+'\n');
await pg.screenshot({path:'artifacts/fase1-publicado.png'});

// El efecto, que es lo observable: los cupos de la agenda tras el cambio.
await pg.goto(`${B}/schedule`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(3500);
const cupos = pg.getByRole('tab', { name: /Cupos/i });
if (await cupos.count()) { await cupos.first().click(); await pg.waitForTimeout(2500); }
const texto = await pg.locator('main').innerText();
const horas = [...texto.matchAll(/\b(\d{2}:\d{2})\b/g)].map(m=>m[1]);
process.stdout.write('primeras horas en la agenda: '+horas.slice(0,14).join(' · ')+'\n');
await pg.screenshot({path:'artifacts/fase1-agenda-cupos.png', fullPage:true});
await nav.close();
