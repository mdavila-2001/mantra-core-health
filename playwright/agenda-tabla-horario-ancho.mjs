/**
 * La tabla de horarios de `/schedule/new` cortaba columnas («Descan…») a la
 * derecha: medía más que su tarjeta y scrolleaba de costado (propietario,
 * 31/10/2026). Mide, por ancho y con y sin «toda la semana flexible», cuánto
 * desborda la tabla de su caja y saca una captura.
 *
 * Uso: `BASE=http://localhost:4300 yarn node playwright/agenda-tabla-horario-ancho.mjs`
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4300';
const OUT = process.env.OUT ?? 'artifacts/agenda-tabla-horario-ancho';
const nav = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pg.getByTestId('login-password').fill('Alovida123!');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

const resultados = [];
for (const [ancho, alto] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: 'dark' });
  const pg = await ctx.newPage();
  await entrar(pg);
  await pg.goto(`${B}/schedule/new`);
  const tabla = pg.locator('table.agenda-create__tabla');
  await tabla.waitFor({ timeout: 60000 });
  // Un día encendido para que la fila tenga todas sus columnas.
  const lunes = pg.getByTestId('agenda-create-dia-0');
  if ((await pg.locator('[data-testid="agenda-create-desde-0"]').count()) === 0) {
    await lunes.getByText('Sí', { exact: true }).click();
  }
  await pg.waitForTimeout(600);
  const medir = () =>
    pg.evaluate(() => {
      const t = document.querySelector('table.agenda-create__tabla');
      const caja = t.parentElement;
      // Lo que queda fuera de la caja: cualquier control cuyo borde derecho la pase.
      const borde = caja.getBoundingClientRect().right;
      const cortados = [...t.querySelectorAll('tbody tr:first-child :is(th, td)')]
        .filter((c) => c.getBoundingClientRect().right > borde + 1)
        .map((c) => c.getAttribute('data-label') ?? c.textContent.trim().slice(0, 20));
      const fila = t.querySelector('tbody tr');
      const dia = fila.querySelector('th');
      return {
        modo: getComputedStyle(fila).display,
        tabla: t.scrollWidth,
        caja: caja.clientWidth,
        desborde: t.scrollWidth - caja.clientWidth,
        cortados,
        pagina: document.documentElement.scrollWidth - window.innerWidth,
        pesoDiaActivo: getComputedStyle(dia).fontWeight,
        pesoDiaApagado: getComputedStyle(t.querySelectorAll('tbody tr')[1].querySelector('th')).fontWeight,
      };
    });
  for (const semana of ['por-dia', 'flexible']) {
    if (semana === 'flexible') {
      await pg.getByTestId('agenda-create-flexible').getByText('Sí', { exact: true }).click();
      await pg.waitForTimeout(400);
    }
    const m = await medir();
    resultados.push({ ancho, semana, ...m });
    await tabla.scrollIntoViewIfNeeded();
    await pg.screenshot({ path: `${OUT}/${ancho}-${semana}.png` });
  }
  await ctx.close();
}
console.log(JSON.stringify(resultados, null, 1));
await nav.close();
