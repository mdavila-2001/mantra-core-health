/**
 * Recorrido real de los carriles 13 y 16 con **Playwright sobre Chromium**.
 *
 * ## Por qué Playwright y no Cypress, que es la suite del repositorio
 *
 * La suite de regresión sigue siendo Cypress y este archivo no la reemplaza ni
 * la duplica: es la **evidencia funcional** que el protocolo de carriles exige
 * («capturas/logs/resultado Playwright/API»), pedida explícitamente en
 * Playwright. Vive en `scripts/` y no en `cypress/` justamente para que no se
 * confunda con la suite ni la CI intente correrlo como parte de ella.
 *
 * ## No simula nada
 *
 * Levanta Chromium contra la aplicación servida de verdad, abre sesión por la
 * pantalla de login contra `POST /iam/auth/login`, y comprueba que lo que las
 * dos consolas pintan sale de `GET /practices/:id/organization` y
 * `GET /diagnostic-units/administration` — observando las respuestas HTTP, no
 * el texto de la pantalla.
 *
 * Además de que cada pestaña responda, comprueba dos invariantes del carril:
 * que **ninguna pantalla muestre un uuid crudo** y que la consola del
 * laboratorio **no caiga en la lectura del directorio público**, que filtra a
 * unidades publicadas y es justo lo que la administración no debe usar.
 *
 * ## Cómo se corre
 *
 * ```bash
 * npm i -D playwright && npx playwright install chromium
 * E2E_BASE=http://localhost:4300 node scripts/e2e-carril-13-16.mjs
 * ```
 *
 * Necesita el backend levantado y el servidor de desarrollo proxeando hacia él
 * (`ng serve --proxy-config`), por el mismo motivo que documenta
 * `run-recorrido-real.mjs`: contra el artefacto del arnés la aplicación
 * hablaría con la API simulada y el verde no significaría nada.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.E2E_BASE ?? 'http://localhost:4300';
const USUARIO = process.env.E2E_USER ?? 'admin@redesa.test';
const CLAVE = process.env.E2E_PASS ?? 'S3cret-passw0rd';
const EVIDENCIA = process.env.E2E_OUT ?? './artifacts';

mkdirSync(EVIDENCIA, { recursive: true });

const pasos = [];
const peticiones = [];

function paso(nombre, ok, detalle = '') {
  pasos.push({ nombre, ok, detalle });
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

const navegador = await chromium.launch({ headless: true });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const pagina = await contexto.newPage();

// Se registra toda respuesta de los prefijos del carril: es la prueba de que la
// pantalla pidió lo que dice pedir, y con qué código respondió el servidor.
pagina.on('response', (respuesta) => {
  const url = respuesta.url();
  if (/\/(practices|diagnostic-units)(\/|\?|$)/.test(url)) {
    peticiones.push({ url: url.replace(BASE, ''), status: respuesta.status() });
  }
});

const erroresDeConsola = [];
pagina.on('console', (msg) => {
  if (msg.type() === 'error') erroresDeConsola.push(msg.text());
});

try {
  // ---- Sesión --------------------------------------------------------------
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  await pagina.getByLabel(/correo/i).first().fill(USUARIO);
  await pagina.getByLabel(/contrase/i).first().fill(CLAVE);
  // `Entrar` exacto: «Iniciar sesión» es el encabezado de la tarjeta, no el
  // control, y un `first()` sobre una expresión laxa lo tomaba a él.
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });

  // Un `SUPERADMIN` puede tener que elegir organización antes de entrar.
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByRole('button').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  paso('Sesión abierta contra la API real', true, pagina.url());
  await pagina.screenshot({ path: `${EVIDENCIA}/00-panel.png`, fullPage: true });

  // ---- CARRIL 13 -----------------------------------------------------------
  await pagina.goto(`${BASE}/administration/medical-organization`, {
    waitUntil: 'networkidle',
  });
  await pagina.waitForTimeout(1500);
  await pagina.screenshot({ path: `${EVIDENCIA}/10-c13-organizacion.png`, fullPage: true });

  const consola = peticiones.find((p) => /\/practices\/[^/]+\/organization/.test(p.url));
  paso(
    'C13 · la pantalla pide GET /practices/:id/organization',
    Boolean(consola) && consola.status === 200,
    consola ? `HTTP ${consola.status}` : 'no se observó la petición',
  );

  const textoC13 = await pagina.locator('body').innerText();
  paso(
    'C13 · pinta la organización que devolvió la API',
    /Organización médica/i.test(textoC13) && !/error inesperado/i.test(textoC13),
  );

  const pestanasC13 = await pagina.getByRole('tab').allInnerTexts();
  const esperadasC13 = ['Sedes', 'Áreas', 'Infraestructura', 'Servicios', 'Plantilla', 'Legajo', 'Inventario'];
  paso(
    'C13 · las siete pestañas del carril están',
    esperadasC13.every((p) => pestanasC13.some((t) => t.trim() === p)),
    pestanasC13.map((t) => t.trim()).join(' · '),
  );

  // Sedes: es la pestaña con datos reales del seed.
  const filasSedes = await pagina.locator('table tbody tr').count();
  paso('C13 · la pestaña de sedes trae filas reales', filasSedes > 0, `${filasSedes} fila(s)`);
  await pagina.screenshot({ path: `${EVIDENCIA}/11-c13-sedes.png`, fullPage: true });

  // Se recorren las siete: ninguna puede romper ni mostrar un uuid crudo.
  for (const nombre of esperadasC13.slice(1)) {
    await pagina.getByRole('tab', { name: nombre, exact: true }).click();
    await pagina.waitForTimeout(400);
    const panel = await pagina.locator('.tabs__panels').innerText();
    const tieneUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(panel);
    paso(
      `C13 · pestaña «${nombre}» responde sin exponer identificadores`,
      panel.trim().length > 0 && !tieneUuid,
      tieneUuid ? 'aparece un uuid en pantalla' : `${panel.trim().length} caracteres`,
    );
  }
  await pagina.screenshot({ path: `${EVIDENCIA}/12-c13-ultima-pestana.png`, fullPage: true });

  // ---- CARRIL 16 -----------------------------------------------------------
  await pagina.goto(`${BASE}/administration/medical-laboratory`, {
    waitUntil: 'networkidle',
  });
  await pagina.waitForTimeout(1500);
  await pagina.screenshot({ path: `${EVIDENCIA}/20-c16-laboratorio.png`, fullPage: true });

  const listado = peticiones.find((p) => p.url.includes('/diagnostic-units/administration'));
  paso(
    'C16 · la pantalla pide GET /diagnostic-units/administration',
    Boolean(listado) && listado.status === 200,
    listado ? `HTTP ${listado.status}` : 'no se observó la petición',
  );

  // La consola NO puede caer en el directorio público: aquél filtra a
  // publicadas y verificadas, y es justo lo que la administración no quiere.
  const cayoEnDirectorio = peticiones.some((p) => /\/diagnostic-units(\?|$)/.test(p.url));
  paso('C16 · no cae en la lectura del directorio público', !cayoEnDirectorio);

  const textoC16 = await pagina.locator('body').innerText();
  paso(
    'C16 · responde con su estado real, no con un error',
    /Laboratorio médico|Laboratorio/i.test(textoC16) && !/error inesperado/i.test(textoC16),
  );

  const pestanasC16 = await pagina.getByRole('tab').allInnerTexts();
  const esperadasC16 = ['Sucursales', 'Equipamiento', 'Estudios', 'Personal', 'Acreditaciones'];
  paso(
    'C16 · las cinco pestañas del carril están',
    esperadasC16.every((p) => pestanasC16.some((t) => t.trim() === p)),
    pestanasC16.map((t) => t.trim()).join(' · '),
  );

  paso(
    'C16 · declara su cobertura en vez de simular lo que no administra',
    /Qué administra esta pantalla y qué no/i.test(textoC16),
  );

  // ---- Navegación ----------------------------------------------------------
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const menu = await pagina.locator('nav').innerText();
  paso(
    'Las dos secciones entran al menú del administrador',
    /Organización médica/i.test(menu) && /Laboratorio médico/i.test(menu),
  );
  await pagina.screenshot({ path: `${EVIDENCIA}/30-menu.png`, fullPage: true });

  paso('Sin errores de consola durante el recorrido', erroresDeConsola.length === 0,
    erroresDeConsola.slice(0, 3).join(' | '));
} catch (error) {
  paso('Recorrido completo', false, String(error).slice(0, 300));
  await pagina.screenshot({ path: `${EVIDENCIA}/99-fallo.png`, fullPage: true }).catch(() => {});
} finally {
  writeFileSync(
    `${EVIDENCIA}/resultado.json`,
    JSON.stringify({ pasos, peticiones, erroresDeConsola }, null, 2),
  );
  await navegador.close();
}

const fallidos = pasos.filter((p) => !p.ok);
console.log(`\n${pasos.length - fallidos.length}/${pasos.length} comprobaciones en verde`);
process.exit(fallidos.length === 0 ? 0 : 1);
