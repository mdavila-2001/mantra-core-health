#!/usr/bin/env node
/* ============================================================================
    Video del módulo de aseguradora, presentada como Alianza Seguros.

    Graba el app REAL de la rama `mockup` (con `yarn start:dev` corriendo) y
    recorre: registro de la aseguradora (8 páginas, con sus PDF) → login con la
    cuenta recién creada → Mi perfil → Mis productos → Solicitudes recibidas
    (aprobar y rechazar) → Siniestralidad («Por persona») → Directorio de
    pacientes. Salida en artifacts/ (ignorado).

      node tools/video-aseguradora/grabar.mjs [--base http://localhost:4200] [--hasta perfil]

    Todo lo de Alianza vive en este script, en `datos-alianza.mjs` y en
    `datos-alta.mjs` (el registro y sus PDF de ejemplo); la maqueta
    del repo no cambia. Cómo llega a la pantalla, sin tocar el DOM:

      1. Siembra: antes de que cargue el app, escribe en `sessionStorage` las
         colecciones del simulador (catálogo, solicitudes, directorio) con el
         sello del build, igual que las guarda `Coleccion.persistirEn`.
      2. Capa de respuesta: el simulador entrega cada respuesta por
         `structuredClone` (`desconectar` en mock-backend.interceptor.ts). El
         script lo envuelve y reescribe sólo lo que la siembra no alcanza: el
         nombre de la cuenta (dentro del JWT), la organización de «Mi perfil»
         y los correos `@….mock`, que pasan a `@mail.com`. Es el equivalente a
         interceptar la red, que en la maqueta no existe.
      3. Sólo para el video: oculta los botones flotantes «Datos de prueba» y
         «Ver componentes» y dibuja un cursor visible.

    Requiere ffmpeg con libx264 (winget install Gyan.FFmpeg) o FFMPEG_PATH.
    ========================================================================== */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { ALTA, DOCUMENTOS, pdfDeEjemplo } from './datos-alta.mjs';
import { ASEGURADORA, DIRECTORIO, SIEMBRA } from './datos-alianza.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA = join(RAIZ, 'artifacts', 'video-aseguradora');
const ANCHO = 1920;
const ALTO = 1080;

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i === -1 ? porDefecto : args[i + 1];
};
const BASE = opcion('base', 'http://localhost:4200').replace(/\/$/, '');
/** `--hasta perfil` corta en «Mi perfil»: sirve para ensayar el alta sin grabar los cuatro minutos. */
const HASTA = opcion('hasta', '');

/* ---- requisitos ------------------------------------------------------------ */

function ffmpeg() {
  const candidatos = [process.env.FFMPEG_PATH, 'ffmpeg'];
  const winget = join(homedir(), 'AppData/Local/Microsoft/WinGet/Packages');
  if (existsSync(winget)) {
    for (const paquete of readdirSync(winget).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
      for (const build of readdirSync(join(winget, paquete))) {
        candidatos.push(join(winget, paquete, build, 'bin', 'ffmpeg.exe'));
      }
    }
  }
  for (const candidato of candidatos.filter(Boolean)) {
    try {
      execFileSync(candidato, ['-hide_banner', '-version'], { stdio: 'ignore' });
      return candidato;
    } catch {
      // siguiente
    }
  }
  throw new Error('No encuentro ffmpeg. Instalalo (winget install Gyan.FFmpeg) o definí FFMPEG_PATH.');
}

/** El sello que espera `Coleccion.leerGuardadas`: el commit que compiló `ng serve`. */
function selloDelBuild() {
  const env = readFileSync(join(RAIZ, 'src/environments/env.generated.ts'), 'utf8');
  const m = /commit:\s*"([^"]+)"/.exec(env);
  if (m === null) throw new Error('No encuentro buildInfo.commit en env.generated.ts: corré yarn start:dev.');
  return m[1];
}

/* ---- lo que corre dentro de la página, antes que el app -------------------- */

function preparar({ origen, siembra, build, alianza }) {
  if (location.origin !== origen) return;

  // 1. Siembra, una sola vez por pestaña: después manda lo que el app guarde.
  try {
    if (sessionStorage.getItem('video:sembrado') === null) {
      for (const [clave, filas] of Object.entries(siembra)) {
        sessionStorage.setItem(clave, JSON.stringify({ build, filas }));
      }
      sessionStorage.setItem('video:sembrado', '1');
    }
  } catch {
    // sin almacenamiento no hay video; el chequeo de «Andina» lo va a delatar
  }

  // 2. Capa de respuesta.
  const textos = [
    ['Seguros Andina S.A.', alianza.razonSocial],
    ['Seguros Andina', alianza.nombre],
    ['Av. Arce N.º 2500, La Paz', alianza.direccion],
    ['Av. Arce N.º 2500', alianza.direccion],
  ];
  const exactos = { ANDINA: alianza.codigo, 'APS-0042': alianza.registro };
  const correo = /([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+\.mock(\.bo)?\b/g;
  const jwt = /^[\w-]+\.[\w-]+\.mock$/;

  const desde64 = (s) => {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b.padEnd(Math.ceil(b.length / 4) * 4, '='));
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  };
  const a64 = (s) => {
    let bin = '';
    for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const cadena = (s) => {
    if (jwt.test(s)) {
      const [h, p, f] = s.split('.');
      try {
        return `${h}.${a64(JSON.stringify(valor(JSON.parse(desde64(p)))))}.${f}`;
      } catch {
        return s;
      }
    }
    if (s in exactos) return exactos[s];
    let r = s.replace(correo, '$1@mail.com');
    for (const [de, a] of textos) r = r.split(de).join(a);
    return r;
  };
  const valor = (v) => {
    if (typeof v === 'string') return cadena(v);
    if (Array.isArray(v)) return v.map(valor);
    if (v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const salida = {};
      for (const [k, x] of Object.entries(v)) salida[k] = valor(x);
      if (salida.carrierCode === alianza.codigo && 'sigla' in salida) salida.sigla = alianza.sigla;
      // Las personas del video no tienen perfil de mensajería en la maqueta; sin
      // esto, «Enviar Mensaje» sale apagado en todas las filas. El video no lo pulsa.
      if (alianza.conMensajeria.includes(salida.patientProfileId) && salida.messaging?.channel === 'internal') {
        salida.messaging = { ...salida.messaging, available: true };
      }
      return salida;
    }
    return v;
  };
  const original = globalThis.structuredClone;
  globalThis.structuredClone = (v, o) => valor(original(v, o));

  // 3. Sólo para el video: sin el aviso de la maqueta, con cursor visible.
  const decorar = () => {
    const estilo = document.createElement('style');
    estilo.textContent = `
      app-mock-banner { display: none !important; }
      #video-cursor { position: fixed; z-index: 2147483647; pointer-events: none; width: 26px; height: 26px;
        margin: -3px 0 0 -3px;
        transition: transform .12s ease-out, left .5s cubic-bezier(.4, 0, .2, 1), top .5s cubic-bezier(.4, 0, .2, 1); }
      #video-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
      .video-onda { position: fixed; z-index: 2147483646; pointer-events: none; width: 44px; height: 44px;
        margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid rgba(11, 85, 126, .75);
        animation: video-onda .55s ease-out forwards; }
      @keyframes video-onda { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }`;
    document.head.appendChild(estilo);
    const cursor = document.createElement('div');
    cursor.id = 'video-cursor';
    cursor.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.5 16 L12.5 24 L16 22.5 L12 14.5 L19.5 14.5 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    cursor.style.left = '-50px';
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    }, true);
    document.addEventListener('mousedown', (e) => {
      cursor.style.transform = 'scale(.85)';
      const onda = document.createElement('div');
      onda.className = 'video-onda';
      onda.style.left = `${e.clientX}px`;
      onda.style.top = `${e.clientY}px`;
      document.body.appendChild(onda);
      setTimeout(() => onda.remove(), 600);
    }, true);
    document.addEventListener('mouseup', () => (cursor.style.transform = ''), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorar);
  else decorar();
}

/* ---- el recorrido ---------------------------------------------------------- */

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lo que hay que cerrar aunque el recorrido falle: si no, el proceso no termina. */
const abiertos = [];
/** La pestaña que graba, para dejar una captura si el recorrido se cae. */
let pestana = null;
/** Lo que salió mal en la página; si el recorrido se cae, se imprime junto con el error. */
const problemas = [];
const consola = [];

async function main() {
  const binario = ffmpeg();
  const build = selloDelBuild();
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error(`No responde ${BASE}: levantá el app con yarn start:dev.`);
  }

  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(join(SALIDA, 'crudo'), { recursive: true });

  const browser = await chromium.launch();
  abiertos.push(browser);
  const context = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO },
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    recordVideo: { dir: join(SALIDA, 'crudo'), size: { width: ANCHO, height: ALTO } },
  });
  await context.addInitScript(preparar, {
    origen: new URL(BASE).origin,
    siembra: SIEMBRA,
    build,
    alianza: {
      nombre: ASEGURADORA.nombre,
      razonSocial: ASEGURADORA.razonSocial,
      codigo: ASEGURADORA.codigo,
      sigla: ASEGURADORA.sigla,
      registro: ASEGURADORA.registro,
      direccion: ASEGURADORA.direccion,
      conMensajeria: DIRECTORIO.map((p) => p.patientProfileId),
    },
  });

  const page = await context.newPage();
  pestana = page;
  // Sin esto, en modo biblioteca un selector que no aparece espera para siempre.
  page.setDefaultTimeout(30_000);
  const t0 = Date.now();
  page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) consola.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    if (m.text().includes('sin manejador')) problemas.push(`maqueta: ${m.text().slice(0, 160)}`);
  });

  const marcas = [];
  let capturas = 0;

  /**
   * Mueve el puntero. Con la grabación activa cada paso de `mouse.move` tarda unos
   * 250 ms en estas pantallas, y el cursor se vería a saltos: se hace UN movimiento
   * real y el cursor dibujado se desliza con una transición CSS (0,5 s).
   * `pasos = 1` es «ya estaba ahí»: no espera.
   */
  async function mover(destX, destY, pasos = 28) {
    await page.mouse.move(destX, destY);
    if (pasos > 1) await pausa(540);
  }
  async function apuntar(locator, estricto = false) {
    await locator.scrollIntoViewIfNeeded();
    let caja = await locator.boundingBox();
    if (caja === null) throw new Error('El elemento no tiene caja visible');
    await mover(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pausa(250);
    // La tarjeta del login se inclina con el mouse: al llegar, el enlace ya no está
    // donde se midió y el clic cae en el contenedor. Se espera y se reapunta hasta
    // que el elemento queda quieto bajo el puntero.
    for (let intento = 0; estricto && intento < 5; intento++) {
      await pausa(450);
      const nueva = await locator.boundingBox();
      if (nueva === null) break;
      const quieta = Math.abs(nueva.x - caja.x) < 3 && Math.abs(nueva.y - caja.y) < 3;
      caja = nueva;
      if (quieta) break;
      await mover(caja.x + caja.width / 2, caja.y + caja.height / 2, 8);
    }
  }
  async function clic(locator, estricto = false) {
    await apuntar(locator, estricto);
    if (estricto) {
      // El `click` de Playwright espera a que el elemento esté quieto y reciba el evento, y reintenta.
      await locator.click({ delay: 90 });
      return;
    }
    await page.mouse.down();
    await pausa(90);
    await page.mouse.up();
  }
  async function desplazar(total, pausaFinal = 900) {
    const paso = total > 0 ? 90 : -90;
    for (let hecho = 0; Math.abs(hecho) < Math.abs(total); hecho += paso) {
      await page.mouse.wheel(0, paso);
      await pausa(32);
    }
    await pausa(pausaFinal);
  }
  async function menu(ruta) {
    await clic(page.locator(`[data-testid="nav-enlace"][data-route="${ruta}"]`));
  }
  async function revisar(nombre) {
    await pausa(400);
    const texto = await page.locator('body').innerText();
    if (/Andina|ANDINA/.test(texto)) problemas.push(`${nombre}: aparece «Andina» en pantalla`);
    if (/\.mock\b/.test(texto)) problemas.push(`${nombre}: aparece un dominio .mock en pantalla`);
    await page.screenshot({ path: join(SALIDA, `${String(++capturas).padStart(2, '0')}-${nombre}.png`) });
  }
  const marcar = (nombre) => marcas.push({ nombre, segundo: (Date.now() - t0) / 1000 });

  // 0. Alta y login: el video arranca en la pantalla de inicio de sesión, entra
  //    al registro público de la aseguradora y termina entrando con la cuenta
  //    que acaba de crear. Nada de `goto` desde acá hasta «Mi perfil»: recargar
  //    borraría el estado del alta.
  const campo = (id) => page.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
  /** Como quien llena un formulario con el teclado: el foco pasa de campo en campo y el mouse queda quieto. */
  async function escribir(id, texto, demora = 14) {
    await campo(id).focus();
    await pausa(120);
    await page.keyboard.type(texto, { delay: demora });
    await pausa(160);
  }
  /** Escribir en un campo apuntándolo con el mouse (la pantalla de login, donde el cursor es parte de la escena). */
  async function escribirConMouse(id, texto, demora = 45) {
    const el = campo(id);
    // Un clic puede caer en la tarjeta que se inclina: se reintenta hasta que el campo tenga el foco.
    for (let intento = 0; intento < 3; intento++) {
      await clic(el, true);
      if (await el.evaluate((n) => n === document.activeElement)) break;
    }
    await el.focus();
    await page.keyboard.type(texto, { delay: demora });
  }
  /** Un `app-select` es un `<select>` nativo: el cursor lo señala y se elige la opción. */
  async function elegir(id, coincide) {
    const lista = page.getByTestId(id).locator('select');
    // Sin clic: Chromium headless dibuja la lista nativa corrida y encima de otros campos.
    await apuntar(lista);
    const opciones = await lista.locator('option').evaluateAll((os) => os.map((o) => ({ valor: o.value, texto: o.textContent.trim() })));
    const opcion = opciones.find((o) => o.valor !== '' && coincide.test(o.texto));
    if (opcion === undefined) throw new Error(`No hay opción para ${coincide} en ${id}: ${opciones.map((o) => o.texto).join(' | ')}`);
    await lista.selectOption(opcion.valor);
    await pausa(500);
  }
  /** Sube un PDF por la zona de arrastre real: clic → selector de archivos → barra → «nombre · peso ✓». */
  async function subir(documento) {
    // El testid está en el <input type="file"> invisible; el clic va a la etiqueta visible de su zona.
    const zona = page.locator('.dropzone').filter({ has: page.getByTestId(`registro-organizacion-doc-${documento.clave}`) }).locator('label.dropzone-content');
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), clic(zona)]);
    await selector.setFiles({ name: documento.archivo, mimeType: 'application/pdf', buffer: pdfDeEjemplo(documento.titulo, documento.kb) });
    await page.getByTestId(`registro-organizacion-doc-${documento.clave}-estado`).getByText(documento.archivo).waitFor();
    await pausa(900);
  }
  const siguiente = () => clic(page.getByTestId('paginated-form-continuar'));
  const pagina = async (titulo) => {
    await page.getByRole('heading', { name: titulo }).first().waitFor();
    await pausa(700);
  };
  const nombreCompleto = async (prefijo, n) => {
    await escribir(`${prefijo}-nombre`, n.nombre);
    await escribir(`${prefijo}-apellido-paterno`, n.apellidoPaterno ?? n.apellido);
    await escribir(`${prefijo}-apellido-materno`, n.apellidoMaterno);
  };

  await page.goto(`${BASE}/auth`);
  await page.getByTestId('login-registro-organizacion').waitFor();
  // El HTML ya está, pero Angular puede no haber terminado de arrancar: un clic en ese
  // momento se pierde si el nodo se reemplaza entre apretar y soltar.
  await page.locator('[ng-version]').first().waitFor({ state: 'attached' });
  await mover(ANCHO * 0.4, ALTO * 0.5, 1);
  marcar('inicio-de-sesion');
  await pausa(2000);
  await revisar('inicio-de-sesion');
  // Si el clic se perdió, se repite: la pantalla de registro es la que tiene que aparecer.
  for (let intento = 1; ; intento++) {
    await clic(page.getByTestId('login-registro-organizacion'), true);
    try {
      await page.getByTestId('registro-organizacion-form').waitFor({ timeout: 7_000 });
      break;
    } catch (error) {
      if (intento === 3) throw error;
    }
  }
  marcar('registro-aseguradora');

  // Paso 1: la empresa.
  await pagina('La empresa');
  await escribir('registro-organizacion-nombre', ALTA.razonSocial);
  await escribir('registro-organizacion-sigla', ALTA.sigla);
  await elegir('registro-organizacion-tipo-societario', ALTA.tipoSocietario);
  await pausa(700);
  await revisar('alta-1-la-empresa');
  await siguiente();

  // Paso 2: datos de la aseguradora. El mapa es opcional y no se toca.
  await pagina('Datos de la aseguradora');
  await escribir('registro-organizacion-nit', ALTA.nit);
  await escribir('registro-organizacion-direccion', ALTA.direccion);
  await escribir('registro-organizacion-comercial', ALTA.nombreComercial);
  await pausa(700);
  await revisar('alta-2-datos-de-la-aseguradora');
  await siguiente();

  // Pasos 3 y 4: los cinco documentos legales, en PDF.
  marcar('documentos-legales');
  await pagina('Documentación legal obligatoria (PDF)');
  for (const documento of DOCUMENTOS.slice(0, 4)) await subir(documento);
  await revisar('alta-3-documentos-legales');
  await siguiente();
  await pagina('Documentación legal obligatoria (PDF)');
  await subir(DOCUMENTOS[4]);
  await revisar('alta-4-documento-sedes');
  await siguiente();

  // Pasos 5 y 6: el representante legal y su poder notariado.
  marcar('representante-legal');
  await pagina('Representante legal');
  await nombreCompleto('registro-organizacion-representante', ALTA.representante);
  await escribir('registro-organizacion-representante-ci', ALTA.representante.ci);
  await escribir('registro-organizacion-representante-correo', ALTA.representante.correo);
  await escribir('registro-organizacion-representante-telefono', ALTA.representante.celular);
  await revisar('alta-5-representante-legal');
  await siguiente();
  await pagina('Representante legal');
  await subir(DOCUMENTOS[5]);
  await revisar('alta-6-poder-notariado');
  await siguiente();

  // Paso 7: las tres gerencias, una por panel del acordeón.
  marcar('directorio-ejecutivo');
  await pagina('Directorio ejecutivo');
  for (const [clave, g] of Object.entries(ALTA.gerencias)) {
    const prefijo = `registro-organizacion-executives-${clave}`;
    if (clave !== 'general-manager') await clic(page.getByTestId(prefijo).getByRole('button').first());
    await nombreCompleto(prefijo, g);
    await escribir(`${prefijo}-phone`, g.celular);
    await escribir(`${prefijo}-email`, g.correo);
    await pausa(500);
  }
  await revisar('alta-7-directorio-ejecutivo');
  await siguiente();

  // Paso 8: la cuenta de quien administra.
  marcar('cuenta-del-dueno');
  await pagina('Tu cuenta');
  await nombreCompleto('registro-organizacion-owner', ALTA.dueno);
  await escribir('registro-organizacion-owner-correo', ALTA.dueno.correo);
  await escribir('registro-organizacion-owner-password', ALTA.dueno.contrasena);
  await pausa(700);
  await revisar('alta-8-cuenta-del-dueno');
  await siguiente();

  await page.getByTestId('registro-organizacion-exito').waitFor();
  marcar('alta-confirmada');
  await pausa(2200);
  await revisar('alta-9-confirmada');
  await clic(page.getByTestId('registro-organizacion-ir-login'), true);

  // Login con el correo y la contraseña del alta.
  await page.getByTestId('login-form').waitFor();
  marcar('login');
  await pausa(1000);
  await escribirConMouse('login-identifier', ALTA.dueno.correo, 45);
  await escribirConMouse('login-password', ALTA.dueno.contrasena, 60);
  await pausa(600);
  await revisar('login');
  await clic(page.getByTestId('login-submit'), true);
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });

  // Desde la sesión recién abierta, a «Mi perfil» por el menú, sin recargar.
  await page.locator('[data-testid="nav-enlace"][data-route="/my-account"]').first().waitFor({ timeout: 60_000 });
  await pausa(1800);
  await menu('/my-account');
  await page.getByTestId('perfil-organizacion-datos').waitFor({ timeout: 60_000 });
  await mover(ANCHO * 0.55, ALTO * 0.45, 1);
  await pausa(1200);

  if (HASTA === 'perfil') return terminar();

  // 1. Mi perfil
  marcar('mi-perfil');
  await pausa(2500);
  await desplazar(500, 2200);
  await desplazar(-500, 900);
  await revisar('mi-perfil');

  // 2. Mis productos: un plan por página.
  await menu('/administration/insurance');
  await page.locator('.catalog__plan-title').first().waitFor({ timeout: 30_000 });
  marcar('mis-productos');
  await pausa(2200);
  await apuntar(page.getByTestId('plan-monthly-premium-value').first());
  await pausa(1200);
  await mover(ANCHO * 0.6, ALTO * 0.6);
  await desplazar(450, 1600);
  await desplazar(-450, 600);
  const paginador = page.getByRole('navigation', { name: 'Paginación' }).first();
  for (let n = 2; n <= 7; n++) {
    await clic(paginador.getByRole('button', { name: `Página ${n}`, exact: true }));
    await pausa(600);
    await apuntar(page.getByTestId('plan-monthly-premium-value').first());
    await pausa(1500);
  }
  await revisar('mis-productos');

  // 3. Solicitudes recibidas: la bandeja, aprobar una y rechazar otra. La
  //    bandeja abre en «Por dictaminar»: la dictaminada sale de la lista y la
  //    siguiente abierta pasa a ser la primera.
  await menu('/administration/received-claims');
  await page.getByTestId('received-claims-table').waitFor({ timeout: 30_000 });
  marcar('solicitudes-recibidas');
  await pausa(2200);
  // Pasar sobre el paciente muestra su tarjeta.
  await apuntar(page.getByTestId('received-claim-open').nth(1));
  await pausa(1800);

  const detalle = page.getByRole('dialog', { name: 'Detalle de la solicitud' });
  const accion = (nombre) =>
    detalle.getByTestId('received-claim-detail-actions').locator('button', { hasText: new RegExp(`^\\s*${nombre}\\s*$`) });
  async function abrirPrimeraAbierta() {
    await clic(page.getByTestId('received-claim-view').first());
    await detalle.waitFor();
    await pausa(1800);
  }
  async function verDictamen(nombre) {
    await mover(ANCHO * 0.5, ALTO * 0.55);
    await desplazar(500, 1800);
    await revisar(nombre);
    await clic(detalle.getByRole('button', { name: 'Cerrar' }));
    await detalle.waitFor({ state: 'hidden' });
    await pausa(900);
  }

  // Aprobar: confirma y emite la factura por el monto solicitado.
  marcar('aprobar');
  await abrirPrimeraAbierta();
  await clic(accion('Aprobar'));
  const confirmarAprobacion = page.getByRole('dialog', { name: /^Aprobar la solicitud/ });
  await confirmarAprobacion.waitFor();
  await pausa(1800);
  await revisar('confirmar-aprobacion');
  await clic(confirmarAprobacion.getByRole('button', { name: 'Aprobar y facturar' }));
  await detalle.getByTestId('received-claim-invoices').waitFor();
  await pausa(1500);
  await verDictamen('solicitud-aprobada');

  // Rechazar: pide el motivo, que el prestador va a leer, y no emite factura.
  marcar('rechazar');
  await abrirPrimeraAbierta();
  await clic(accion('Rechazar'));
  const confirmarRechazo = page.getByRole('dialog', { name: /^Rechazar la solicitud/ });
  await confirmarRechazo.waitFor();
  await pausa(1500);
  await clic(confirmarRechazo.locator('textarea'));
  await page.keyboard.type('El servicio no está cubierto por el plan contratado.', { delay: 55 });
  await revisar('confirmar-rechazo');
  await clic(confirmarRechazo.getByRole('button', { name: 'Rechazar', exact: true }));
  await detalle.getByText('Rechazada: no se emite factura.').waitFor();
  await pausa(1500);
  await verDictamen('solicitud-rechazada');

  // 4. Siniestralidad: sólo «Por persona».
  await menu('/administration/insurance-analytics');
  await page.getByTestId('insurance-analytics-container').waitFor({ timeout: 30_000 });
  await clic(page.getByRole('tab', { name: 'Por persona' }));
  marcar('siniestralidad-por-persona');
  await clic(page.getByTestId('btn-generate-person-report'));
  await page.getByTestId('table-person-loss').waitFor({ timeout: 30_000 });
  await pausa(2200);
  await mover(ANCHO * 0.6, ALTO * 0.65);
  await desplazar(500, 2000);
  await revisar('siniestralidad-por-persona');
  await desplazar(-500, 500);

  // 5. Directorio de pacientes.
  await menu('/administration/insurance-patients');
  await page.getByTestId('directory-count').waitFor({ timeout: 30_000 });
  marcar('directorio');
  await pausa(2200);
  await mover(ANCHO * 0.6, ALTO * 0.7);
  await desplazar(450, 1500);
  await desplazar(-450, 500);
  const buscador = page.getByRole('textbox', { name: 'Buscar pacientes' });
  await clic(buscador);
  await page.keyboard.type('Mamani', { delay: 140 });
  await pausa(2600);
  await revisar('directorio');
  await terminar();

  /** Cierra la grabación, la convierte a MP4 y escribe las marcas. */
  async function terminar() {
    marcar('fin');
    await pausa(1500);

    const video = page.video();
    await context.close();
    await browser.close();
    const webm = join(SALIDA, 'crudo', 'recorrido.webm');
    renameSync(await video.path(), webm);

    // Recorte desde «Mi perfil» y H.264 para que se abra en cualquier lado.
    const inicio = Math.max(0, marcas[0].segundo - 0.4);
    const mp4 = join(SALIDA, 'alianza-aseguradora-1080p.mp4');
    execFileSync(binario, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', inicio.toFixed(2), '-i', webm,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      mp4,
    ]);
    execFileSync(binario, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1.5', '-i', mp4, '-frames:v', '1', join(SALIDA, 'portada.png')]);

    const relativas = marcas.map((m) => ({ ...m, segundo: Number((m.segundo - inicio).toFixed(2)) }));
    writeFileSync(join(SALIDA, 'marcas.json'), JSON.stringify(relativas, null, 2));
    console.log(`Video: ${mp4}`);
    console.log('Marcas (s):', relativas.map((m) => `${m.nombre}=${m.segundo}`).join(' · '));
    if (problemas.length > 0) {
      console.error(`\n${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
      process.exitCode = 1;
    } else {
      console.log('Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador.');
    }
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    if (pestana !== null) {
      console.error(`URL al fallar: ${pestana.url()}`);
      console.error(`Problemas: ${problemas.join(' | ') || 'ninguno'}`);
      console.error(`Consola: ${consola.slice(-8).join(' | ') || 'vacía'}`);
      await pestana.screenshot({ path: join(SALIDA, 'fallo.png') }).catch(() => {});
    }
    process.exitCode = 1;
  })
  .finally(() => Promise.all(abiertos.map((b) => b.close().catch(() => {}))));
