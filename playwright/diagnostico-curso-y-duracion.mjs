/**
 * Evidencia del curso clínico del diagnóstico: el catálogo resuelve —«Crónica»
 * y no «Activo/Archivado»— y elegir la duración «Crónico» quita la fecha
 * esperada de resolución.
 *
 * Uso: `yarn node playwright/diagnostico-curso-y-duracion.mjs` con el front en
 * el 4300.
 */
import { chromium } from '@playwright/test';
const B='http://localhost:4300';
const nav=await chromium.launch();
const ctx=await nav.newContext({viewport:{width:1440,height:1400}});
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
await pg.goto(`${B}/medical-records/${id}/encounter`,{waitUntil:'domcontentloaded',timeout:180000});
await pg.waitForTimeout(3000);
// El diagnóstico exige encuentro abierto: se registra primero.
const abrir = pg.getByRole('button',{name:/Registrar encuentro/i}).first();
if (await abrir.count()) { await abrir.click(); await pg.waitForTimeout(2500); }

// Elegir el bloque de diagnóstico
const sel = pg.locator('select').first();
await sel.selectOption({label:' Diagnóstico — del catálogo CIE-10 '}).catch(async()=>{
  const ops = await sel.locator('option').allTextContents();
  await sel.selectOption({index: ops.findIndex(o=>o.includes('Diagnóstico — del catálogo'))});
});
await pg.waitForTimeout(2500);
const cursoSel = pg.locator('select').filter({has: pg.locator('option',{hasText:/Crónica|Aguda|Sin especificar/})}).first();
const cursos = await cursoSel.locator('option').allTextContents().catch(()=>[]);
process.stdout.write('opciones de curso clínico: '+JSON.stringify(cursos.map(c=>c.trim()))+'\n');
const antes = await pg.getByText('Fecha esperada de resolución').count();
const chip = pg.getByText(/Crónico — seguimiento continuo/).first();
if (await chip.count()) { await chip.click(); await pg.waitForTimeout(800); }
const despues = await pg.getByText('Fecha esperada de resolución').count();
process.stdout.write(`campo «Fecha esperada»: antes=${antes} · con crónico=${despues}\n`);
await pg.screenshot({path:'artifacts/fase3-diagnostico-cronico.png', fullPage:true});
await nav.close();
