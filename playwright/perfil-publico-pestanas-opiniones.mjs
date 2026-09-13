/**
 * Evidencia en navegador del pedido del 13/09/2026 sobre la ficha pública:
 * - las pestañas muestran su panel y no sacan de la ficha;
 * - publicaciones y «Dónde atiende» paginados con anterior / siguiente;
 * - «N opiniones» abre un modal con quién opinó, y la estrella con quién calificó.
 *
 * Se corre contra la maqueta (`mockBackend: true`) con `ng serve`:
 *   BASE=http://localhost:4231 SLUG=<slug> yarn node playwright/perfil-publico-pestanas-opiniones.mjs
 *
 * Suelto y no como spec: el runner de Playwright está roto en este worktree
 * (ver la nota de memoria del equipo). Sin `networkidle`: con HMR no llega.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4231';
const SLUG = process.env.SLUG ?? 'valeria-rojas';
const SALIDA = process.env.SALIDA ?? 'playwright-evidencia/perfil-publico';
mkdirSync(SALIDA, { recursive: true });

const fallos = [];
function comprobar(condicion, mensaje) {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${mensaje}`);
  if (!condicion) fallos.push(mensaje);
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1366, height: 900 } });
const errores = [];
pagina.on('console', (m) => {
  if (m.type() !== 'error') return;
  const texto = m.text();
  // Ruido conocido de `ng serve`: la CSP rechaza los scripts en línea de la recarga.
  if (texto.includes('Content Security Policy') && texto.includes('inline script')) return;
  errores.push(texto);
});
pagina.on('pageerror', (e) => errores.push(String(e)));

await pagina.goto(`${BASE}/p/${SLUG}`, { waitUntil: 'commit' });
await pagina.getByTestId('perfil-tab-acerca-de').waitFor({ timeout: 90_000 });

/** Reintenta un clic hasta que se cumpla la condición: antes de hidratar, se pierde. */
async function tocarHasta(localizador, condicion) {
  for (let i = 0; i < 8; i++) {
    await localizador.click();
    try {
      await pagina.waitForFunction(condicion, null, { timeout: 1500 });
      return true;
    } catch {
      /* todavía sin hidratar */
    }
  }
  return false;
}

const oculto = (id) => pagina.evaluate((i) => document.getElementById(i)?.hidden ?? null, id);

// 1. Pestañas.
comprobar(
  await tocarHasta(pagina.getByTestId('perfil-tab-acerca-de'), () =>
    document.getElementById('publicaciones')?.hidden === true,
  ),
  'tocar «Acerca de» deja sólo su panel',
);
comprobar(new URL(pagina.url()).pathname === `/p/${SLUG}`, `sigue en la ficha (${pagina.url()})`);
comprobar((await oculto('acerca-de')) === false, '«Acerca de» visible');
await pagina.screenshot({ path: `${SALIDA}/1-pestana-acerca-de.png` });

await pagina.getByTestId('perfil-tab-donde-queda').click();
await pagina.waitForFunction(() => document.getElementById('donde-queda')?.hidden === false);
comprobar((await oculto('acerca-de')) === true, '«Dónde atiende» oculta «Acerca de»');
const sedes = pagina.getByTestId('perfil-sedes').locator(':scope > li');
comprobar((await sedes.count()) === 2, `«Dónde atiende» muestra 2 sedes por página (${await sedes.count()})`);
const primeraSede = await sedes.first().innerText();
await pagina.getByTestId('perfil-sedes-pager-next').click();
await pagina.waitForTimeout(300);
comprobar((await sedes.first().innerText()) !== primeraSede, '«siguiente» cambia las sedes');
comprobar(
  (await pagina.getByTestId('perfil-sedes-pager-counter').innerText()).trim() === '2 de 2',
  'contador de sedes «2 de 2»',
);
comprobar(await pagina.getByTestId('perfil-sedes-pager-next').isDisabled(), '«siguiente» deshabilitado en la última');
await pagina.getByTestId('perfil-sedes').scrollIntoViewIfNeeded();
await pagina.screenshot({ path: `${SALIDA}/2-donde-atiende-pagina-2.png` });

await pagina.getByTestId('perfil-tab-publicaciones').click();
await pagina.waitForFunction(() => document.getElementById('publicaciones')?.hidden === false);
const posts = pagina.getByTestId('perfil-publicaciones').locator(':scope > li');
comprobar((await posts.count()) === 3, `publicaciones de a 3 (${await posts.count()})`);
comprobar(await pagina.getByTestId('perfil-publicaciones-pager-previous').isDisabled(), '«anterior» deshabilitado en la primera');
await pagina.getByTestId('perfil-publicaciones-pager-next').click();
await pagina.waitForTimeout(400);
comprobar((await posts.count()) === 1, `página 2 de publicaciones con 1 (${await posts.count()})`);
await pagina.getByTestId('perfil-publicaciones-pager-previous').click();
await pagina.waitForTimeout(400);
comprobar((await posts.count()) === 3, '«anterior» vuelve a la página 1');
await pagina.getByTestId('perfil-publicaciones-pager-next').scrollIntoViewIfNeeded();
await pagina.screenshot({ path: `${SALIDA}/3-publicaciones-paginadas.png` });

await pagina.getByTestId('perfil-tab-resumen').click();
await pagina.waitForTimeout(300);
comprobar((await oculto('publicaciones')) === false && (await oculto('acerca-de')) === false, '«Inicio» muestra todo');

// 2. Opiniones.
await pagina.evaluate(() => window.scrollTo(0, 0));
const botonOpiniones = pagina.getByTestId('perfil-opiniones');
const rotulo = (await botonOpiniones.innerText()).trim();
const cuantas = Number(rotulo.split(' ')[0]);
comprobar(/^\d+ opiniones?$/.test(rotulo), `botón «${rotulo}»`);
await botonOpiniones.click();
const autores = pagina.getByTestId('review-author');
await autores.first().waitFor({ timeout: 15_000 });
comprobar((await autores.count()) > 0 && (await autores.count()) <= 5, `modal con opiniones y su autor (${await autores.count()} en la página)`);
const nombres = await autores.allInnerTexts();
console.log('     autores:', nombres.join(' · '));
comprobar(nombres.every((n) => n.trim() !== '' && n !== 'Paciente verificado'), 'cada opinión dice quién la dio');
const resumen = await pagina.getByTestId('reviews-summary').innerText();
comprobar(resumen.includes(`${cuantas} calificaciones`), `el resumen suma ${cuantas} calificaciones`);
await pagina.screenshot({ path: `${SALIDA}/4-modal-opiniones.png` });

await pagina.getByTestId('reviews-tab-estrellas').click();
await pagina.getByTestId('raters-list').waitFor();
const estrellas = await pagina.getByTestId('rater-stars').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label')));
console.log('     estrellas:', estrellas.join(' · '));
comprobar(estrellas.length > 0 && estrellas.every((e) => /^\d estrellas?$/.test(e)), 'cada persona con sus estrellas');
if (await pagina.getByTestId('raters-pager-next').count()) {
  await pagina.getByTestId('raters-pager-next').click();
  await pagina.waitForTimeout(300);
  comprobar((await pagina.getByTestId('raters-pager-counter').innerText()).trim().startsWith('2 de'), 'las calificaciones del modal también se paginan');
}
await pagina.screenshot({ path: `${SALIDA}/5-modal-estrellas.png` });

await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(400);
comprobar((await pagina.getByTestId('review-author').count()) === 0, 'Escape cierra el modal');

await pagina.getByTestId('perfil-estrellas').click();
await pagina.getByTestId('raters-list').waitFor({ timeout: 15_000 });
comprobar(
  (await pagina.getByTestId('reviews-tab-estrellas').getAttribute('aria-selected')) === 'true',
  'la estrella abre directo «Quiénes dieron estrellas»',
);

// 3. Teléfono.
await pagina.keyboard.press('Escape');
await pagina.setViewportSize({ width: 400, height: 860 });
await pagina.waitForTimeout(400);
const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
comprobar(desborde <= 1, `sin scroll horizontal a 400 px (${desborde})`);
await pagina.getByTestId('perfil-opiniones').click();
await pagina.getByTestId('review-author').first().waitFor({ timeout: 15_000 });
await pagina.screenshot({ path: `${SALIDA}/6-modal-telefono.png` });

console.log('errores de consola:', errores.length ? errores : 'ninguno');
comprobar(errores.length === 0, 'sin errores de consola (fuera del ruido de CSP de ng serve)');
await navegador.close();
console.log(fallos.length === 0 ? '\nTODO OK' : `\n${fallos.length} FALLAS`);
process.exit(fallos.length === 0 ? 0 : 1);
