/**
 * Evidencia de navegador del rótulo «de ejemplo» en la vitrina de una
 * aseguradora (24/10/2026), contra el simulador, con la cuenta de paciente.
 *
 * - BISA (catálogo de ejemplo): aviso «Planes de ejemplo» arriba, rótulo
 *   «De ejemplo» en cada tarjeta de «Comparar planes» y en la pestaña de un plan.
 * - Seguros Andina (catálogo sembrado): sin aviso ni rótulo, con la nota de
 *   siempre («tal como lo publicó la aseguradora»).
 * - A 390 px: el aviso no desborda la página.
 *
 * Uso: `BASE=http://localhost:4311 node playwright/planes-de-ejemplo.mjs`
 * (con `ng serve` del simulador levantado). Capturas en
 * `evidencias/planes-de-ejemplo-2026-10-24/`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env['BASE'] ?? 'http://localhost:4200';
const SALIDA = 'evidencias/planes-de-ejemplo-2026-10-24';
mkdirSync(SALIDA, { recursive: true });

const resultados = [];
function comprobar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok });
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

// El Chromium del contenedor, si lo hay: el del proyecto puede ser otra versión.
const navegador = await chromium.launch(
  process.env['CHROMIUM'] ? { executablePath: process.env['CHROMIUM'] } : {},
);
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));

await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
await pagina.getByTestId('login-password').fill('mockup');
await pagina.getByTestId('login-password').press('Enter');
await pagina.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });

async function abrir(slug) {
  await pagina.goto(`${BASE}/insurers-directory/${slug}`, { waitUntil: 'domcontentloaded' });
  await pagina.getByTestId('aseguradora-planes').waitFor({ timeout: 60_000 });
}

// ── BISA: catálogo de ejemplo ─────────────────────────────────────────────
await abrir('bisa-seguros-y-reaseguros-s-a');
const aviso = pagina.getByTestId('aseguradora-de-ejemplo');
await aviso.waitFor();
const textoDelAviso = (await aviso.textContent()) ?? '';
comprobar('BISA muestra el aviso «Planes de ejemplo»', textoDelAviso.includes('Planes de ejemplo'));
comprobar(
  'el aviso dice que no es una oferta de la compañía',
  textoDelAviso.includes('no son una oferta de la compañía'),
);
comprobar(
  'BISA no dice «tal como lo publicó la aseguradora»',
  !((await pagina.textContent('body')) ?? '').includes('tal como lo publicó la aseguradora'),
);
const ofertas = pagina.getByTestId('aseguradora-oferta');
const cuantasOfertas = await ofertas.count();
const rotuladas = await pagina
  .getByTestId('aseguradora-comparar')
  .getByTestId('plan-de-ejemplo')
  .count();
comprobar(
  'cada tarjeta de «Comparar planes» lleva «De ejemplo»',
  cuantasOfertas > 0 && rotuladas === cuantasOfertas,
  `${rotuladas}/${cuantasOfertas}`,
);
await pagina.screenshot({ path: `${SALIDA}/01-bisa-comparar-1440.png` });
await ofertas.first().scrollIntoViewIfNeeded();
await pagina.screenshot({ path: `${SALIDA}/01b-bisa-tarjetas-1440.png` });

await pagina.getByTestId('oferta-ver-clausulas').first().click();
const enLaPestana = pagina.getByTestId('aseguradora-plan').getByTestId('plan-de-ejemplo');
await enLaPestana.first().waitFor();
comprobar('la pestaña del plan lleva «De ejemplo»', (await enLaPestana.count()) >= 1);
await pagina.screenshot({ path: `${SALIDA}/02-bisa-plan-1440.png` });

// ── Seguros Andina: catálogo sembrado ────────────────────────────────────
await abrir('seguros-andina');
await pagina.waitForTimeout(500);
comprobar(
  'Seguros Andina no muestra el aviso',
  (await pagina.getByTestId('aseguradora-de-ejemplo').count()) === 0,
);
comprobar(
  'Seguros Andina no rotula sus planes',
  (await pagina.getByTestId('plan-de-ejemplo').count()) === 0,
);
comprobar(
  'Seguros Andina conserva «tal como lo publicó la aseguradora»',
  ((await pagina.textContent('body')) ?? '').includes('tal como lo publicó la aseguradora'),
);
await pagina.screenshot({ path: `${SALIDA}/03-andina-sin-rotulo-1440.png` });

// ── 390 px ────────────────────────────────────────────────────────────────
await pagina.setViewportSize({ width: 390, height: 844 });
await abrir('bisa-seguros-y-reaseguros-s-a');
await pagina.getByTestId('aseguradora-de-ejemplo').scrollIntoViewIfNeeded();
const caja = await pagina.getByTestId('aseguradora-de-ejemplo').boundingBox();
comprobar(
  'a 390 px el aviso entra en el ancho',
  caja !== null && caja.x >= 0 && caja.x + caja.width <= 390,
  caja ? `x=${Math.round(caja.x)} ancho=${Math.round(caja.width)}` : 'sin caja',
);
await pagina.screenshot({ path: `${SALIDA}/04-bisa-390.png` });

comprobar('sin errores de página', errores.length === 0, errores.join(' | '));

await navegador.close();
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} comprobaciones`);
process.exit(fallas === 0 ? 0 : 1);
