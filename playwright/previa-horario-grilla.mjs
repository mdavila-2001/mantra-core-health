/**
 * Evidencia de «Previsualizar horario»: el modal muestra la MISMA grilla que
 * «Mi horario» (`ScheduleGrid`) y no la tira de horas de inicio que escribía
 * el `DialogService.confirm()` anterior.
 *
 * Uso: `yarn node playwright/previa-horario-grilla.mjs` con el front levantado
 * (`BASE`, por omisión http://localhost:4200).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/frontend/evidence/previa-horario-grilla';
const nav = await chromium.launch();

for (const [ancho, alto] of [
  [1536, 1000],
  [400, 860],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto } });
  const pg = await ctx.newPage();
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 240000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pg.getByTestId('login-password').fill('mockup');
    await pg
      .getByTestId('login-submit')
      .click({ timeout: 8000 })
      .catch(() => {});
    await pg.waitForURL(destino, { timeout: 20000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }

  await pg.goto(`${B}/schedule/edit`, { waitUntil: 'commit', timeout: 240000 });
  const previsualizar = pg.getByTestId('agenda-create-previsualizar');
  await previsualizar.waitFor({ timeout: 90000 });
  await pg.waitForTimeout(1200);

  // Con el formulario en blanco no hay nada que previsualizar: se encienden
  // los días de semana, que es lo que carga cualquiera al abrir la pantalla.
  if (await previsualizar.isDisabled()) {
    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']) {
      await pg
        .getByRole('button', { name: new RegExp(dia, 'i') })
        .first()
        .click()
        .catch(() => {});
    }
    await pg.waitForTimeout(800);
  }

  await previsualizar.click();
  await pg.getByTestId('content-dialog').waitFor({ timeout: 20000 });
  await pg.waitForTimeout(1200);

  const grillas = await pg.locator('.grilla__scroll').count();
  const texto = (await pg.getByTestId('content-dialog').innerText()).replace(/\s+/g, ' ').trim();
  process.stdout.write(
    `[${ancho}] grillas dentro del modal: ${grillas}\n[${ancho}] modal: ${texto.slice(0, 220)}\n`,
  );

  await pg.screenshot({ path: `${OUT}/previa-${ancho}.png` });
}

await nav.close();
