#!/usr/bin/env node
/* ============================================================================
    Video del módulo de aseguradora, presentada como Alianza Seguros.

    Graba el app REAL de la rama `mockup` (con `yarn start:dev` corriendo) y
    recorre: Mi perfil → Mis productos → Solicitudes recibidas → Siniestralidad
    («Por persona») → Directorio de pacientes. Salida en artifacts/ (ignorado).

      node tools/video-aseguradora/grabar.mjs [--base http://localhost:4200]

    Todo lo de Alianza vive en este script y en `datos-alianza.mjs`; la maqueta
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
        margin: -3px 0 0 -3px; transition: transform .12s ease-out; }
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
  // Sin esto, en modo biblioteca un selector que no aparece espera para siempre.
  page.setDefaultTimeout(30_000);
  const t0 = Date.now();
  const problemas = [];
  page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.text().includes('sin manejador')) problemas.push(`maqueta: ${m.text().slice(0, 160)}`);
  });

  const marcas = [];
  let capturas = 0;

  async function mover(destX, destY, pasos = 28) {
    await page.mouse.move(destX, destY, { steps: pasos });
  }
  async function apuntar(locator) {
    await locator.scrollIntoViewIfNeeded();
    const caja = await locator.boundingBox();
    if (caja === null) throw new Error('El elemento no tiene caja visible');
    await mover(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await pausa(250);
  }
  async function clic(locator) {
    await apuntar(locator);
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

  // Login: queda fuera del video final (se recorta desde la primera marca).
  await page.goto(`${BASE}/auth`);
  const campo = (id) => page.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
  await campo('login-identifier').fill('aseguradora@alovida.mock');
  await campo('login-password').fill('demo');
  await page.locator('[data-testid="login-submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  await page.goto(`${BASE}/my-account`);
  await page.getByTestId('perfil-organizacion-datos').waitFor({ timeout: 60_000 });
  await mover(ANCHO * 0.55, ALTO * 0.45, 1);
  await pausa(1200);

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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => Promise.all(abiertos.map((b) => b.close().catch(() => {}))));
