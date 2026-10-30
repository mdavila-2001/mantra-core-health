/**
 * Banco de capturas del Carril F (web a la altura de la app móvil).
 *
 * Sirve para el método por pantalla del plan: captura «antes» y «después» a
 * 1440 y 390, en claro y oscuro, y una auditoría de datos crudos (ISO, uuid,
 * coordenadas) sobre el texto visible. No espera `networkidle`: con HMR no
 * llega nunca (ver CLAUDE.md §5).
 *
 * Cuentas demo (simulador `mockBackend`): medica@, paciente@, admin@ … alovida.mock
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

export const BASE = process.env.BASE ?? 'http://localhost:4301';
export const SALIDA = process.env.SALIDA ?? 'evidencias/carril-f-2026-10-12';
export const VISTAS = [
  { ancho: 1440, alto: 900, id: '1440' },
  { ancho: 390, alto: 844, id: '390' },
];
export const TEMAS = ['claro', 'oscuro'];

export async function lanzar() {
  return chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
}

/** Contexto con tema estampado antes del primer paint (clave de ThemeService). */
export async function contexto(navegador, { ancho, alto, tema = 'claro', reducido = false }) {
  // A 390 se emula un iPhone real (táctil, 3x, agente móvil): lo que vería el teléfono.
  const movil = ancho <= 430 && process.env.EMULAR !== '0' ? devices['iPhone 14'] : {};
  const ctx = await navegador.newContext({
    ...movil,
    viewport: { width: ancho, height: alto },
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
    reducedMotion: reducido ? 'reduce' : 'no-preference',
    ...(Object.keys(movil).length ? {} : { deviceScaleFactor: 1 }),
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('mantra-core-health.theme', t === 'oscuro' ? 'dark' : 'light');
    } catch {}
  }, tema);
  return ctx;
}

export async function entrar(pagina, correo, { organizacion } = {}) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(correo);
  for (const clave of ['demo1234', 'mockup']) {
    await pagina.getByTestId('login-password').fill(clave);
    await pagina.getByTestId('login-submit').click();
    const fue = await pagina
      .waitForURL(/\/(dashboard|auth\/organization|home)/, { timeout: 8_000 })
      .then(() => true, () => false);
    if (fue) break;
  }
  if (pagina.url().includes('/auth/organization')) {
    const opciones = pagina.getByTestId('tenant-opcion');
    if (organizacion) await opciones.filter({ hasText: organizacion }).first().click();
    else await opciones.first().click();
    await pagina.waitForURL(/\/(dashboard|home)/, { timeout: 60_000 });
  }
}

export async function ir(pagina, ruta, esperar) {
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  if (esperar) await pagina.locator(esperar).first().waitFor({ timeout: 60_000 });
  // La franja del modo demo («Datos de prueba», «Demo» a 390) NO es producto y
  // tapa texto en la captura: se oculta. Y el ratón se aparca en una esquina
  // vacía para que ninguna tarjeta salga en estado hover.
  await pagina.addStyleTag({ content: 'app-mock-banner,app-toast-container{display:none!important}' });
  await pagina.mouse.move(1, 1);
  await pagina.waitForTimeout(900); // que termine la animación de entrada
}

export async function capturar(pagina, fase, pantalla, vista, tema, extra = {}) {
  mkdirSync(`${SALIDA}/${fase}`, { recursive: true });
  const ruta = `${SALIDA}/${fase}/${pantalla}-${vista}-${tema}.png`;
  await pagina.screenshot({ path: ruta, fullPage: process.env.COMPLETA === '1', ...extra });
  return ruta;
}

/** Datos crudos que molestan: fechas ISO, uuid, coordenadas. */
export async function auditarCrudos(pagina) {
  return pagina.evaluate(() => {
    const texto = document.body.innerText;
    const patrones = {
      iso: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g,
      uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      coordenadas: /-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/g,
    };
    const salida = {};
    for (const [k, re] of Object.entries(patrones)) salida[k] = texto.match(re) ?? [];
    const ancho = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    salida.desbordeHorizontal = ancho > 1;
    return salida;
  });
}
