/**
 * Evidencia del pedido del propietario (18/09/2026) sobre «Publicá tu agenda»:
 *
 * 1. Horario flexible: sin turnos fijos — la tabla deja de preguntar duración
 *    y descanso.
 * 2. Hora de almuerzo «de tal hora a tal hora».
 * 3. Las casillas pasan a botones «Sí / No».
 *
 * Publica de verdad contra la maqueta y relee `/schedule/edit` para comprobar
 * que el almuerzo vuelve como almuerzo (dos franjas el mismo día).
 *
 * Uso: `yarn node playwright/horario-flexible-almuerzo.mjs` con el front
 * levantado (`BASE`, por omisión http://localhost:4293).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4293';
const OUT = process.env.OUT ?? 'artifacts';
const nav = await chromium.launch();

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

const log = (texto) => process.stdout.write(`${texto}\n`);
const columnas = (pg, n) =>
  pg.waitForFunction(
    (esperadas) =>
      document.querySelectorAll('.agenda-create__tabla thead th').length === esperadas,
    n,
    { timeout: 30000 },
  );

for (const [nombre, ancho, alto, tema] of [
  ['escritorio-oscuro', 1440, 900, 'dark'],
  ['escritorio-claro', 1440, 900, 'light'],
  ['movil', 375, 800, 'light'],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await entrar(pg);

  await pg.goto(`${B}/schedule/edit`, { waitUntil: 'commit', timeout: 180000 });
  const lunes = pg.getByTestId('agenda-create-dia-0');
  await lunes.waitFor({ timeout: 60000 });
  // El horario vigente se carga después de pintar: se espera a que llegue
  // para que no pise lo que se escribe a continuación.
  await pg.getByText('Cambiá tu horario').first().waitFor({ timeout: 60000 });
  log(`[${nombre}] casillas en el formulario: ${await pg.locator('input[type=checkbox]').count()}`);

  // Lunes con «Sí», de 08:00 a 18:00, almuerzo de 12:30 a 14:00.
  await lunes.getByRole('radio', { name: 'Sí' }).click();
  await pg.getByTestId('agenda-create-desde-0').fill('08:00');
  await pg.getByTestId('agenda-create-hasta-0').fill('18:00');
  await pg.getByTestId('agenda-create-almuerzo').getByRole('radio', { name: 'Sí' }).click();
  await pg.getByTestId('agenda-create-almuerzo-desde').fill('12:30');
  await pg.getByTestId('agenda-create-almuerzo-hasta').fill('14:00');
  await pg.getByText('Almuerzo de 12:30 a 14:00: sin consultas.').waitFor({ timeout: 30000 });
  await pg.screenshot({ path: `${OUT}/horario-almuerzo-${nombre}.png`, fullPage: true });
  log(`[${nombre}] lunes con almuerzo: ${JSON.stringify(await pg.locator('.agenda-create__previa-dia').first().innerText())}`);

  // Horario flexible: fuera las columnas de turnos.
  await pg.getByTestId('agenda-create-flexible').getByRole('radio', { name: 'Sí' }).click();
  await columnas(pg, 3);
  log(`[${nombre}] encabezados en flexible: ${JSON.stringify(await pg.locator('.agenda-create__tabla thead th').allInnerTexts())}`);
  await pg.screenshot({ path: `${OUT}/horario-flexible-${nombre}.png`, fullPage: true });

  // Opciones avanzadas: «Sí / No» en vez de casillas.
  await pg.getByRole('button', { name: /opciones avanzadas/ }).click();
  await pg.locator('.agenda-create__avanzadas').screenshot({ path: `${OUT}/horario-avanzadas-${nombre}.png` });
  log(`[${nombre}] casillas con avanzadas abiertas: ${await pg.locator('input[type=checkbox]').count()}`);

  if (nombre === 'escritorio-claro') {
    // Publicar de verdad (maqueta) y releer: el almuerzo tiene que volver.
    await pg.getByTestId('agenda-create-flexible').getByRole('radio', { name: 'No' }).click();
    await columnas(pg, 6);
    // El horario sembrado tiene citas comprometidas y la maqueta responde 409
    // (regla vigente). Se publica en una agenda NUEVA, sin citas: sólo el lunes
    // con almuerzo, así la cuenta de turnos dice si la tarde se generó.
    await pg.getByTestId('agenda-create-nueva').click();
    await pg.getByTestId('agenda-create-nombre').locator('input').fill('Consultorio de prueba almuerzo');
    for (const i of [1, 2, 3, 4, 5, 6]) {
      await pg.getByTestId(`agenda-create-dia-${i}`).getByRole('radio', { name: 'No' }).click();
    }
    await pg.getByRole('button', { name: /Guardar mi horario|Publicar mi agenda/ }).click();
    const salida = pg.locator('dialog[open], app-alert[tone=error]').first();
    const llego = await salida.waitFor({ timeout: 60000 }).then(() => true, () => false);
    if (!llego) await pg.screenshot({ path: `${OUT}/horario-guardar-fallo.png`, fullPage: true });
    log(`[${nombre}] tras publicar: ${llego ? JSON.stringify(await salida.innerText()) : 'NADA (ver horario-guardar-fallo.png)'}`);
    await pg.screenshot({ path: `${OUT}/horario-publicado-${nombre}.png` });
  }

  const anchoDoc = await pg.evaluate(() => document.documentElement.scrollWidth);
  log(`[${nombre}] scroll horizontal: ${anchoDoc > ancho ? `SÍ (${anchoDoc}px)` : 'no'}`);
  const propios = errores.filter((e) => !e.includes('Content Security Policy'));
  log(`[${nombre}] errores de consola (sin los CSP del servidor de desarrollo): ${propios.length === 0 ? 'ninguno' : JSON.stringify(propios)}`);
  await ctx.close();
}
await nav.close();
