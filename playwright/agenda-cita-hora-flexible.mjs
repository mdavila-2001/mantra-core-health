/**
 * «Hora de inicio» de «Agendar una cita» con un horario flexible (propietario,
 * 31/10/2026): el día flexible no tiene cupos fijos y el select salía «Sin
 * horarios libres». Publica la semana flexible en la maqueta, abre la cita,
 * elige un lunes y lista las horas que ofrece el select.
 *
 * Uso: `BASE=http://localhost:4300 yarn node playwright/agenda-cita-hora-flexible.mjs`
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4300';
const OUT = process.env.OUT ?? 'artifacts/agenda-cita-hora-flexible';
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pg = await nav.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });

const red = [];
pg.on('response', (r) => {
  const u = new URL(r.url());
  if (/flexible-availability|\/scheduling\/slots|appointments\/direct|\/templates/.test(u.pathname)) {
    red.push(`${r.request().method()} ${u.pathname} → ${r.status()}`);
  }
});

await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
for (let i = 0; i < 6 && !/dashboard|organization/.test(pg.url()); i += 1) {
  await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pg.getByTestId('login-password').fill('Alovida123!');
  await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
  await pg.waitForURL(/dashboard|organization/, { timeout: 10000 }).catch(() => {});
}
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
}

// 1. Toda la semana flexible, guardada.
await pg.goto(`${B}/schedule/edit`);
await pg.locator('[data-testid="agenda-create-desde-0"]').waitFor({ timeout: 60000 });
// La pantalla precarga el horario vigente: tocar antes lo pisaría la precarga.
await pg.waitForTimeout(2500);
await pg.getByTestId('agenda-create-flexible').getByText('Sí', { exact: true }).click();
await pg.getByTestId('agenda-create-minutos-por-paciente').waitFor({ timeout: 10000 });
await pg.getByRole('button', { name: /Guardar mi horario|Publicar mi agenda/ }).click();
for (let i = 0; i < 3; i += 1) {
  // Conservar las citas que ya tiene: la prueba es de la hora, no de cancelar.
  const conservar = pg.getByRole('button', { name: 'Conservar las citas' });
  if (await conservar.count()) await conservar.click().catch(() => {});
  await pg.waitForTimeout(1500);
}
await pg.screenshot({ path: `${OUT}/1-horario-guardado.png` });

// 2. La cita: un lunes que atiende. Sin recargar: la maqueta vive en memoria
//    y una recarga perdería el horario recién guardado.
await pg.getByRole('button', { name: 'Ver mi agenda' }).last().click();
await pg.waitForURL((u) => !u.pathname.endsWith('/schedule/edit'), { timeout: 30000 });
console.log('después de guardar:', pg.url());
const aCita = pg.getByTestId('calendario-agendar-cita').first();
await aCita.waitFor({ timeout: 60000 });
await aCita.click();
const fecha = pg.getByTestId('cita-fecha').locator('input').first();
await fecha.waitFor({ timeout: 60000 });
await fecha.click();
await fecha.pressSequentially(process.env.DIA ?? '02112026', { delay: 40 });
await pg.getByTestId('cita-motivo').locator('input').click();
await pg.waitForTimeout(2500);
const hora = pg.locator('app-select[data-testid="cita-hora"]');
await hora.scrollIntoViewIfNeeded();
await pg.screenshot({ path: `${OUT}/2-hora-cerrada.png` });
await hora.locator('button, [role="combobox"]').first().click();
await pg.waitForTimeout(600);
const opciones = await pg.locator('[role="option"]').allTextContents();
await pg.screenshot({ path: `${OUT}/3-hora-abierta.png` });
console.log(JSON.stringify({ red, opciones: opciones.map((o) => o.trim()).slice(0, 40), total: opciones.length }, null, 1));
await nav.close();
