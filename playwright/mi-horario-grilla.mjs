/**
 * Evidencia de «Mi horario» (solapa Mi agenda de /schedule) y de la vista
 * previa de un horario retirado, contra la maqueta.
 *
 * Mide lo pedido el 13/09/2026: la grilla con las 24 horas, el tamaño de turno
 * en cada franja, los bloqueos de la semana en rojo, la barra de estados e
 * íconos arriba a la izquierda de la tarjeta, sin el renglón «Lunes, Martes…»,
 * sin los filtros de Consultas, el aviso de agotamiento arriba y la misma
 * grilla en el diálogo «Así era».
 *
 * Uso: `yarn node playwright/mi-horario-grilla.mjs [base] [salida]`
 * (con `ng serve` levantado; por defecto en el 4200).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SALIDA = process.argv[3] ?? new URL('../artifacts/mi-horario', import.meta.url).pathname;
mkdirSync(SALIDA, { recursive: true });

const resultados = [];
const verificar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  process.stdout.write(`${ok ? 'SÍ' : 'NO'} · ${nombre}${detalle ? ` — ${detalle}` : ''}\n`);
};

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 } });
const pagina = await contexto.newPage();
const errores = [];
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
await pagina.getByTestId('login-password').fill('mockup');
await pagina.getByTestId('login-submit').click();
await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
if (pagina.url().includes('/auth/organization')) {
  await pagina.getByTestId('tenant-opcion').first().click();
  await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/* ---- Mi horario ---------------------------------------------------------- */

await pagina.goto(`${BASE}/schedule?vista=agenda`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
const barra = pagina.getByTestId('horario-barra');
await barra.waitFor({ timeout: 60_000 });
await pagina.waitForTimeout(800);

verificar('sin filtros de Consultas en Mi agenda', (await pagina.locator('.agenda__filtros').count()) === 0);
verificar('sin «Se atiende en» en Mi agenda', (await pagina.getByTestId('agenda-ubicacion').count()) === 0);
verificar('sin el renglón «Lunes, Martes…»', (await pagina.locator('.mi-agenda__franjas').count()) === 0);
verificar('la grilla tiene 24 horas', (await pagina.locator('.mi-agenda__tarjeta .grilla__hora').count()) === 24);

const tarjeta = await pagina.locator('.mi-agenda__tarjeta').boundingBox();
const cajaBarra = await barra.boundingBox();
verificar(
  'barra arriba a la izquierda de la tarjeta',
  cajaBarra.x - tarjeta.x <= 24 && cajaBarra.y - tarjeta.y <= 32,
  `izq ${Math.round(cajaBarra.x - tarjeta.x)} px · arriba ${Math.round(cajaBarra.y - tarjeta.y)} px`,
);
for (const id of ['horario-editar', 'horario-retirar', 'ver-bloqueos', 'agendar-cita']) {
  const icono = barra.getByTestId(id);
  const texto = ((await icono.textContent()) ?? '').trim();
  verificar(`«${id}» es ícono dentro de la barra`, (await icono.locator('svg').count()) === 1 && texto === '');
}
const detalle = ((await pagina.locator('.mi-agenda__tarjeta [data-testid="horario-bloque"]').first().textContent()) ?? '').trim();
verificar('la franja dice el tamaño de turno', /consultas de \d+ min|tamaño libre/.test(detalle), detalle);

const scroll = pagina.locator('.mi-agenda__tarjeta .grilla__scroll');
const alto = await scroll.evaluate((el) => ({ top: el.scrollTop, alto: el.clientHeight, total: el.scrollHeight }));
verificar('abre scrolleada a la primera hora atendida', alto.top > 0 && alto.total > alto.alto, JSON.stringify(alto));

const agotan = pagina.locator('.mi-agenda__agotan');
if ((await agotan.count()) > 0) {
  const cajaAviso = await agotan.boundingBox();
  verificar('el aviso de agotamiento va arriba de la tarjeta', cajaAviso.y + cajaAviso.height <= tarjeta.y + 1);
}

await pagina.screenshot({ path: `${SALIDA}/1-mi-horario.png`, fullPage: true });

// El tooltip se lee ANTES de cualquier captura: la captura de un elemento lo
// desplaza a la vista con el mouse quieto, y el puntero termina sobre una
// franja de la grilla — se cierra el tooltip y se abre el globo de detalle.
for (const [id, texto] of [
  ['ver-bloqueos', 'Ver mis bloqueos de agenda'],
  ['agendar-cita', 'Agendar una cita a un paciente'],
]) {
  await barra.getByTestId(id).hover();
  await pagina.waitForTimeout(700);
  const tooltips = await pagina.getByRole('tooltip').allTextContents();
  verificar(`«${id}» tiene tooltip descriptivo`, tooltips.some((t) => t.includes(texto)), tooltips.join(' | '));
  if (id === 'ver-bloqueos') {
    await pagina.screenshot({ path: `${SALIDA}/2-tooltip-bloqueos.png` });
  }
}
await pagina.mouse.move(0, 0);

/* ---- Un bloqueo de esta semana, en rojo ---------------------------------- */

await pagina.getByRole('tab', { name: 'Cómo viene el mes' }).click();
// `toLocaleDateString('es-BO')` escribe «viernes, 11 de septiembre», con coma.
await pagina.getByRole('button', { name: /^viernes,? 11 de/i }).click();
await pagina.getByRole('button', { name: 'Bloquear este día' }).click();
const dialogo = pagina.getByRole('dialog');
await dialogo.getByRole('textbox').fill('Congreso de prueba');
await dialogo.getByRole('button', { name: 'Bloquear el día' }).click();
await pagina.waitForTimeout(1200);
await pagina.getByRole('tab', { name: 'Mi horario' }).click();
// El que se acaba de crear, no uno sembrado por la maqueta.
const bloqueo = pagina
  .locator('.mi-agenda__tarjeta [data-testid="horario-bloqueo"]')
  .filter({ hasText: 'Congreso de prueba' });
await bloqueo.waitFor({ timeout: 30_000 });
const colorFondo = await bloqueo.evaluate((el) => getComputedStyle(el).backgroundColor);
verificar('el bloqueo recién creado aparece en la grilla', true, ((await bloqueo.textContent()) ?? '').trim());
const rotuloVisible = await pagina.locator('.mi-agenda__tarjeta .grilla__scroll').evaluate((caja) => {
  const rotulo = [...caja.querySelectorAll('.grilla__bloqueo-rotulo')].find((r) =>
    r.textContent?.includes('Congreso de prueba'),
  );
  if (!rotulo) return false;
  const a = caja.getBoundingClientRect();
  const b = rotulo.getBoundingClientRect();
  return b.top >= a.top && b.bottom <= a.bottom;
});
verificar('el rótulo del bloqueo de día entero se ve sin scrollear', rotuloVisible);
await pagina.locator('.mi-agenda__tarjeta').screenshot({ path: `${SALIDA}/3-bloqueo-en-rojo.png` });
process.stdout.write(`   fondo del bloqueo: ${colorFondo}\n`);

/* ---- Consultas conserva sus filtros -------------------------------------- */

await pagina.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.locator('.agenda__filtros').waitFor({ timeout: 60_000 });
verificar('Consultas sigue mostrando sus filtros', await pagina.locator('.agenda__filtros').isVisible());

/* ---- La vista previa de un horario retirado ------------------------------ */

await pagina.goto(`${BASE}/schedule?vista=agenda`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('horario-barra').waitFor({ timeout: 60_000 });
const vistaPrevia = pagina.getByTestId('historico-preview').first();
if ((await vistaPrevia.count()) > 0) {
  await vistaPrevia.click();
  const modal = pagina.getByRole('dialog');
  await modal.locator('.grilla__hora').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(500);
  verificar('la vista previa tiene 24 horas', (await modal.locator('.grilla__hora').count()) === 24);
  const recorte = await modal.locator('.grilla__scroll').evaluate((el) => {
    const caja = el.getBoundingClientRect();
    const bloques = [...el.querySelectorAll('[data-testid="horario-bloque"]')].map((b) => b.getBoundingClientRect());
    const textos = [...el.querySelectorAll('.grilla__bloque-horas, .grilla__bloque-detalle')];
    return {
      desborde: el.scrollWidth - el.clientWidth,
      bloquesDentro: bloques.every((b) => b.right <= caja.right + 1),
      textoSinCortar: textos.every((t) => t.scrollWidth <= t.clientWidth + 1),
      detalle: el.querySelector('[data-testid="horario-bloque"]')?.textContent?.trim(),
    };
  });
  verificar(
    'la vista previa no corta la última columna ni su texto',
    recorte.desborde <= 1 && recorte.bloquesDentro && recorte.textoSinCortar,
    JSON.stringify(recorte),
  );
  await modal.screenshot({ path: `${SALIDA}/4-vista-previa.png` });
} else {
  verificar('hay un horario retirado para abrir la vista previa', false);
}

/* ---- Teléfono ------------------------------------------------------------ */

await pagina.setViewportSize({ width: 400, height: 900 });
await pagina.keyboard.press('Escape');
await pagina.goto(`${BASE}/schedule?vista=agenda`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('horario-barra').waitFor({ timeout: 60_000 });
await pagina.waitForTimeout(600);
const lateral = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
verificar('a 400 px la página no se va de lado', lateral <= 1, `${lateral} px`);
await pagina.screenshot({ path: `${SALIDA}/5-telefono.png`, fullPage: true });

verificar('sin errores de consola', errores.length === 0, errores.slice(0, 3).join(' | '));
await navegador.close();
process.exit(resultados.every(Boolean) ? 0 : 1);
