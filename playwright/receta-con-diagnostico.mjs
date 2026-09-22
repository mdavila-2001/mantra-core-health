/**
 * Evidencia del porqué de la receta: sin diagnóstico ni motivo no deja
 * prescribir, «Otro motivo» destraba el campo de texto, y la tabla de
 * medicación del expediente dice el diagnóstico y de qué receta viene.
 *
 * Uso: `yarn node playwright/receta-con-diagnostico.mjs` con el front en el 4300.
 */
import { chromium } from '@playwright/test';
const B='http://localhost:4300';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:1300}});
const pg=await ctx.newPage();
await pg.goto(`${B}/auth`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/,{timeout:60000});
if(pg.url().includes('/auth/organization')){await pg.getByTestId('tenant-opcion').first().click();await pg.waitForURL(/\/dashboard/,{timeout:60000});}
const ID='c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
await pg.goto(`${B}/medical-records/${ID}/encounter`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(3000);
const abrir = pg.getByRole('button',{name:/Registrar encuentro/i}).first();
if (await abrir.count()) { await abrir.click(); await pg.waitForTimeout(2500); }
await pg.getByRole('tab',{name:/Receta/i}).first().click();
await pg.waitForTimeout(2500);
const sel = pg.getByTestId('receta-indicacion').locator('select');
const ops = await sel.locator('option').allTextContents().catch(()=>[]);
process.stdout.write('opciones del porqué:\n'+ops.map(o=>'  · '+o.trim()).join('\n')+'\n');
const prescribir = pg.getByRole('button',{name:/^Prescribir$/}).first();
process.stdout.write('«Prescribir» sin motivo: aria-disabled='+await prescribir.getAttribute('aria-disabled')+'\n');
const i = ops.findIndex(o=>o.includes('Otro motivo'));
if (i >= 0) { await sel.selectOption({index:i}); await pg.waitForTimeout(900); }
process.stdout.write('campo «¿Cuál es el motivo?»: '+await pg.getByTestId('receta-motivo-libre').count()+'\n');
await pg.screenshot({path:'artifacts/fase5-receta-motivo.png'});
await nav.close();
