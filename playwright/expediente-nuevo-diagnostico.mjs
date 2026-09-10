/**
 * Evidencia de «Nuevo diagnóstico» desde el expediente: el botón existe en la
 * pestaña de diagnósticos, abre el alta en modal y el selector ofrece las citas
 * ya finalizadas.
 *
 * Uso: `yarn node playwright/expediente-nuevo-diagnostico.mjs` con el front en
 * el 4300.
 */
import { chromium } from '@playwright/test';
const B='http://localhost:4300';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:1200}});
const pg=await ctx.newPage();
await pg.goto(`${B}/auth`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/,{timeout:60000});
if(pg.url().includes('/auth/organization')){await pg.getByTestId('tenant-opcion').first().click();await pg.waitForURL(/\/dashboard/,{timeout:60000});}
await pg.goto(`${B}/medical-records`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(2500);
await pg.locator('input.native-input').first().fill('Ana');
await pg.waitForTimeout(2000);
const hrefs = await pg.locator('a[href*="/medical-records/"]').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
const id = (hrefs.find(h=>/\/medical-records\/[0-9a-f-]{36}$/.test(h ?? '')) ?? '').split('/medical-records/')[1];
await pg.goto(`${B}/medical-records/${id}`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(3500);

const boton = pg.getByTestId('expediente-nuevo-diagnostico');
process.stdout.write(`botón «Nuevo diagnóstico»: ${await boton.count()}\n`);
await boton.first().click();
await pg.waitForTimeout(2500);

const modal = pg.getByTestId('content-dialog');
process.stdout.write(`modal abierto: ${await modal.count()} · título: ${await pg.getByTestId('content-dialog-title').innerText().catch(()=>'-')}\n`);
const cita = pg.getByTestId('diagnostico-cita').locator('select');
const citas = await cita.locator('option').allTextContents().catch(()=>[]);
process.stdout.write(`opciones de cita (${citas.length}):\n${citas.slice(0,6).map(c=>'  · '+c.trim()).join('\n')}\n`);
await pg.screenshot({path:'artifacts/fase4-nuevo-diagnostico.png'});
await nav.close();
