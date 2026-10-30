/**
 * Evidencia del alta de una organización médica ampliada (paridad con imagenología +
 * número de registro del SEDES + director médico), contra la maqueta:
 *
 * - Recorre las 12 páginas del formulario a 1440 px y a 390 px, con captura de cada una.
 * - En cada una mide: sin desborde horizontal; la tarjeta centrada (holgura izquierda ≈ derecha)
 *   y a lo ancho; el contenido no pegado a la izquierda.
 * - Los errores de validación del NIT, del registro del SEDES y de la matrícula se ven y frenan.
 * - La mutación completa: UI → request (cuerpo exacto) → respuesta del simulador → pantalla de éxito.
 * - Un error real del simulador (409, correo ya registrado): la pantalla lo explica y deja reintentar.
 *   El 422 de la API no se alcanza desde el formulario (se bloquea antes): lo cubren los specs.
 * - El simulador contesta dentro de la aplicación, sin petición de red: la petición y la respuesta se
 *   leen con un espía sobre el `HttpClient` del cliente del alta (ver `instalarEspia`).
 *
 * Nunca espera `networkidle` (con HMR no llega). Datos sintéticos: nada real.
 *
 * Uso: `node playwright/alta-organizacion-medica.mjs [urlBase]`  (por omisión http://127.0.0.1:4300)
 * Variables: `PW_CHROMIUM` (ruta del ejecutable), `SALIDA` (carpeta de capturas),
 * `IMAGENOLOGIA=1` (sólo mide la geometría del selector de punto de imagenología, para compararla con `HEAD`),
 * `SOLO_UNIPERSONAL=1` (sólo la UNIPERSONAL y el 409), `SIN_UNIPERSONAL=1`, `PREFIJO_SALIDA` (prefijo de los json),
 * `ANCHOS` (px separados por coma; por omisión `1440,390`; la línea base del repo es
 * `1920,1440,1024,768,390`), `TEMAS` (`claro`, `oscuro` o ambos; por omisión `claro`).
 *
 * Además de las capturas, en cada página mide el ancho real de cada campo y de cada control
 * (`mediciones.json`) y verifica la disposición en columnas por ancho: una columna en móvil, dos desde
 * 672 px (42 rem) y tres desde 1120 px (§5 de `composition-rules.md`), sin controles que se salgan.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { jsPDF } from 'jspdf';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4300';
const SALIDA =
  process.env['SALIDA'] ??
  fileURLToPath(
    new URL('../docs/refactor-profesional/trabajo/capturas/alta-organizacion-medica-2026-10-28', import.meta.url),
  );
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const ALTOS = { 1920: 1080, 1440: 900, 1024: 768, 768: 1024, 390: 844 };
const ETIQUETAS = { 1920: 'escritorio-1920', 1440: 'escritorio-1440', 1024: 'tablet-1024', 768: 'tablet-768', 390: 'movil-390' };
const ANCHOS = (process.env['ANCHOS'] ?? '1440,390').split(',').map((n) => Number(n.trim()));
const TEMAS = (process.env['TEMAS'] ?? 'claro').split(',').map((t) => t.trim());
const VIEWPORTS = TEMAS.flatMap((tema) =>
  ANCHOS.map((width) => ({
    etiqueta: `${ETIQUETAS[width] ?? `ancho-${width}`}${tema === 'oscuro' ? '-oscuro' : ''}`,
    width,
    height: ALTOS[width] ?? 900,
    tema,
  })),
);
const mediciones = [];

const RUTA_ALTA = '/iam/auth/register-organization';
const T = (id) => `[data-testid="${id}"]`;

function pdf(titulo) {
  const doc = new jsPDF();
  doc.text(titulo, 20, 30);
  doc.text('Documento de prueba. Sin datos personales.', 20, 45);
  return { name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from(doc.output('arraybuffer')) };
}

async function medir(p) {
  return p.evaluate(() => {
    const vw = window.innerWidth;
    const caja = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { izq: Math.round(r.left), der: Math.round(vw - r.right), ancho: Math.round(r.width) };
    };
    return {
      vw,
      desborde: document.documentElement.scrollWidth - vw,
      conjunto: caja('.registro-conjunto'),
      tarjeta: caja('.registro'),
      form: caja('app-paginated-form'),
    };
  });
}

/**
 * Mide la página visible: el ancho de la rejilla, de cada campo (celda) y de cada control, y en cuántos
 * renglones se reparten las celdas. Las celdas con `[data-campo]` o con `app-form-field` son los campos.
 */
async function medirCampos(p) {
  return p.evaluate(() => {
    const vw = window.innerWidth;
    const grilla = document.querySelector('.paginated-form__campos');
    if (!grilla) return null;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const caja = (el) => {
      const r = el.getBoundingClientRect();
      return { izq: Math.round(r.left), der: Math.round(r.right), arriba: Math.round(r.top), abajo: Math.round(r.bottom), ancho: Math.round(r.width) };
    };
    const g = caja(grilla);
    const celdas = [...grilla.children].filter(visible).map((el) => ({
      clave: el.getAttribute('data-campo') ?? el.getAttribute('data-testid') ?? el.tagName.toLowerCase(),
      ...caja(el),
    }));
    const controles = [
      ...grilla.querySelectorAll('input:not([type=file]):not([type=hidden]):not([type=checkbox]), [role=combobox]'),
    ]
      .filter(visible)
      .map((el) => ({
        id: el.getAttribute('data-testid') ?? el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.getAttribute('name') ?? 'control',
        ...caja(el),
      }));
    return {
      vw,
      grilla: g,
      celdas,
      controles,
      renglones: new Set(celdas.map((c) => c.arriba)).size,
      desbordeControl: controles.filter((c) => c.der > vw + 1 || c.izq < -1).map((c) => c.id),
      desbordeCelda: celdas.filter((c) => c.der > g.der + 1 || c.izq < g.izq - 1).map((c) => c.clave),
    };
  });
}

/**
 * La disposición que declara el motor por ancho: 1 columna por debajo de 672 px, 2 desde 672 px (42 rem)
 * y 3 desde 1120 px (70 rem). Devuelve cuántas celdas de cada fila hay, de arriba abajo.
 */
function celdasPorRenglon(m) {
  const filas = new Map();
  for (const c of m.celdas) filas.set(c.arriba, (filas.get(c.arriba) ?? 0) + 1);
  return [...filas.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

const ubicaciones = [];

/**
 * Mide el bloque de lo deducido de un selector de punto (`<id>-map-deducido`): calle, distrito y, en las
 * sucursales del alta médica, el nombre. Devuelve las celdas (hijos directos de la rejilla) y el ancho de cada
 * casilla de texto (textarea, input y combobox).
 */
async function medirDeducido(p, idMapa) {
  return p.evaluate((id) => {
    const bloque = document.querySelector(`[data-testid="${id}-deducido"]`);
    if (!bloque) return null;
    const vw = window.innerWidth;
    const caja = (el) => {
      const r = el.getBoundingClientRect();
      return { izq: Math.round(r.left), der: Math.round(r.right), arriba: Math.round(r.top), ancho: Math.round(r.width) };
    };
    const visible = (el) => el.getBoundingClientRect().width > 0;
    const celdas = [...bloque.children].filter(visible).map((el) => ({ tag: el.tagName.toLowerCase(), ...caja(el) }));
    const casillas = [...bloque.querySelectorAll('textarea, input:not([type=hidden]), [role=combobox]')].filter(visible).map((el) => ({
      id: el.getAttribute('data-testid') ?? el.closest('[data-testid]')?.getAttribute('data-testid') ?? el.tagName.toLowerCase(),
      ...caja(el),
    }));
    const b = caja(bloque);
    return {
      vw,
      bloque: b,
      celdas,
      casillas,
      renglones: Object.values(celdas.reduce((a, c) => ({ ...a, [c.arriba]: (a[c.arriba] ?? 0) + 1 }), {})),
      desborde: casillas.filter((c) => c.der > vw + 1 || c.izq < -1).map((c) => c.id),
    };
  }, idMapa);
}

/**
 * Verifica la disposición de lo deducido: `esperado(vw)` son las celdas por renglón; ninguna casilla de texto
 * pasa de ~900 px a 1920 (regla 6 del cliente: sin casillas kilométricas); nada se sale.
 */
async function verificarUbicacion(p, etiqueta, nombre, idMapa, esperado) {
  const m = await medirDeducido(p, idMapa);
  if (!m) {
    ok(`[${etiqueta}] ${nombre}: existe el bloque de lo deducido`, false, idMapa);
    return;
  }
  ubicaciones.push({ viewport: etiqueta, pagina: nombre, ...m });
  ok(`[${etiqueta}] ${nombre}: lo deducido se reparte ${JSON.stringify(esperado(m.vw))} a ${m.vw} px`, JSON.stringify(m.renglones) === JSON.stringify(esperado(m.vw)), `real ${JSON.stringify(m.renglones)}`);
  const textos = m.casillas.filter((c) => !/-(departamento|provincia|municipio)$/.test(c.id));
  const anchos = textos.map((c) => `${c.id.replace('medical-center-signup-', '')}=${c.ancho}`).join(' ');
  ok(`[${etiqueta}] ${nombre}: ninguna casilla de texto pasa de 900 px y nada se sale (${anchos})`, m.desborde.length === 0 && textos.every((c) => c.ancho <= 900), anchos);
  process.stdout.write(`    · ${nombre} @${m.vw}: bloque ${m.bloque.ancho} px; renglones ${JSON.stringify(m.renglones)}; ${anchos}\n`);
}

/**
 * La disposición esperada por página y ancho: una columna por debajo de 672 px, dos desde 672 px y tres desde
 * 1120 px. Los números son las celdas por renglón, de arriba abajo. `nombre` va siempre en su renglón.
 */
const ESPERADO = [
  [/organizacion-(vacia|errores|llena)/, (vw) => (vw >= 1120 ? [3] : vw >= 672 ? [2, 1] : [1, 1, 1])],
  [/establecimiento/, (vw) => (vw >= 672 ? [2] : [1, 1])],
  [/director$/, (vw) => (vw >= 1120 ? [1, 3] : vw >= 672 ? [1, 2, 1] : [1, 1, 1, 1])],
  [/representante$/, (vw) => (vw >= 672 ? [1, 2] : [1, 1, 1])],
  [/acceso$/, (vw) => (vw >= 672 ? [2] : [1, 1])],
  [/gerente-(general|comercial|marketing)$/, (vw) => (vw >= 672 ? [1, 2] : [1, 1, 1])],
];

function verificarDisposicion(etiqueta, nombre, m) {
  const esperado = ESPERADO.find(([patron]) => patron.test(nombre))?.[1](m.vw);
  if (!esperado) return;
  const real = celdasPorRenglon(m);
  ok(`[${etiqueta}] ${nombre}: disposición ${JSON.stringify(esperado)} a ${m.vw} px`, JSON.stringify(real) === JSON.stringify(esperado), `real ${JSON.stringify(real)}`);
  if (m.vw >= 672) {
    // Nada de casillas kilométricas: ningún control corto ocupa más del 60 % de la rejilla. Se exceptúa el
    // campo que el motor cruza a todo el ancho por ser el último de una cantidad impar de celdas (entre 672 y
    // 1119 px, en las páginas de tres columnas): así evita dejar una casilla sola con la mitad vacía
    // (`paginated-form.css`). Las casillas del nombre se reparten solas.
    const solaEnSuRenglon = (c) => {
      const celda = m.celdas.find((x) => c.izq >= x.izq - 1 && c.der <= x.der + 1 && c.arriba >= x.arriba - 1 && c.arriba <= x.abajo);
      return celda !== undefined && m.celdas.filter((x) => x.arriba === celda.arriba).length === 1 && esperado.length > 1 && m.vw < 1120;
    };
    const anchos = m.controles.filter(
      (c) => !/-(nombre|segundo-nombre|tercer-nombre|apellido-paterno|apellido-materno)$/.test(c.id) && !solaEnSuRenglon(c),
    );
    const kilometrico = anchos.filter((c) => c.ancho > m.grilla.ancho * 0.6).map((c) => `${c.id}=${c.ancho}`);
    ok(`[${etiqueta}] ${nombre}: ningún campo corto ocupa más del 60 % de la rejilla (${m.grilla.ancho} px)`, kilometrico.length === 0, kilometrico.join(', '));
  }
}

/**
 * Captura la página ENTERA: la aplicación desplaza dentro de un contenedor propio, así que
 * `fullPage` solo no alcanza; se alarga el viewport hasta el alto del contenido (con tope) y se restaura.
 */
async function foto(p, etiqueta, nombre) {
  await p.waitForTimeout(350);
  const original = p.viewportSize();
  const alto = await p.evaluate(() => {
    let max = document.documentElement.scrollHeight;
    for (const el of document.querySelectorAll('body *')) max = Math.max(max, el.scrollHeight);
    return max;
  });
  const objetivo = Math.min(Math.max(alto + 24, original.height), 4200);
  await p.setViewportSize({ width: original.width, height: objetivo });
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${SALIDA}/${etiqueta}-${nombre}.png`, fullPage: true, animations: 'disabled' });
  await p.setViewportSize(original);
}

/** Mide y captura una página del formulario; deja las verificaciones en la lista. */
async function pagina(p, etiqueta, nombre, titulo) {
  const t = await p.locator('.paginated-form__titulo').first().innerText().catch(() => '');
  if (titulo) ok(`[${etiqueta}] ${nombre}: se ve «${titulo}»`, t.includes(titulo), t);
  const m = await medir(p);
  ok(`[${etiqueta}] ${nombre}: sin desborde horizontal`, m.desborde <= 0, `scrollWidth - ancho = ${m.desborde}`);
  if (m.conjunto) {
    ok(
      `[${etiqueta}] ${nombre}: el bloque no queda pegado a la izquierda (holgura izq ${m.conjunto.izq} / der ${m.conjunto.der})`,
      Math.abs(m.conjunto.izq - m.conjunto.der) <= 2,
    );
    ok(
      `[${etiqueta}] ${nombre}: a lo ancho (${m.conjunto.ancho} de ${m.vw} px, ${Math.round((m.conjunto.ancho / m.vw) * 100)} %)`,
      m.conjunto.ancho / m.vw >= (m.vw < 800 ? 0.85 : 0.6),
    );
  }
  const campos = await medirCampos(p);
  if (campos) {
    mediciones.push({ viewport: etiqueta, pagina: nombre, ...campos });
    ok(`[${etiqueta}] ${nombre}: ningún control ni campo se sale de la tarjeta`, campos.desbordeControl.length === 0 && campos.desbordeCelda.length === 0, [...campos.desbordeControl, ...campos.desbordeCelda].join(', '));
    const ancho = campos.controles.map((c) => `${c.id.replace('medical-center-signup-', '')}=${c.ancho}`).join(' ');
    verificarDisposicion(etiqueta, nombre, campos);
    process.stdout.write(`    · ${nombre} @${campos.vw}: rejilla ${campos.grilla.ancho} px; renglones ${JSON.stringify(celdasPorRenglon(campos))}; controles ${ancho}\n`);
  }
  await foto(p, etiqueta, nombre);
  return campos;
}

const continuar = async (p) => {
  const b = p.getByTestId('paginated-form-continuar').last();
  await b.waitFor({ state: 'visible', timeout: 20_000 });
  await b.click();
};

async function llenar(p, id, valor) {
  const c = p.getByTestId(id);
  await c.fill(valor);
  if ((await c.inputValue()) !== valor) await c.fill(valor);
}

async function elegirOpcion(p, testId, rotulo, indice) {
  await p.getByTestId(testId).getByRole('combobox').click();
  const d = p.locator('dialog.select-dialog[open]');
  await d.waitFor({ timeout: 10_000 });
  const op = rotulo
    ? d.getByRole('option', typeof rotulo === 'string' ? { name: rotulo, exact: true } : { name: rotulo }).first()
    : d.getByRole('option').nth(indice ?? 0);
  await op.click();
}

async function marcarPunto(p, prefijo, dx = 0) {
  // El mapa está abierto desde el principio: se toca el plano para poner el pin.
  const mapa = p.getByTestId(`${prefijo}-map`);
  await mapa.waitFor({ timeout: 15_000 });
  await mapa.click({ position: { x: 120 + dx, y: 120 } });
  await p.getByTestId(`${prefijo}-location-confirm`).click();
  await p.getByTestId(`${prefijo}-location-confirmed`).waitFor({ state: 'attached', timeout: 15_000 });
}

async function nombre(p, prefijo, n, a) {
  await llenar(p, `${prefijo}-nombre`, n);
  await llenar(p, `${prefijo}-apellido-paterno`, a);
}

/**
 * El simulador contesta DENTRO de la aplicación (un interceptor de Angular): no hay petición de red
 * que `page.on('request')` pueda ver. Se envuelve el `HttpClient.post` del cliente del alta, en el
 * navegador, y se guarda lo que sale (url + cuerpo) y lo que vuelve (respuesta o error) en
 * `window.__espia`. Es el cuerpo HTTP final, el que arma `MedicalCenterRegistrationClient`.
 */
async function instalarEspia(p) {
  await p.evaluate(() => {
    const comp = window.ng.getComponent(document.querySelector('app-register-medical-center'));
    const http = comp.client.http;
    const original = http.post.bind(http);
    window.__espia = [];
    http.post = (url, body, opciones) => {
      const registro = { url, body: JSON.parse(JSON.stringify(body)) };
      window.__espia.push(registro);
      const obs = original(url, body, opciones);
      return new obs.constructor((suscriptor) =>
        obs.subscribe({
          next: (v) => {
            registro.respuesta = v;
            suscriptor.next(v);
          },
          error: (e) => {
            registro.error = { status: e.status, body: e.error };
            suscriptor.error(e);
          },
          complete: () => suscriptor.complete(),
        }),
      );
    };
  });
}

const espiado = (p) =>
  p.evaluate((ruta) => (window.__espia ?? []).filter((x) => x.url.endsWith(ruta)), RUTA_ALTA);

async function recorrer(browser, vp) {
  const { etiqueta } = vp;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: 'es-BO',
    colorScheme: vp.tema === 'oscuro' ? 'dark' : 'light',
  });
  // El tema lo elige la persona y se guarda en `localStorage` (`ThemeService`): se fija antes de cargar.
  await ctx.addInitScript((tema) => {
    try {
      localStorage.setItem('mantra-core-health.theme', tema);
    } catch {
      /* sin almacenamiento: el tema queda por omisión */
    }
  }, vp.tema === 'oscuro' ? 'dark' : 'light');
  const p = await ctx.newPage();
  const consola = [];
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|tile\.openstreetmap|Failed to load resource/i.test(m.text())) consola.push(m.text());
  });
  p.on('pageerror', (e) => consola.push(`pageerror: ${e.message}`));
  const fallidas = [];
  p.on('requestfailed', (r) => {
    if (!/tile\.openstreetmap/.test(r.url())) fallidas.push(`${r.method()} ${r.url()}`);
  });

  await p.goto(`${BASE}/auth/register/medical-center`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.getByRole('heading', { level: 1, name: 'Registre su organización médica' }).waitFor({ timeout: 120_000 });
  await p.getByTestId('medical-center-signup-tenant-type').getByRole('combobox').waitFor({ timeout: 60_000 });
  await instalarEspia(p);

  // 1 · La organización (vacía, con errores, llena)
  await pagina(p, etiqueta, '01-organizacion-vacia', 'La organización');
  await continuar(p);
  await p.getByText('Elija el tipo de institución.').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] sin completar no avanza y pide el tipo`, true);
  await foto(p, etiqueta, '02-organizacion-errores');
  await elegirOpcion(p, 'medical-center-signup-tenant-type', 'Clínica');
  await llenar(p, 'medical-center-signup-legal-name', `Clínica Norte ${Date.now()}`);
  await elegirOpcion(p, 'medical-center-signup-legal-entity-type', /Responsabilidad Limitada/i);
  await pagina(p, etiqueta, '04-organizacion-llena', 'La organización');
  await continuar(p);

  // 2 · Datos del establecimiento: el NIT y el número del SEDES, uno al lado del otro
  await p.getByTestId('medical-center-signup-health-registration').waitFor({ timeout: 15_000 });
  await llenar(p, 'medical-center-signup-tax-id', 'abc');
  await llenar(p, 'medical-center-signup-health-registration', 'SEDES SC');
  await continuar(p);
  await p.getByText('Escriba el NIT: sólo números').waitFor({ timeout: 10_000 });
  await p.getByText('Escriba el número de registro del SEDES').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] un NIT inválido («abc») y un registro con espacio frenan y lo dicen`, true);
  await pagina(p, etiqueta, '05-establecimiento-invalido', 'Datos del establecimiento');
  await llenar(p, 'medical-center-signup-tax-id', '1023456789');
  await llenar(p, 'medical-center-signup-health-registration', 'SEDES-SC-2020-0412');
  await pagina(p, etiqueta, '06-establecimiento', 'Datos del establecimiento');
  await continuar(p);

  // 3 · Director médico
  await p.getByTestId('medical-center-signup-director-nombre').waitFor({ timeout: 15_000 });
  await continuar(p);
  await p.getByText('Escriba la matrícula profesional del director').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] el director sin matrícula frena y lo dice`, true);
  await foto(p, etiqueta, '07-director-errores');
  await nombre(p, 'medical-center-signup-director', 'Ana', 'Rojas');
  await llenar(p, 'medical-center-signup-director-segundo-nombre', 'Lucía');
  await llenar(p, 'medical-center-signup-director-apellido-materno', 'Paz');
  await llenar(p, 'medical-center-signup-director-license', 'MAT-12345');
  await llenar(p, 'medical-center-signup-director-email', 'dir@clinica-norte.test');
  await pagina(p, etiqueta, '08-director', 'Director médico');
  await continuar(p);

  // 4 · Papeles (los cinco en una vista)
  await p.getByTestId('medical-center-signup-doc-taxIdentifierFileId').waitFor({ timeout: 15_000 });
  await continuar(p);
  await p.getByText('Este documento es obligatorio para continuar').first().waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] sin los papeles no avanza`, true);
  await foto(p, etiqueta, '09-papeles-errores');
  for (const clave of [
    'constitutionFileId',
    'taxIdentifierFileId',
    'commerceRegistryFileId',
    'operatingLicenseFileId',
    'healthAuthorityCertificateFileId',
  ]) {
    const id = `medical-center-signup-doc-${clave}`;
    await p.getByTestId(id).setInputFiles(pdf(clave));
    await p.getByTestId(`${id}-quitar`).waitFor({ timeout: 20_000 });
  }
  const cinco = await p.locator('[data-testid^="medical-center-signup-doc-"][data-testid$="-quitar"]').count();
  ok(`[${etiqueta}] los cinco papeles caben en una sola vista`, cinco === 5, `${cinco} subidos en la misma página`);
  await pagina(p, etiqueta, '10-papeles-subidos', 'Documentación legal (PDF)');
  await continuar(p);

  // 5 · Casa central
  await p.getByTestId('medical-center-signup-central-map').waitFor({ timeout: 15_000 });
  await continuar(p);
  await p.getByText('Marque el lugar en el mapa').first().waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] sin el punto de la casa central no avanza`, true);
  await pagina(p, etiqueta, '11-central-sin-punto', 'Dónde está la casa central');
  await marcarPunto(p, 'medical-center-signup-central');
  await pagina(p, etiqueta, '12-central-con-punto', 'Dónde está la casa central');
  // Calle y distrito, uno al lado del otro desde 672 px; la ficha de la localidad cruza todo el ancho.
  await verificarUbicacion(p, etiqueta, '12-central-con-punto', 'medical-center-signup-central-map', (vw) => (vw >= 672 ? [2, 1] : [1, 1, 1]));
  await continuar(p);

  // 6 · Sucursales (una, completa)
  await p.getByTestId('medical-center-signup-agregar-sucursal').waitFor({ timeout: 15_000 });
  await pagina(p, etiqueta, '13-sucursales-vacio', 'Sus sucursales');
  await p.getByTestId('medical-center-signup-agregar-sucursal').click();
  await continuar(p);
  // El error ya no es un `<p role="alert">` suelto: lo dicen los campos de la sucursal (nombre y mapa).
  const erroresSucursal = p.locator('[data-testid="medical-center-signup-sucursal-1"] .form-field-error');
  await erroresSucursal.first().waitFor({ timeout: 10_000 });
  const textos = await erroresSucursal.allInnerTexts();
  ok(`[${etiqueta}] una sucursal a medias frena y dice qué falta, en el campo del nombre y en el del mapa`,
    textos.some((t) => /nombre de la sucursal/i.test(t)) && textos.some((t) => /mapa/i.test(t)), textos.join(' | '));
  await foto(p, etiqueta, '14-sucursal-incompleta');
  // Sin punto, sólo el nombre (primer campo de la rejilla de la sucursal, dentro del bloque de lo deducido).
  await verificarUbicacion(p, etiqueta, '14-sucursal-incompleta', 'medical-center-signup-sucursal-1-map', () => [1]);
  await marcarPunto(p, 'medical-center-signup-sucursal-1', 60);
  await llenar(p, 'medical-center-signup-sucursal-1-nombre', 'Sucursal Equipetrol');
  await pagina(p, etiqueta, '15-sucursal-completa', 'Sus sucursales');
  // Nombre, calle y distrito comparten rejilla: de a tres desde 1120 px, de a dos desde 672 px.
  await verificarUbicacion(p, etiqueta, '15-sucursal-completa', 'medical-center-signup-sucursal-1-map', (vw) => (vw >= 1120 ? [3, 1] : vw >= 672 ? [2, 1, 1] : [1, 1, 1, 1]));
  await continuar(p);

  // 7 · Representante legal
  await p.getByTestId('medical-center-signup-legal-rep-nombre').waitFor({ timeout: 15_000 });
  await nombre(p, 'medical-center-signup-legal-rep', 'Marta', 'Rojas');
  await llenar(p, 'medical-center-signup-legal-rep-id', '4872190');
  const correo = `marta.${Date.now()}@clinica-norte.test`;
  await pagina(p, etiqueta, '16-representante', 'Representante legal');
  await continuar(p);

  // 8 · Poder
  const idPoder = 'medical-center-signup-doc-powerOfAttorneyFileId';
  await p.getByTestId(idPoder).waitFor({ timeout: 15_000 });
  await continuar(p);
  await p.getByText('Este documento es obligatorio para continuar').first().waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] el poder es obligatorio para una S.R.L.`, true);
  await p.getByTestId(idPoder).setInputFiles(pdf('poder'));
  await p.getByTestId(`${idPoder}-quitar`).waitFor({ timeout: 20_000 });
  await pagina(p, etiqueta, '17-poder', 'Poder del representante legal');
  await continuar(p);

  // 9-11 · Gerencias (opcionales: se completan las tres)
  const gerencias = [
    ['gerente-general', 'Gerencia general', 'Gabriel', 'Gómez', '70011111', 'general@clinica-norte.test'],
    ['gerente-comercial', 'Gerencia comercial', 'Carla', 'Cruz', '70022222', 'comercial@clinica-norte.test'],
    ['gerente-marketing', 'Gerencia de marketing', 'Mario', 'Mena', '70033333', 'marketing@clinica-norte.test'],
  ];
  let n = 18;
  // Todo o nada: con solo el celular de la general escrito, «Siguiente» no pasa y dice qué falta JUNTO al campo.
  await p.getByTestId('medical-center-signup-gerente-general-nombre').waitFor({ timeout: 15_000 });
  await p.getByTestId('medical-center-signup-gerente-general-celular').fill('70011111');
  await continuar(p);
  await p.getByText('Escriba un correo válido, o deje las tres gerencias vacías.').waitFor({ timeout: 10_000 });
  const sigueEnLaGeneral = (await p.locator('.paginated-form__titulo').first().innerText()).includes('Gerencia general');
  const primerNombre = await p.getByText('Escriba el primer nombre.').count();
  ok(`[${etiqueta}] gerencias a medias: no avanza, se queda en la gerencia afectada y dice el correo y el nombre junto al campo`, sigueEnLaGeneral && primerNombre >= 1);
  await foto(p, etiqueta, '17b-gerencia-a-medias');
  await p.getByTestId('medical-center-signup-gerente-general-celular').fill('');
  for (const [id, titulo, nom, ape, tel, mail] of gerencias) {
    await p.getByTestId(`medical-center-signup-${id}-nombre`).waitFor({ timeout: 15_000 });
    await nombre(p, `medical-center-signup-${id}`, nom, ape);
    const celular = p.getByTestId(`medical-center-signup-${id}-celular`);
    await celular.fill(tel);
    await llenar(p, `medical-center-signup-${id}-correo`, mail);
    await pagina(p, etiqueta, `${n}-${id}`, titulo);
    n += 1;
    await continuar(p);
    if (id === 'gerente-general') {
      // La comercial y la de marketing están vacías y la general ya está completa: la comercial pide lo suyo.
      await continuar(p);
      await p.getByText('Escriba el celular completo, o deje las tres gerencias vacías.').first().waitFor({ timeout: 10_000 });
      const sigue = (await p.locator('.paginated-form__titulo').first().innerText()).includes('Gerencia comercial');
      ok(`[${etiqueta}] con la general completa, la comercial vacía no deja pasar y lo dice junto al campo`, sigue);
      await foto(p, etiqueta, '18b-comercial-pide-lo-suyo');
    }
  }

  // 12 · Su acceso y envío
  await p.getByTestId('medical-center-signup-password').waitFor({ timeout: 15_000 });
  await llenar(p, 'medical-center-signup-legal-rep-email', correo);
  await llenar(p, 'medical-center-signup-password', 'S3cret-passw0rd');
  await pagina(p, etiqueta, '21-acceso', 'Su acceso');

  await continuar(p);
  await p.waitForFunction((ruta) => (window.__espia ?? []).some((x) => x.url.endsWith(ruta) && (x.respuesta || x.error)), RUTA_ALTA, { timeout: 30_000 }).catch(async (e) => {
    await foto(p, etiqueta, 'FALLO-sin-respuesta');
    const visible = await p.locator('app-paginated-form, .registro__alert').first().innerText().catch(() => '');
    throw new Error(`${e.message}\nTexto en pantalla: ${visible.slice(0, 600)}`);
  });
  const [envio] = await espiado(p);
  const cuerpo = envio.body;
  const resp = envio.respuesta ?? null;
  writeFileSync(`${SALIDA}/${etiqueta}-request.json`, JSON.stringify({ url: envio.url, body: cuerpo }, null, 2));
  writeFileSync(`${SALIDA}/${etiqueta}-response.json`, JSON.stringify(resp ?? envio.error, null, 2));
  ok(`[${etiqueta}] request: POST ${envio.url} con respuesta del simulador`, envio.url.endsWith(RUTA_ALTA) && resp !== null && !envio.error);
  const org = cuerpo?.organization ?? {};
  ok(`[${etiqueta}] request: tenantType CLINIC + medicalFacility con NIT, registro SEDES y director`,
    org.tenantType === 'CLINIC' &&
      org.medicalFacility?.taxIdentifierNumber === '1023456789' &&
      org.medicalFacility?.healthFacilityRegistrationNumber === 'SEDES-SC-2020-0412' &&
      org.medicalFacility?.medicalDirector?.professionalLicenseNumber === 'MAT-12345' &&
      org.medicalFacility?.medicalDirector?.middleName === 'Lucía');
  ok(`[${etiqueta}] request: casa central con punto y una sucursal con punto`,
    typeof org.medicalFacility?.headquarters?.latitude === 'number' &&
      org.medicalFacility?.headquarters?.name === 'Casa central' &&
      org.medicalFacility?.branches?.length === 1 &&
      typeof org.medicalFacility?.branches?.[0]?.latitude === 'number');
  ok(`[${etiqueta}] request: representante con poder, tres gerencias y owner en partes (sin displayName)`,
    Boolean(org.legalRepresentative?.powerOfAttorneyFileId) &&
      Boolean(org.executives?.generalManager && org.executives?.commercialManager && org.executives?.marketingManager) &&
      cuerpo?.owner?.name === 'Marta' && cuerpo?.owner?.lastName === 'Rojas' && !('displayName' in (cuerpo?.owner ?? {})));
  ok(`[${etiqueta}] respuesta del simulador: medicalFacilityRegistered`, resp?.medicalFacilityRegistered === true, JSON.stringify(resp));

  await p.getByTestId('medical-center-signup-success').waitFor({ timeout: 20_000 });
  const pend = await p.getByTestId('medical-center-signup-pending').innerText();
  const verif = await p.getByTestId('medical-center-signup-verification').innerText();
  ok(`[${etiqueta}] éxito: en revisión / pendiente de verificación`, /en revisión/.test(pend) && /pendiente de verificación/.test(pend), pend);
  ok(`[${etiqueta}] éxito: el aviso de verificación nombra el correo`, verif.includes(correo), verif);
  const mFinal = await medir(p);
  ok(`[${etiqueta}] éxito: sin desborde horizontal`, mFinal.desborde <= 0);
  await foto(p, etiqueta, '22-exito');

  ok(`[${etiqueta}] sin errores de consola ni de página`, consola.length === 0, consola.join(' | '));
  ok(`[${etiqueta}] sin peticiones fallidas`, fallidas.length === 0, fallidas.join(' | '));
  await ctx.close();
}

/** UNIPERSONAL: sin constitución ni poder; y un error real del simulador (409) con reintento. */
async function unipersonalY409(browser) {
  const etiqueta = 'escritorio-1440';
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth/register/medical-center`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.getByTestId('medical-center-signup-tenant-type').getByRole('combobox').waitFor({ timeout: 120_000 });
  await instalarEspia(p);
  await elegirOpcion(p, 'medical-center-signup-tenant-type', 'Consultorio médico');
  await llenar(p, 'medical-center-signup-legal-name', `Consultorio Paz ${Date.now()}`);
  await p.getByTestId('medical-center-signup-legal-entity-type').getByRole('combobox').click();
  // Se espera a que el desplegable pinte sus opciones: leerlas en cuanto abre daba una lista vacía.
  await p.locator('dialog.select-dialog[open] [role="option"]').first().waitFor({ timeout: 15_000 });
  const opciones = await p.locator('dialog.select-dialog[open] [role="option"]').allInnerTexts();
  await p.locator('dialog.select-dialog[open]').getByRole('option', { name: /unipersonal/i }).first().click();
  ok('[unipersonal] el desplegable ofrece «Unipersonal»', opciones.some((o) => /unipersonal/i.test(o)), opciones.join(' / '));
  await continuar(p);
  await llenar(p, 'medical-center-signup-tax-id', '4872190');
  await llenar(p, 'medical-center-signup-health-registration', 'SEDES-LP-0001');
  await continuar(p);
  await nombre(p, 'medical-center-signup-director', 'Pedro', 'Paz');
  await llenar(p, 'medical-center-signup-director-license', 'MAT-777');
  await llenar(p, 'medical-center-signup-director-email', 'pedro@consultorio-paz.test');
  await continuar(p);
  // Unipersonal: la escritura de constitución es opcional, las otras cuatro no.
  await p.getByTestId('medical-center-signup-doc-constitutionFileId').waitFor({ timeout: 15_000 });
  const rotuloOpcional = await p.getByText('Escritura de constitución (opcional)').count();
  const opcionalesTotales = await p.getByText('(opcional)').count();
  ok('[unipersonal] la constitución se rotula «(opcional)» y es la única opcional de los cinco', rotuloOpcional === 1 && opcionalesTotales === 1, `${opcionalesTotales} rótulos «(opcional)»`);
  for (const clave of ['taxIdentifierFileId', 'commerceRegistryFileId', 'operatingLicenseFileId', 'healthAuthorityCertificateFileId']) {
    const id = `medical-center-signup-doc-${clave}`;
    await p.getByTestId(id).setInputFiles(pdf(clave));
    await p.getByTestId(`${id}-quitar`).waitFor({ timeout: 20_000 });
  }
  await foto(p, etiqueta, 'u1-unipersonal-papeles-sin-constitucion');
  await continuar(p);
  await marcarPunto(p, 'medical-center-signup-central');
  await continuar(p);
  await continuar(p); // sucursales: ninguna
  await nombre(p, 'medical-center-signup-legal-rep', 'Pedro', 'Paz');
  await llenar(p, 'medical-center-signup-legal-rep-id', '4872190');
  await continuar(p);
  // Poder: opcional para una unipersonal, se avanza sin subirlo.
  await p.getByTestId('medical-center-signup-doc-powerOfAttorneyFileId').waitFor({ timeout: 15_000 });
  await foto(p, etiqueta, 'u2-unipersonal-poder-opcional');
  await continuar(p);
  for (let i = 0; i < 3; i += 1) await continuar(p); // gerencias vacías
  // El correo del representante es el usuario: se escribe con la contraseña. Uno que el simulador ya
  // conoce da el 409 real, por el mismo camino que la API.
  await llenar(p, 'medical-center-signup-legal-rep-email', 'superadmin@alovida.mock');
  await llenar(p, 'medical-center-signup-password', 'S3cret-passw0rd');

  await continuar(p);
  await p.getByTestId('medical-center-signup-error').waitFor({ timeout: 20_000 });
  const msg = await p.getByTestId('medical-center-signup-error').innerText();
  ok('[409] el simulador responde 409 y la pantalla lo explica sin pasar a éxito', /Ya existe una cuenta con ese correo/.test(msg), msg);
  const [primero] = await espiado(p);
  ok('[409] el error de la API es 409', primero?.error?.status === 409, JSON.stringify(primero?.error));
  await foto(p, etiqueta, 'u3-error-409');

  // Corregir el correo: está en la misma página (junto a la contraseña), se corrige y se reenvía.
  const correo = `pedro.${Date.now()}@consultorio-paz.test`;
  await llenar(p, 'medical-center-signup-legal-rep-email', correo);
  await continuar(p);
  await p.getByTestId('medical-center-signup-success').waitFor({ timeout: 20_000 });
  const envios = await espiado(p);
  ok('[409] reintentar con otro correo funciona (el envío no queda trabado)', envios.length === 2 && Boolean(envios[1].respuesta), `${envios.length} envíos`);
  const org = envios[1].body.organization;
  ok('[unipersonal] el cuerpo no lleva constitución, poder, gerencias ni sucursales',
    !('constitutionFileId' in org.legalDocuments) &&
      !('powerOfAttorneyFileId' in org.legalRepresentative) &&
      !('executives' in org) &&
      !('branches' in org.medicalFacility));
  writeFileSync(`${SALIDA}/unipersonal-request.json`, JSON.stringify(envios[1].body, null, 2));
  await foto(p, etiqueta, 'u4-unipersonal-exito');
  await ctx.close();
}

/**
 * Geometría del selector de punto de IMAGENOLOGÍA (no se tocó): sirve para comparar el código nuevo contra
 * `HEAD`. Salta directo a la página «ubicacion» con el `indice` del asistente (sin validar las anteriores: es
 * una medición, no un recorrido), pone el pin y mide lo deducido de la central y de una sucursal.
 */
async function medirImagenologia(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-BO' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth/register/imaging-center`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.getByTestId('registro-form-imagenologia').waitFor({ timeout: 120_000 });
  const saltar = (clave) =>
    p.evaluate((c) => {
      const comp = window.ng.getComponent(document.querySelector('app-register-imaging-center'));
      const pf = window.ng.getComponent(document.querySelector('app-paginated-form'));
      pf.indice.set(comp.paginas.findIndex((x) => x.clave === c));
    }, clave);
  await saltar('ubicacion');
  await p.waitForTimeout(2500); // el mapa tarda en armarse tras saltar de página
  await marcarPunto(p, 'registro-imagen-central');
  const central = await medirDeducido(p, 'registro-imagen-central-map');
  await saltar('sucursales');
  await p.getByTestId('registro-imagen-agregar-sucursal').click();
  await p.waitForTimeout(2500);
  await marcarPunto(p, 'registro-imagen-sucursal-1', 60).catch(async () => {
    const id = await p.evaluate(() => document.querySelector('[data-testid$="-map"][data-testid*="registro-imagen-sucursal"]')?.getAttribute('data-testid'));
    throw new Error(`sin mapa de sucursal (${id})`);
  });
  const sucursal = await medirDeducido(p, 'registro-imagen-sucursal-1-map');
  await ctx.close();
  return { viewport: vp.etiqueta, central, sucursal };
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {});
  try {
    if (process.env['IMAGENOLOGIA'] === '1') {
      const geometria = [];
      for (const vp of VIEWPORTS.filter((v) => v.tema === 'claro')) geometria.push(await medirImagenologia(navegador, vp));
      writeFileSync(`${SALIDA}/${process.env['PREFIJO_SALIDA'] ?? ''}imagenologia.json`, JSON.stringify(geometria, null, 2));
      process.stdout.write(`imagenología: ${geometria.length} anchos medidos\n`);
      return;
    }
    if (process.env['SOLO_UNIPERSONAL'] !== '1') for (const vp of VIEWPORTS) await recorrer(navegador, vp);
    if (process.env['SIN_UNIPERSONAL'] !== '1') await unipersonalY409(navegador);
  } finally {
    await navegador.close();
  }
  const fallos = veredictos.filter((v) => !v.cond);
  const prefijo = process.env['PREFIJO_SALIDA'] ?? '';
  if (ubicaciones.length > 0) writeFileSync(`${SALIDA}/${prefijo}ubicaciones.json`, JSON.stringify(ubicaciones, null, 2));
  writeFileSync(`${SALIDA}/${prefijo}veredictos.json`, JSON.stringify(veredictos, null, 2));
  if (mediciones.length > 0) writeFileSync(`${SALIDA}/${prefijo}mediciones.json`, JSON.stringify(mediciones, null, 2));
  process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} verificaciones\n`);
  if (fallos.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(2);
});
