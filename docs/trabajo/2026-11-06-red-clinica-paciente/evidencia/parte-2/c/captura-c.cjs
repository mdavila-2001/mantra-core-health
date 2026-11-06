// Part 2, agent C — the detail panel's M34 states after the review fixes (M2, M3, M4).
// Usage: BASE=http://localhost:4300 node captura-c.cjs <out-dir>   (demo build, configuration development,demo)
// Never `networkidle`: waits are on test ids. Reuses the session helpers of visual batch 3.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const t3 = require('../../tanda-visual-3/captura-tanda-3.cjs');

const OUT = process.argv[2];
const log = [];
let fallas = 0;
const anotar = (s) => { log.push(s); console.log(s); };
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };
const nombreTema = (t) => (t === 'light' ? 'claro' : 'oscuro');

/** Waits for every running animation in the panel (the alert's entrance) before a shot. */
const quieto = (p) => p.evaluate(() => Promise.all(document.querySelectorAll('[data-testid="red-panel"]')[0]?.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished) ?? []));

/** The error card's icon: present and fully visible once its entrance ended. */
const icono = (p) => p.evaluate(() => {
  const i = document.querySelector('[data-testid="red-panel-informe-error"] .alert__icon');
  return i === null ? null : { svg: !!i.querySelector('svg'), opacidad: getComputedStyle(i).opacity, ancho: Math.round(i.getBoundingClientRect().width) };
});

async function estados(b, ancho, tema) {
  const pref = `${ancho}-${nombreTema(tema)}`;
  const { ctx, p, errores } = await t3.sesion(b, 'medica@alovida.mock', ancho, tema);
  await t3.abrirRed(p);
  await t3.sinToasts(p);
  const fallar = (lista) => p.evaluate((l) => sessionStorage.setItem('mock:fallos', JSON.stringify(l)), lista);
  const panel = p.getByTestId('red-panel');
  const liberado = p.getByTestId('red-panel-liberado');
  const cerrar = async () => { await p.getByTestId('red-panel-cerrar').click(); await panel.waitFor({ state: 'detached' }); };

  // S2: the clock is paused so the shot lands inside the simulator's 120 ms wait.
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  await hipo.click();
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.waitFor();
  await p.clock.install();
  await p.clock.pauseAt(Date.now() + 1000);
  await tsh.click();
  await p.clock.runFor(60);
  const cargando = p.getByTestId('red-panel-informe-cargando');
  const s2 = await cargando.isVisible().catch(() => false);
  const esqueletos = await cargando.locator('app-skeleton').count().catch(() => 0);
  const altoEsqueleto = s2 ? Math.round((await cargando.locator('.estado__tabla').boundingBox()).height) : 0;
  afirmar(s2 && esqueletos === 13, `${pref} S2: esqueleto visible (${esqueletos} siluetas: línea + 4 filas × 3)`);
  afirmar((await liberado.count()) === 0, `${pref} S2: sin «Resultado liberado» mientras lee`);
  if (s2) await panel.screenshot({ path: `${OUT}/${pref}-s2-cargando.png` });
  await p.clock.resume();
  await p.getByTestId('red-panel-valor').first().waitFor();
  const altoTabla = Math.round((await p.locator('.panel__tabla-caja').boundingBox()).height);
  anotar(`${pref} S2: alto del esqueleto ${altoEsqueleto} px, alto de la tabla leída ${altoTabla} px`);
  afirmar((await liberado.textContent()).includes('Liberado el'), `${pref} éxito: «${(await liberado.textContent()).replace(/\s+/g, ' ').trim()}»`);
  await quieto(p);
  await panel.screenshot({ path: `${OUT}/${pref}-exito.png` });
  await cerrar();

  const casos = [
    ['s5-403', 'forbidden', 'No puede ver este informe', true],
    ['s6-404', 'not-found', 'El informe no está disponible', true],
    ['s8-sin-conexion', 'red', 'Sin conexión', false],
    ['s9-error-con-id', 'error', 'Código de soporte', false],
    ['s4-validacion', 'validation', 'No se pudieron leer los valores ahora', false],
  ];
  for (const [nombre, modo, texto, volver] of casos) {
    await fallar([{ patron: '/reports/', modo, metodos: ['GET'] }]);
    await tsh.click();
    const error = p.getByTestId('red-panel-informe-error');
    await error.waitFor({ timeout: 15000 });
    await quieto(p);
    const dice = (await error.textContent()).replace(/\s+/g, ' ').trim();
    afirmar(dice.includes(texto), `${pref} ${nombre}: «${dice.slice(0, 110)}»`);
    const ic = await icono(p);
    afirmar(ic !== null && ic.svg && ic.opacidad === '1' && ic.ancho > 0, `${pref} ${nombre}: lleva ícono ${JSON.stringify(ic)}`);
    afirmar((await liberado.count()) === 0, `${pref} ${nombre}: sin «Resultado liberado» debajo`);
    const boton = p.getByTestId('red-panel-volver');
    afirmar((await boton.count()) === (volver ? 1 : 0), `${pref} ${nombre}: «Volver a la red» ${volver ? 'ofrecido' : 'no corresponde (tiene «Reintentar»)'}`);
    await panel.screenshot({ path: `${OUT}/${pref}-${nombre}.png` });
    await fallar([]);
    if (volver) {
      await boton.click();
      await panel.waitFor({ state: 'detached' });
      const foco = await p.evaluate(() => document.activeElement?.closest('[data-testid="recorrido-nodo"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40) ?? document.activeElement?.tagName);
      afirmar(/TSH/.test(foco ?? ''), `${pref} ${nombre}: «Volver a la red» cierra y el foco vuelve al nodo (${foco})`);
    } else {
      await cerrar();
    }
  }

  // M4: the download notice enters the view on its own (no manual scroll before the shot).
  await fallar([{ patron: '/content', modo: 'validation', metodos: ['GET'] }]);
  await tsh.click();
  await p.getByTestId('red-panel-valor').first().waitFor();
  await p.getByTestId('red-panel-archivo').first().click();
  const aviso = panel.getByText('El archivo todavía no se puede abrir');
  await aviso.waitFor({ timeout: 15000 });
  await p.waitForTimeout(600);
  const enVista = await aviso.evaluate((e) => { const r = e.closest('app-alert').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  afirmar(enVista, `${pref} descarga-validación: el aviso queda entero en la ventana sin desplazar a mano`);
  await p.screenshot({ path: `${OUT}/${pref}-descarga-validacion.png` });
  await fallar([]);
  await cerrar();

  // S3: a study ordered without a released result yet.
  await p.getByTestId('red-desplegar-todo').click();
  const estudios = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]');
  let s3 = null;
  for (let i = 0; i < (await estudios.count()) && s3 === null; i++) {
    await estudios.nth(i).scrollIntoViewIfNeeded();
    await estudios.nth(i).click();
    await panel.waitFor();
    await p.getByTestId('red-panel-informe-cargando').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    if (await p.getByTestId('red-panel-sin-resultado').count()) s3 = (await p.getByTestId('red-panel-sin-resultado').textContent()).replace(/\s+/g, ' ').trim();
    else await cerrar();
  }
  afirmar(s3 !== null, `${pref} S3: «${s3 ?? 'ningún estudio sin resultado en la demo'}»`);
  if (s3 !== null) await panel.screenshot({ path: `${OUT}/${pref}-s3-sin-resultado.png` });
  // The API interceptor logs the failures provoked on purpose (`mock-fallo`, the offline one); anything else counts.
  const ajenos = errores.filter((e) => !/correlationId=mock-fallo|→ sin respuesta/.test(e));
  afirmar(ajenos.length === 0, `${pref}: consola sin errores ajenos a los fallos provocados (${errores.length - ajenos.length} provocados) ${JSON.stringify(ajenos.slice(0, 3))}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  for (const [ancho, tema] of [[1440, 'light'], [1440, 'dark'], [390, 'light']]) {
    await estados(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA ${ancho} ${tema}: ${e.message.split('\n').slice(0, 4).join(' | ')}`); });
  }
  await b.close();
  anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
  fs.writeFileSync(`${OUT}/aserciones-c.txt`, log.join('\n') + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
