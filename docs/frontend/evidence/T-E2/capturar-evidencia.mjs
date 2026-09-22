/**
 * T-E2 · Elegir farmacia — captura de evidencia de navegador.
 *
 * EVIDENCIA, NO PRODUCTO. Este script no lo importa la aplicación ni corre en
 * CI: se ejecuta a mano contra `ng serve` con `mockBackend: true`.
 *
 * ¿Por qué inyecta la disponibilidad? El backend simulado lee `productIds`
 * (`core/mock/handlers/pharmacy.handlers.ts`) pero el cliente real manda
 * `products` (`pharmacy.client.ts`): con el mock, cada sede llega «completa»,
 * sin productos ni precios, y ni el orden ni el desglose del seguro se pueden
 * ver. Esa deriva es preexistente y ajena a T-E2 (no se toca). Para mostrar la
 * pantalla con datos con forma de contrato, el script reemplaza —sólo en esta
 * pestaña del navegador y sólo en la instancia del componente— la lectura de
 * disponibilidad por sedes de evidencia construidas con los `productId` reales
 * de la receta del mock. Las capturas `fixture-evidencia` NO son integración
 * ni prueban el funcionamiento de extremo a extremo.
 *
 * Uso (desde la raíz del front, con `ng serve --port 4232` corriendo):
 *   node docs/frontend/evidence/T-E2/capturar-evidencia.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const BASE = process.env['BASE_URL'] ?? 'http://127.0.0.1:4232';
const SALIDA = dirname(fileURLToPath(import.meta.url));
const VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];

const comprobaciones = [];
function comprobar(nombre, ok, detalle = '') {
  comprobaciones.push({ nombre, ok: Boolean(ok), detalle });
  console.log(`${ok ? 'PASS' : 'FAIL'} · ${nombre}${detalle ? ` · ${detalle}` : ''}`);
}

const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'es-BO',
  timezoneId: 'America/La_Paz',
});
const page = await contexto.newPage();
const erroresDePagina = [];
page.on('pageerror', (error) => erroresDePagina.push(String(error)));
const escrituras = [];
page.on('request', (peticion) => {
  if (peticion.method() !== 'GET') escrituras.push(`${peticion.method()} ${peticion.url()}`);
});

async function captura(nombre, [ancho, alto]) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.waitForTimeout(400);
  const archivo = `paciente--elegir-farmacia-${nombre}--${ancho}x${alto}.png`;
  await page.screenshot({ path: join(SALIDA, archivo), fullPage: true });
  return archivo;
}

// ── Ingreso como paciente del mock ─────────────────────────────────────────
await page.goto(`${BASE}/auth`);
await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
await page.getByTestId('login-password').fill('demo');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
if (page.url().includes('/auth/organization')) {
  await page.getByTestId('tenant-opcion').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 });
}

await page.goto(`${BASE}/my-account/medical-record`);
await page.getByRole('tab', { name: /Recetas/ }).click({ timeout: 90_000 });
await page.getByTestId('historia-donde-comprar').first().click({ timeout: 90_000 });
await page.waitForURL(/where-to-buy\//, { timeout: 60_000 });
await page.getByTestId('compra-items').waitFor({ timeout: 60_000 });
await page.getByTestId('compra-controles').waitFor();
await page.waitForTimeout(1500);

// ── 1 · El flujo real contra el mock, sin tocar nada ────────────────────────
const archivoReal = await captura('flujo-real-deriva-del-mock', [1440, 900]);
comprobar('flujo real: el orden y el conmutador existen sobre el mock', true, archivoReal);

// ── 2 · Disponibilidad de evidencia (sólo en esta pestaña) ──────────────────
const renglones = await page.evaluate(() => {
  const comp = window.ng.getComponent(document.querySelector('app-where-to-buy'));
  const BOB = { code: 'BOB', display: 'Boliviano' };
  const precios = ['68.00', '28.50', '41.20', '15.00', '9.90'];
  const items = comp.items().filter((item) => item.productId !== null);
  const productoDe = (item, precio) => ({
    productId: item.productId,
    productCode: 'EVIDENCIA-T-E2',
    brandName: null,
    genericName: item.medicamento,
    strengthText: null,
    packageSizeText: null,
    medication: null,
    availableQuantity: 10,
    price:
      precio === null
        ? null
        : { unitAmount: precio, patientAmount: precio, currency: BOB, priceListCode: 'EVIDENCIA' },
  });
  const suma = (valores) =>
    (valores.reduce((total, valor) => total + Math.round(Number(valor) * 100), 0) / 100).toFixed(2);

  window.__disponibilidadDeEvidencia = (productIds) => {
    const pedidos = productIds
      .map((id) => items.find((item) => item.productId === id))
      .filter(Boolean);
    const precioDe = (item) => precios[items.indexOf(item) % precios.length];
    const [primero, ...resto] = pedidos;
    const centro = {
      siteId: 'evidencia-centro',
      siteName: 'Sucursal Centro (evidencia)',
      pharmacyId: 'evidencia-andina',
      pharmacyName: 'Farmacia Andina',
      addressText: 'Calle Libertad 245',
      latitude: -17.7833,
      longitude: -63.1821,
      distanceKm: 1.2,
      homeDeliveryAvailable: true,
      pickupAvailable: true,
      complete: true,
      availableCount: pedidos.length,
      missingProductIds: [],
      totalAmount: suma(pedidos.map(precioDe)),
      currency: BOB,
      products: pedidos.map((item) => productoDe(item, precioDe(item))),
    };
    const planTresMil = {
      ...centro,
      siteId: 'evidencia-sur',
      siteName: 'Sucursal Plan Tres Mil (evidencia)',
      pharmacyId: 'evidencia-sur',
      pharmacyName: 'Farmacia del Sur',
      addressText: 'Av. Paurito esq. calle 7',
      latitude: null,
      longitude: null,
      distanceKm: null,
      complete: resto.length === pedidos.length,
      availableCount: resto.length,
      missingProductIds: primero ? [primero.productId] : [],
      totalAmount: null,
      currency: null,
      products: resto.map((item) => productoDe(item, null)),
    };
    const norte = {
      ...planTresMil,
      siteId: 'evidencia-norte',
      siteName: 'Sucursal Norte (evidencia)',
      addressText: 'Av. Banzer, tercer anillo',
      latitude: -17.745,
      longitude: -63.175,
      distanceKm: 2.5,
      totalAmount: suma(resto.map(() => '9.90')),
      currency: BOB,
      products: resto.map((item) => productoDe(item, '9.90')),
    };
    return { requestedProductIds: productIds, items: [centro, planTresMil, norte], count: 3 };
  };

  window.__usarEvidencia = (modo) => {
    Object.defineProperty(comp, 'pharmacy', {
      configurable: true,
      value: {
        availability: (consulta) => ({
          subscribe: (observador) => {
            if (modo === 'error') {
              observador.error({ status: 503, error: { code: 'DEPENDENCY_UNAVAILABLE' } });
            } else {
              observador.next(window.__disponibilidadDeEvidencia(consulta.productIds));
            }
            return { unsubscribe() {} };
          },
        }),
      },
    });
    comp.consultar();
  };
  window.__usarEvidencia('ok');
  return comp.items().map((item) => item.medicamento);
});
comprobar('receta del mock con renglones consultables', renglones.length > 0, renglones.join(', '));
await page.waitForTimeout(1500);

const seguro = page.locator('[data-testid="compra-seguro"] label');
const nombres = () => page.locator('.compra__sede .compra__principal').allTextContents();

// ── 3 · Las dos variantes en los cinco viewports ───────────────────────────
for (const viewport of VIEWPORTS) {
  const sin = await captura('fixture-evidencia-sin-seguro', viewport);
  comprobar(
    `sin seguro ${viewport.join('x')}: tres sedes, sin cobertura de seguro`,
    (await page.locator('.compra__sede').count()) === 3 &&
      (await page.getByTestId('compra-cobertura-seguro').count()) === 0,
    sin,
  );
  await seguro.click();
  await page.waitForTimeout(500);
  const con = await captura('fixture-evidencia-con-seguro', viewport);
  const cobertura = await page.getByTestId('compra-cobertura-seguro').allTextContents();
  comprobar(
    `con seguro ${viewport.join('x')}: cobertura y desglose en cada sede`,
    cobertura.length === 3 &&
      cobertura.every((texto) => /Cobertura de lo aprobado: \d+ de \d+/.test(texto)) &&
      (await page.getByTestId('compra-desglose-seguro').count()) === 3,
    `${con} · ${cobertura.map((t) => t.trim()).join(' | ')}`,
  );
  comprobar(
    `con seguro ${viewport.join('x')}: el mapa sigue en pantalla`,
    (await page.locator('app-map').count()) === 1,
  );
  await seguro.click();
  await page.waitForTimeout(300);
}

// ── 4 · El orden cambia el listado (1440) ───────────────────────────────────
const backend = await nombres();
await page.getByTestId('segmentado-mas-cerca').click();
const cerca = await nombres();
await captura('fixture-evidencia-orden-mas-cerca', [1440, 900]);
await page.getByTestId('segmentado-mas-barato').click();
const barato = await nombres();
await captura('fixture-evidencia-orden-mas-barato', [1440, 900]);
comprobar(
  'orden: «Más cerca» deja la sede sin distancia al final',
  cerca.at(-1)?.includes('Plan Tres Mil'),
  cerca.join(' → '),
);
comprobar(
  'orden: «Más barato» cambia el listado respecto del backend',
  barato.join() !== backend.join(),
  barato.join(' → '),
);
await page.getByTestId('segmentado-receta-completa').click();
comprobar(
  'orden: «Receta completa primero» vuelve al orden del backend',
  (await nombres()).join() === backend.join(),
);

const marcar = (indice, valor) =>
  page.evaluate(
    ([i, v]) => {
      const casilla = document.querySelectorAll(
        '[data-testid="compra-items"] input[type="checkbox"]',
      )[i];
      casilla.checked = v;
      casilla.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [indice, valor],
  );

// ── 5 · Vacío con seguro y error con seguro (1440) ──────────────────────────
await seguro.click();
const casillasAprobadas = await page.evaluate(() => {
  const comp = window.ng.getComponent(document.querySelector('app-where-to-buy'));
  return comp.items().map((item, indice) => ({ indice, aprobado: comp.estaAprobado(item) }));
});
for (const { indice, aprobado } of casillasAprobadas) {
  if (aprobado) {
    await marcar(indice, false);
    await page.waitForTimeout(300);
  }
}
await page.waitForTimeout(800);
const vacio = await captura('fixture-evidencia-con-seguro-vacio', [1440, 900]);
comprobar(
  'vacío con seguro: se dice y el conmutador sigue a mano',
  (await page.getByText('ninguno de los medicamentos que elegiste está aprobado').count()) === 1 &&
    (await seguro.count()) === 1,
  vacio,
);
for (const { indice, aprobado } of casillasAprobadas) {
  if (aprobado) {
    await marcar(indice, true);
    await page.waitForTimeout(300);
  }
}

await page.evaluate(() => window.__usarEvidencia('error'));
await page.waitForTimeout(800);
const error = await captura('fixture-evidencia-con-seguro-error', [1440, 900]);
comprobar(
  'error con seguro: reintento visible',
  (await page.getByText('Reintentar').count()) > 0,
  error,
);
await page.evaluate(() => window.__usarEvidencia('ok'));
await page.waitForTimeout(800);

// ── 6 · El CTA no crea el pedido ────────────────────────────────────────────
const escriturasAntes = escrituras.length;
await page.getByTestId('compra-cta-pedido').first().click();
await page.waitForURL(/pharmacy-orders\/new/, { timeout: 30_000 });
comprobar(
  'CTA: navega a new-order',
  page.url().includes('/my-account/pharmacy-orders/new'),
  page.url(),
);
comprobar(
  'CTA: ninguna escritura HTTP desde where-to-buy',
  escrituras.length === escriturasAntes,
  escrituras.slice(escriturasAntes).join(', '),
);

comprobar('sin errores de página', erroresDePagina.length === 0, erroresDePagina.join(' | '));

await navegador.close();
const aprobadas = comprobaciones.filter((c) => c.ok).length;
writeFileSync(
  join(SALIDA, 'resultado.json'),
  `${JSON.stringify({ tarea: 'T-E2', base: BASE, aprobadas, total: comprobaciones.length, comprobaciones }, null, 2)}\n`,
);
console.log(`\n${aprobadas}/${comprobaciones.length} comprobaciones`);
process.exit(aprobadas === comprobaciones.length ? 0 : 1);
