/**
 * Evidencia de dos quejas del propietario (18/09/2026) sobre `/schedule`:
 *
 * 1. Consultas: la columna fija de Acciones tapaba la columna Pago y los
 *    nombres de paciente se partían en tres o cuatro renglones.
 * 2. Mis horarios → «Cómo viene el mes»: el globo del día se abría sobre otra
 *    semana y tapaba celdas.
 *
 * Uso: `yarn node playwright/agenda-tabla-y-mes.mjs` (`BASE`, por omisión el
 * mockup desplegado).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'https://mockup.173.249.39.237.sslip.io';
const OUT = process.env.OUT ?? 'artifacts/agenda-tabla-y-mes';
const nav = await chromium.launch();

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

for (const [nombre, ancho, alto, tema] of [
  ['1280-oscuro', 1280, 720, 'dark'],
  ['1440-claro', 1440, 900, 'light'],
  ['820-claro', 820, 1000, 'light'],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema });
  const pg = await ctx.newPage();
  await entrar(pg);

  await pg.goto(`${B}/schedule?vista=table`);
  const tabla = pg.locator('table').first();
  await tabla.waitFor({ timeout: 30000 });
  await pg.waitForTimeout(800);
  const medidas = await pg.evaluate(() => {
    const t = document.querySelector('table');
    const wrap = t.parentElement;
    const cab = [...t.querySelectorAll('thead th')].map((th) => {
      const r = th.getBoundingClientRect();
      return { txt: th.textContent.trim(), x: Math.round(r.left), w: Math.round(r.width), pos: getComputedStyle(th).position };
    });
    const filaAlta = Math.max(...[...t.querySelectorAll('tbody tr')].map((tr) => tr.getBoundingClientRect().height));
    // Lo que tapa la columna fija: cuánto de «Pago» queda debajo de «Acciones».
    const ths = [...t.querySelectorAll('thead th')];
    const pago = ths.find((th) => th.textContent.trim() === 'Pago')?.getBoundingClientRect();
    const acc = ths.find((th) => th.textContent.trim() === 'Acciones')?.getBoundingClientRect();
    const tapado = pago && acc ? Math.max(0, Math.round(pago.right - acc.left)) : 0;
    const renglonesPaciente = Math.max(
      ...[...t.querySelectorAll('tbody tr')].map((tr) => {
        const a = tr.querySelectorAll('td')[1]?.querySelector('a, span');
        if (!a) return 0;
        return Math.round(a.getBoundingClientRect().height / parseFloat(getComputedStyle(a).lineHeight || '20'));
      }),
    );
    // Lo más ancho que pide cada columna, para saber quién estira la tabla.
    const contenido = ths.map((th, i) =>
      Math.max(
        ...[...t.querySelectorAll('tbody tr')].map((tr) => {
          const td = tr.querySelectorAll('td')[i];
          return td ? Math.max(...[...td.children].map((c) => Math.round(c.scrollWidth)), 0) : 0;
        }),
      ),
    );
    return {
      contenido,
      tablaW: t.scrollWidth,
      wrapW: wrap.clientWidth,
      desborde: t.scrollWidth - wrap.clientWidth,
      tapado,
      renglonesPaciente,
      paginaDesborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cab,
      filaAlta: Math.round(filaAlta),
    };
  });
  console.log(nombre, JSON.stringify(medidas));
  await tabla.screenshot({ path: `${OUT}/${nombre}-consultas.png` });

  await pg.goto(`${B}/schedule?vista=agenda`);
  await pg.getByRole('tab', { name: /Cómo viene el mes/ }).click();
  await pg.waitForTimeout(1500);
  const dia = pg.locator('[data-testid="mes-dia"]').nth(10);
  await dia.hover();
  const globo = pg.getByTestId('mes-globo');
  await globo.waitFor({ timeout: 5000 });
  const [cajaDia, cajaGlobo] = [await dia.boundingBox(), await globo.boundingBox()];
  console.log(nombre, 'globo', JSON.stringify({ dia: cajaDia, globo: cajaGlobo, texto: (await globo.innerText()).replace(/\s+/g, ' ') }));
  await pg.screenshot({ path: `${OUT}/${nombre}-mes.png`, fullPage: true });
  await ctx.close();
}
await nav.close();
