/**
 * Evidencia del expediente sin banda: las alergias y la consulta abierta salen
 * en un modal al entrar, y las cifras («Diagnósticos 2 · Medicación 2 · …
 * Última atención») ya no ocupan la franja de arriba de las pestañas.
 *
 * Uso: `yarn node playwright/expediente-avisos-en-modal.mjs` con el front en el 4300.
 */
import { chromium } from '@playwright/test';
const B = 'http://localhost:4300';
const ID = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 } });
const pg = await ctx.newPage();
await pg.goto(`${B}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
}
await pg.goto(`${B}/medical-records/${ID}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await pg.waitForTimeout(4000);

const avisos = pg.getByTestId('expediente-avisos');
process.stdout.write(`modal de avisos: ${await avisos.count()}\n`);
process.stdout.write(
  `título: ${await pg.getByTestId('content-dialog-title').innerText().catch(() => '-')}\n`,
);
process.stdout.write(`texto del aviso: ${(await avisos.innerText().catch(() => '-')).replace(/\n/g, ' | ')}\n`);
await pg.screenshot({ path: 'artifacts/expediente-avisos-modal.png' });

await pg.getByTestId('content-dialog-close').first().click();
await pg.waitForTimeout(1200);
process.stdout.write(`modal tras cerrar: ${await pg.getByTestId('expediente-avisos').count()}\n`);

const cuerpo = await pg.locator('body').innerText();
for (const texto of ['Última atención', 'Tenés una consulta en curso', 'Ibuprofeno']) {
  process.stdout.write(`«${texto}» en la página: ${cuerpo.includes(texto)}\n`);
}
process.stdout.write(`banda de cifras: ${await pg.locator('.expediente__cifras').count()}\n`);
await pg.screenshot({ path: 'artifacts/expediente-sin-banda.png' });
await nav.close();
