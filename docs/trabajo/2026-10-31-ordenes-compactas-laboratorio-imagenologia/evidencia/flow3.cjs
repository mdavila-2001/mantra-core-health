const { chromium } = require('playwright');
const fs = require('fs');
const EV = process.argv[2];
const BASE = 'http://localhost:4200';
const log = [];
const say = (m) => { console.log(m); log.push(m); };
const VPS = [{ n: '390', width: 390, height: 844 }, { n: '768', width: 768, height: 1024 }, { n: '1440', width: 1440, height: 1250 }];
const settle = async (p) => {
  await p.mouse.move(0, 0);
  await p.waitForTimeout(3000);
  // La barra lateral anima su ancho al entrar: se espera a tres lecturas iguales y seguidas.
  let prev = '';
  let equal = 0;
  for (let i = 0; i < 40 && equal < 3; i++) {
    const w = await p.evaluate(() => {
      const card = document.querySelector('app-card');
      const nav = document.querySelector('app-side-nav, aside');
      return Math.round(card?.getBoundingClientRect().left ?? 0) + ':' + Math.round(nav?.getBoundingClientRect().width ?? 0);
    });
    equal = w === prev ? equal + 1 : 0;
    prev = w;
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(400);
};

(async () => {
  const browser = await chromium.launch();
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-BO', acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });
    await page.goto(BASE + '/auth');
    await page.getByTestId('login-identifier').fill('laboratorio@alovida.mock');
    await page.getByTestId('login-password').fill('mock');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/dashboard/);
    await page.goto(BASE + '/administration/laboratory-orders');
    await page.locator('tbody tr').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${EV}/01-todas-${vp.n}.png`, fullPage: vp.n !== '1440' });
    say(`[${vp.n}] desborde horizontal: ${await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)}`);

    // Recibidas: marcar como procesada desde el menú
    await page.goto(BASE + '/administration/laboratory-orders?estado=received');
    await page.locator('tbody tr').first().waitFor();
    const row = page.locator('tbody tr').first();
    const name = await row.locator('strong').first().innerText();
    await row.getByRole('button', { name: /Acciones/ }).first().click();
    await settle(page);
    await page.screenshot({ path: `${EV}/02-menu-recibida-${vp.n}.png` });
    await page.getByRole('menuitem', { name: 'Marcar como procesada' }).click();
    await page.getByTestId('lab-order-status').first().waitFor();
    await page.goto(BASE + '/administration/laboratory-orders?estado=processed');
    await page.locator('tbody tr').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${EV}/03-pestana-procesadas-${vp.n}.png`, fullPage: vp.n !== '1440' });
    say(`[${vp.n}] pestaña activa: ${(await page.getByRole('tab', { selected: true }).innerText()).trim()} · filas=${await page.locator('tbody tr').count()}`);

    // Subir resultados
    const pr = page.locator('tbody tr').first();
    await pr.getByRole('button', { name: /Acciones/ }).first().click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'Subir resultados' }).click();
    const content = Buffer.from('%PDF-1.4 sintético ' + vp.n);
    await (await chooser).setFiles({ name: `hemograma-sintetico-${vp.n}.pdf`, mimeType: 'application/pdf', buffer: content });
    await page.getByTestId('lab-orders-uploads').getByText(/Subido/).first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${EV}/04-subiendo-panel-arriba-${vp.n}.png` });

    await page.goto(BASE + '/administration/laboratory-orders?estado=uploaded');
    await page.locator('tbody tr').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${EV}/05-pestana-subidos-${vp.n}.png`, fullPage: vp.n !== '1440' });
    const target = page.locator('tbody tr').filter({ hasText: name });
    await target.getByRole('button', { name: /Acciones/ }).first().click();
    const dl = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Descargar' }).click();
    const d = await dl;
    say(`[${vp.n}] descarga ${d.suggestedFilename()} iguales=${fs.readFileSync(await d.path()).equals(content)}`);
    await page.reload();
    await page.locator('tbody tr').first().waitFor();
    say(`[${vp.n}] tras recargar, ${name}: ${(await page.locator('tbody tr').filter({ hasText: name }).getByTestId('lab-order-status').innerText()).trim()}`);

    // Canceladas y vacío por búsqueda
    await page.goto(BASE + '/administration/laboratory-orders?estado=closed');
    await page.locator('tbody tr').first().waitFor();
    await settle(page);
    await page.screenshot({ path: `${EV}/06-pestana-canceladas-${vp.n}.png`, fullPage: vp.n !== '1440' });
    await page.goto(BASE + '/administration/laboratory-orders?estado=draft');
    await page.locator('app-data-table').waitFor();
    await page.getByRole('textbox', { name: /Buscar/ }).first().fill('zzzz');
    await page.keyboard.press('Enter');
    await settle(page);
    await page.screenshot({ path: `${EV}/07-vacio-${vp.n}.png`, fullPage: vp.n !== '1440' });
    say(`[${vp.n}] vacío: ${(await page.locator('app-data-table').innerText()).replace(/\s+/g, ' ').slice(0, 160)}`);

    {
      await page.goto(BASE + '/administration/laboratory-orders');
      await page.locator('tbody tr').first().waitFor();
      await page.getByRole('switch').first().click();
      await settle(page);
      say(`[${vp.n}] tema: ${await page.evaluate(() => document.documentElement.getAttribute('data-theme'))}`);
      await page.screenshot({ path: `${EV}/08-tema-oscuro-${vp.n}.png`, fullPage: vp.n !== '1440' });
    }
    say(`[${vp.n}] errores de consola/red: ${errors.length ? JSON.stringify(errors) : 'ninguno'}`);
    await ctx.close();
  }
  fs.writeFileSync(`${EV}/recorrido-final.log`, log.join('\n') + '\n');
  await browser.close();
})().catch((e) => { console.error('FALLÓ', e.message); process.exit(1); });
