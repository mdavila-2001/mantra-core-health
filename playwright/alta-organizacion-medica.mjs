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
 * Variables: `PW_CHROMIUM` (ruta del ejecutable), `SALIDA` (carpeta de capturas).
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

const VIEWPORTS = [
  { etiqueta: 'escritorio-1440', width: 1440, height: 900 },
  { etiqueta: 'movil-390', width: 390, height: 844 },
];

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
  await foto(p, etiqueta, nombre);
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
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'es-BO' });
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
  await llenar(p, 'medical-center-signup-tax-id', 'abc');
  await continuar(p);
  await p.getByText('Escriba el NIT: sólo números').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] un NIT inválido («abc») frena y lo dice`, true);
  await foto(p, etiqueta, '03-organizacion-nit-invalido');
  await llenar(p, 'medical-center-signup-tax-id', '1023456789');
  await pagina(p, etiqueta, '04-organizacion-llena', 'La organización');
  await continuar(p);

  // 2 · Datos del establecimiento
  await p.getByTestId('medical-center-signup-health-registration').waitFor({ timeout: 15_000 });
  await llenar(p, 'medical-center-signup-health-registration', 'SEDES SC');
  await continuar(p);
  await p.getByText('Escriba el número de registro del SEDES').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] un registro del SEDES con espacio frena y lo dice`, true);
  await pagina(p, etiqueta, '05-establecimiento-invalido', 'Datos del establecimiento');
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
  await pagina(p, etiqueta, '10-papeles-subidos', 'Documentación legal obligatoria (PDF)');
  await continuar(p);

  // 5 · Casa central
  await p.getByTestId('medical-center-signup-central-map').waitFor({ timeout: 15_000 });
  await continuar(p);
  await p.getByText('Marque el lugar en el mapa').first().waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] sin el punto de la casa central no avanza`, true);
  await pagina(p, etiqueta, '11-central-sin-punto', 'Dónde está la casa central');
  await marcarPunto(p, 'medical-center-signup-central');
  await pagina(p, etiqueta, '12-central-con-punto', 'Dónde está la casa central');
  await continuar(p);

  // 6 · Sucursales (una, completa)
  await p.getByTestId('medical-center-signup-agregar-sucursal').waitFor({ timeout: 15_000 });
  await pagina(p, etiqueta, '13-sucursales-vacio', 'Sus sucursales');
  await p.getByTestId('medical-center-signup-agregar-sucursal').click();
  await continuar(p);
  await p.getByTestId('medical-center-signup-sucursal-1-falta').waitFor({ timeout: 10_000 });
  ok(`[${etiqueta}] una sucursal a medias frena y dice qué falta`, true);
  await foto(p, etiqueta, '14-sucursal-incompleta');
  await marcarPunto(p, 'medical-center-signup-sucursal-1', 60);
  await llenar(p, 'medical-center-signup-sucursal-1-nombre', 'Sucursal Equipetrol');
  await pagina(p, etiqueta, '15-sucursal-completa', 'Sus sucursales');
  await continuar(p);

  // 7 · Representante legal
  await p.getByTestId('medical-center-signup-legal-rep-nombre').waitFor({ timeout: 15_000 });
  await nombre(p, 'medical-center-signup-legal-rep', 'Marta', 'Rojas');
  await llenar(p, 'medical-center-signup-legal-rep-id', '4872190');
  const correo = `marta.${Date.now()}@clinica-norte.test`;
  await llenar(p, 'medical-center-signup-legal-rep-email', correo);
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
  for (const [id, titulo, nom, ape, tel, mail] of gerencias) {
    await p.getByTestId(`medical-center-signup-${id}-nombre`).waitFor({ timeout: 15_000 });
    await nombre(p, `medical-center-signup-${id}`, nom, ape);
    const celular = p.getByTestId(`medical-center-signup-${id}-celular`);
    await celular.fill(tel);
    await llenar(p, `medical-center-signup-${id}-correo`, mail);
    await pagina(p, etiqueta, `${n}-${id}`, titulo);
    n += 1;
    await continuar(p);
  }

  // 12 · Su acceso y envío
  await p.getByTestId('medical-center-signup-password').waitFor({ timeout: 15_000 });
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
  const opciones = await p.locator('dialog.select-dialog[open] [role="option"]').allInnerTexts();
  await p.locator('dialog.select-dialog[open]').getByRole('option', { name: /unipersonal/i }).first().click();
  ok('[unipersonal] el desplegable ofrece «Unipersonal»', opciones.some((o) => /unipersonal/i.test(o)), opciones.join(' / '));
  await llenar(p, 'medical-center-signup-tax-id', '4872190');
  await continuar(p);
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
  // Un correo que el simulador ya conoce: 409 real, por el mismo camino que la API.
  await llenar(p, 'medical-center-signup-legal-rep-email', 'superadmin@alovida.mock');
  await continuar(p);
  // Poder: opcional para una unipersonal, se avanza sin subirlo.
  await p.getByTestId('medical-center-signup-doc-powerOfAttorneyFileId').waitFor({ timeout: 15_000 });
  await foto(p, etiqueta, 'u2-unipersonal-poder-opcional');
  await continuar(p);
  for (let i = 0; i < 3; i += 1) await continuar(p); // gerencias vacías
  await llenar(p, 'medical-center-signup-password', 'S3cret-passw0rd');

  await continuar(p);
  await p.getByTestId('medical-center-signup-error').waitFor({ timeout: 20_000 });
  const msg = await p.getByTestId('medical-center-signup-error').innerText();
  ok('[409] el simulador responde 409 y la pantalla lo explica sin pasar a éxito', /Ya existe una cuenta con ese correo/.test(msg), msg);
  const [primero] = await espiado(p);
  ok('[409] el error de la API es 409', primero?.error?.status === 409, JSON.stringify(primero?.error));
  await foto(p, etiqueta, 'u3-error-409');

  // Corregir el correo: se vuelve a la página del representante (5 pasos atrás) y se reenvía.
  for (let i = 0; i < 5; i += 1) await p.getByTestId('paginated-form-atras').click();
  await p.getByTestId('medical-center-signup-legal-rep-email').waitFor({ timeout: 10_000 });
  const correo = `pedro.${Date.now()}@consultorio-paz.test`;
  await llenar(p, 'medical-center-signup-legal-rep-email', correo);
  for (let i = 0; i < 6; i += 1) await continuar(p);
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

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {});
  try {
    for (const vp of VIEWPORTS) await recorrer(navegador, vp);
    await unipersonalY409(navegador);
  } finally {
    await navegador.close();
  }
  const fallos = veredictos.filter((v) => !v.cond);
  writeFileSync(`${SALIDA}/veredictos.json`, JSON.stringify(veredictos, null, 2));
  process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} verificaciones\n`);
  if (fallos.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(2);
});
