/**
 * Evidencia visual de la vitrina pública de medicamentos.
 *
 * Recorre `/buscar/medicamentos` como lo haría alguien sin sesión: mira la
 * vitrina, mide desde una ciudad, filtra por grupo terapéutico y abre la
 * disponibilidad de un medicamento con su mapa. Cada paso deja una captura.
 *
 * Las rutas de salida son **absolutas y dentro del repositorio**: el sandbox
 * descarta en silencio lo que se escribe fuera, y un PNG que no se escribió no
 * prueba nada.
 *
 * Uso: `node playwright/vitrina-medicamentos.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4310';
const SALIDA = '/home/pablo/Documents/GitHub/ALOVIDA/mantra-core-health/evidencias/marketplace-medicamentos-2026-08-27';

/**
 * Errores de consola que no son de esta pantalla.
 *
 * El de CSP lo produce el script antiparpadeo **en línea** de `index.html`
 * bajo la política del servidor de desarrollo, y aparece igual en pantallas que
 * nadie tocó —se verificó contra `/buscar/profesionales`—. Filtrarlo es lo que
 * hace que el código de salida signifique algo: sin esto el script fallaría
 * siempre y nadie miraría el resultado.
 */
const RUIDO = [
  /favicon/i,
  /Failed to load resource.*tile\.openstreetmap/i,
  /Content Security Policy directive/i,
];

async function main() {
  mkdirSync(SALIDA, { recursive: true });

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    const texto = mensaje.text();
    if (RUIDO.some((patron) => patron.test(texto))) return;
    errores.push(texto);
  });
  pagina.on('pageerror', (error) => errores.push(String(error)));

  const capturar = async (nombre, opciones = {}) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
    process.stdout.write(`  · ${nombre}.png\n`);
  };

  process.stdout.write('· Abriendo la vitrina…\n');
  await pagina.goto(`${BASE}/buscar/medicamentos`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('[data-testid="vitrina-grilla"]', { timeout: 20_000 });
  await capturar('01-vitrina', { fullPage: true });

  const cuantas = await pagina.locator('[data-testid="vitrina-grilla"] > li').count();
  process.stdout.write(`  ${cuantas} tarjetas en la vitrina.\n`);

  process.stdout.write('· Midiendo desde Santa Cruz…\n');
  await pagina.getByRole('button', { name: 'Santa Cruz', exact: true }).click();
  await pagina.waitForSelector('[data-testid="vitrina-origen"]', { timeout: 10_000 });
  await pagina.waitForTimeout(600);
  await capturar('02-cerca-de-santa-cruz', { fullPage: true });

  process.stdout.write('· Abriendo la disponibilidad del primer medicamento…\n');
  await pagina.locator('[data-testid="vitrina-ver-farmacias"]').first().click();
  await pagina.waitForSelector('[data-testid="vitrina-ofertas"]', { timeout: 15_000 });
  // El mapa carga Leaflet por chunk dinámico y sus tiles por red: sin esta
  // espera la captura sale con el recuadro gris y no prueba que el mapa ande.
  await pagina.waitForTimeout(2500);
  await capturar('03-disponibilidad-con-mapa', { fullPage: true });

  const ofertas = await pagina.locator('[data-testid="vitrina-ofertas"] > li').count();
  process.stdout.write(`  ${ofertas} farmacias listadas.\n`);

  process.stdout.write('· Filtrando por grupo terapéutico…\n');
  await pagina.getByRole('button', { name: 'Antiinfecciosos' }).click();
  await pagina.waitForTimeout(900);
  await capturar('04-filtro-antiinfecciosos', { fullPage: true });

  process.stdout.write('· Buscando «paracetamol»…\n');
  await pagina.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await pagina.waitForTimeout(700);
  // El campo del BANNER, no el del encabezado. `getByRole('searchbox')` toma
  // primero el buscador global de la cabecera, y escribir ahí navega a
  // `/buscar` — con lo que el resto del recorrido capturaba otra pantalla.
  const campo = pagina.locator('.vitrina-hero__buscador input');
  await campo.fill('paracetamol');
  await campo.press('Enter');
  await pagina.waitForTimeout(1200);
  await pagina.waitForSelector('[data-testid="vitrina-grilla"]', { timeout: 10_000 });
  const trasBuscar = await pagina.locator('[data-testid="vitrina-grilla"] > li').count();
  process.stdout.write(`  ${trasBuscar} tarjetas tras buscar.\n`);
  await capturar('05-busqueda-paracetamol', { fullPage: true });

  process.stdout.write('· Vista de teléfono…\n');
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(700);
  await capturar('06-telefono', { fullPage: true });

  await navegador.close();

  if (errores.length > 0) {
    process.stdout.write(`\n✗ ${errores.length} errores de consola:\n`);
    for (const error of errores.slice(0, 10)) process.stdout.write(`   ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\n✓ Capturas en ${SALIDA}, sin errores de consola.\n`);
}

main().catch((error) => {
  process.stderr.write(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
});
