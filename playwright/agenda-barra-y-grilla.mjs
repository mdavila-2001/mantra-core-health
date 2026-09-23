/**
 * Evidencia de «Mi agenda»: chips a la izquierda y acciones a la derecha en la
 * barra del horario; la grilla con los siete días y abierta en la primera
 * hora atendida.
 *
 * Uso: `yarn node playwright/agenda-barra-y-grilla.mjs` con el front
 * levantado (`BASE`, por omisión http://localhost:4231).
 */
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4231';
const nav = await chromium.launch();

for (const [nombre, ancho] of [['escritorio', 1536], ['celular', 400]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 1000 } });
  const pg = await ctx.newPage();
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
  await pg.goto(`${B}/schedule?vista=agenda`, { waitUntil: 'commit', timeout: 180000 });
  await pg.locator('[data-testid=horario-barra]').waitFor({ timeout: 60000 });
  await pg.waitForTimeout(1500);

  const barra = await pg.locator('[data-testid=horario-barra]').evaluate((b) => {
    const r = (e) => e.getBoundingClientRect();
    const caja = r(b);
    const chips = [...b.querySelectorAll('app-badge')].map((e) => Math.round(r(e).left - caja.left));
    const botones = [...b.querySelectorAll('[app-button]')].map((e) => Math.round(caja.right - r(e).right));
    return `chips a ${chips.join(',')}px del borde izq · botones a ${botones.join(',')}px del borde der`;
  });
  const grilla = await pg.locator('.grilla__scroll').evaluate((c) => {
    const dias = [...c.querySelectorAll('.grilla__dia-nombre')].map((e) => e.textContent.trim());
    const primera = [...c.querySelectorAll('.grilla__bloque-horas')].map((e) => e.textContent.trim()).sort()[0];
    const cabecera = c.querySelector('.grilla__esquina').offsetHeight;
    const visible = [...c.querySelectorAll('.grilla__hora')].find((h) => h.offsetTop >= c.scrollTop + cabecera)?.textContent;
    return `días=${dias.join(' ')} · scrollTop=${c.scrollTop} · primera hora visible=${visible} · primera franja=${primera}`;
  });
  const vieja = await pg.locator('.mi-agenda__semana, .mi-agenda__agotan').count();
  process.stdout.write(`[${nombre}] ${barra}\n[${nombre}] ${grilla}\n[${nombre}] semanita/alerta vieja en pantalla: ${vieja}\n`);
  await pg.locator('.mi-agenda__tarjeta').screenshot({ path: `artifacts/agenda-${nombre}.png` });

  const info = pg.getByTestId('aviso-agotan');
  if (await info.count()) {
    const globo = pg.getByTestId('aviso-agotan-globo');
    await info.click();
    await pg.waitForTimeout(400);
    const caja = await globo.boundingBox();
    process.stdout.write(
      `[${nombre}] globo abierto=${await globo.isVisible()} caja=${JSON.stringify(caja)} ventana=${ancho}\n` +
        `[${nombre}] globo texto="${(await globo.innerText()).replace(/\s+/g, ' ').trim()}"\n`,
    );
    await pg.screenshot({ path: `artifacts/agenda-${nombre}-aviso.png` });
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(300);
    process.stdout.write(`[${nombre}] tras Escape abierto=${await globo.isVisible()}\n`);
  } else {
    process.stdout.write(`[${nombre}] sin «i» (no se agotan los turnos en esta cuenta)\n`);
  }
  await ctx.close();
}
await nav.close();
