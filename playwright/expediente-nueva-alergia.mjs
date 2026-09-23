/**
 * Evidencia de «Nueva alergia»: el botón existe en la pestaña de alergias, abre
 * el alta en modal, ofrece las citas ya finalizadas y admite varias reacciones.
 *
 * Uso: `yarn node playwright/expediente-nueva-alergia.mjs` con el front en el 4300.
 */
import { chromium } from '@playwright/test';
const B='http://localhost:4300';
const ID='c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:1300}});
const pg=await ctx.newPage();
await pg.goto(`${B}/auth`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/,{timeout:60000});
if(pg.url().includes('/auth/organization')){await pg.getByTestId('tenant-opcion').first().click();await pg.waitForURL(/\/dashboard/,{timeout:60000});}
await pg.goto(`${B}/medical-records/${ID}`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(3500);
await pg.getByRole('tab',{name:/Alergias/i}).first().click();
await pg.waitForTimeout(1200);
const boton = pg.getByTestId('expediente-nueva-alergia');
process.stdout.write(`botón «Nueva alergia»: ${await boton.count()}\n`);
await boton.first().click();
await pg.waitForTimeout(2500);
process.stdout.write(`título del modal: ${await pg.getByTestId('content-dialog-title').innerText().catch(()=>'-')}\n`);
const sust = pg.getByTestId('alergia-sustancia').locator('select');
const sustancias = await sust.locator('option').allTextContents().catch(()=>[]);
process.stdout.write(`sustancias (${sustancias.length}): ${sustancias.slice(1,6).map(s=>s.trim()).join(' · ')}\n`);
process.stdout.write(`reacciones en el formulario: ${await pg.getByTestId('alergia-reaccion').count()}\n`);
await pg.getByTestId('alergia-agregar-reaccion').first().click();
await pg.waitForTimeout(700);
process.stdout.write(`tras «agregar otra»: ${await pg.getByTestId('alergia-reaccion').count()}\n`);
await pg.screenshot({path:'artifacts/fase7-nueva-alergia.png'});
await nav.close();
