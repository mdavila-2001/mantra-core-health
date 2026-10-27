/**
 * Evidencia de la llave Doctor / Contador de Contabilidad, contra la maqueta:
 *
 * - Abre en Doctor: tres registros (gastos, activos, deudas), glosario de tres palabras,
 *   sin accesos contables.
 * - Contador: cinco registros, glosario de siete, «Informes contables» con sus dos enlaces.
 * - La versión elegida sobrevive a recargar la página.
 * - Sin desborde horizontal a 390 px; claro y oscuro.
 *
 * Uso: `node playwright/contabilidad-version.mjs [urlBase]`
 *
 * En `dev` y `test` la tarjeta de registros todavía no trae el glosario «¿Qué significa cada cosa?»:
 * sus comprobaciones se omiten si no existe.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SALIDA = fileURLToPath(new URL('../evidencias/contabilidad-version-2026-10-26-dev', import.meta.url));
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function entrar(pagina, usuario) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await pagina.getByTestId('login-identifier').fill(`${usuario}@alovida.mock`);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 90_000 });
  }
}

const rotulosDeRegistros = async (p) =>
  (await p.locator('[data-testid="contabilidad-registros"] [role="tab"]').allTextContents()).map((t) =>
    t.trim().replace(/\s*\(\d+\)$/u, ''),
  );
const terminos = async (p) =>
  (await p.locator('[data-testid="registros-glosario"] dt').allTextContents()).map((t) => t.trim());

async function abrirRegistros(p) {
  await p.getByRole('tab', { name: /^(Registros|Anotar gastos, equipos y deudas)$/ }).first().click();
  await p.getByTestId('contabilidad-registros').waitFor({ timeout: 60_000 });
  await p.waitForTimeout(600);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(
    process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {},
  );
  const errores = [];
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1500 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  await entrar(p, 'medica');
  await p.goto(`${BASE}/administration/accounting`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.getByTestId('contabilidad-version').waitFor({ timeout: 90_000 });
  await p.waitForTimeout(800);

  /* ── Doctor ───────────────────────────────────────────────────────────── */
  const opciones = await p.locator('[data-testid="contabilidad-version"] [role="radio"]').allTextContents();
  ok('la llave ofrece Doctor y Contador', opciones.map((o) => o.trim()).join('|') === 'Doctor|Contador', opciones.join('|'));
  ok(
    'abre en Doctor',
    (await p.locator('[data-testid="contabilidad-version"] [aria-checked="true"]').innerText()).trim() === 'Doctor',
  );
  ok('Doctor: sin «Informes contables»', (await p.getByTestId('contabilidad-herramientas').count()) === 0);
  await p.screenshot({ path: `${SALIDA}/01-doctor-resumen-1440.png` });

  await abrirRegistros(p);
  const regDoctor = await rotulosDeRegistros(p);
  ok('Doctor: registros = Gastos · Activos · Deudas', regDoctor.join(' · ') === 'Gastos · Activos · Deudas', regDoctor.join(' · '));
  const hayGlosario = (await p.getByTestId('registros-glosario').count()) > 0;
  if (hayGlosario) {
    await p.getByTestId('registros-glosario').locator('summary').click();
    const glosDoctor = await terminos(p);
    ok('Doctor: glosario de tres palabras', glosDoctor.join('|') === 'Gasto|Activo|Deuda', glosDoctor.join('|'));
  }
  const textoDoctor = await p.getByTestId('contabilidad-registros').innerText();
  ok('Doctor: sin Debe / Haber / Transacción en la tarjeta', !/\b(Debe|Haber|Transacci[oó]n)/.test(textoDoctor));
  await p.screenshot({ path: `${SALIDA}/02-doctor-registros-1440.png` });

  /* ── Contador ─────────────────────────────────────────────────────────── */
  await p.locator('[data-testid="contabilidad-version"] [role="radio"]', { hasText: 'Contador' }).click();
  await p.waitForTimeout(600);
  const regContador = await rotulosDeRegistros(p);
  ok(
    'Contador: registros = Gastos · Activos · Deudas · Transacciones · Cuentas',
    regContador.join(' · ') === 'Gastos · Activos · Deudas · Transacciones · Cuentas',
    regContador.join(' · '),
  );
  if (hayGlosario) {
    const glosContador = await terminos(p);
    ok('Contador: glosario de siete palabras', glosContador.length === 7 && glosContador.includes('Debe') && glosContador.includes('Haber'), glosContador.join('|'));
  }
  ok('Contador: «Informes contables» con dos enlaces', (await p.getByTestId('contabilidad-herramientas').locator('a').count()) === 2);
  await p.screenshot({ path: `${SALIDA}/03-contador-registros-1440.png` });

  // De Contador, estando en la pestaña Cuentas, volver a Doctor no deja el panel en blanco.
  await p.getByTestId('contabilidad-registros').getByRole('tab', { name: /^Cuentas/ }).click();
  await p.waitForTimeout(400);
  await p.locator('[data-testid="contabilidad-version"] [role="radio"]', { hasText: 'Doctor' }).click();
  await p.waitForTimeout(600);
  const seleccionada = (await p.locator('[data-testid="contabilidad-registros"] [role="tab"][aria-selected="true"]').allTextContents()).map((t) => t.trim());
  ok('Cuentas → Doctor vuelve a Gastos, sin panel en blanco', seleccionada.length === 1 && /^Gastos/.test(seleccionada[0]), seleccionada.join('|'));

  /* ── Persistencia ─────────────────────────────────────────────────────── */
  await p.locator('[data-testid="contabilidad-version"] [role="radio"]', { hasText: 'Contador' }).click();
  await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 240_000 });
  await p.getByTestId('contabilidad-version').waitFor({ timeout: 90_000 });
  await p.waitForTimeout(600);
  ok(
    'al recargar sigue en Contador',
    (await p.locator('[data-testid="contabilidad-version"] [aria-checked="true"]').innerText()).trim() === 'Contador' &&
      (await p.getByTestId('contabilidad-herramientas').count()) === 1,
  );
  await p.screenshot({ path: `${SALIDA}/04-contador-resumen-1440.png` });

  /* ── Oscuro y 390 px ──────────────────────────────────────────────────── */
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${SALIDA}/05-contador-resumen-1440-oscuro.png` });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await p.setViewportSize({ width: 390, height: 900 });
  await p.waitForTimeout(500);
  const desborde = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('390 px: sin desborde horizontal (Contador)', desborde <= 1, `${desborde}px`);
  await p.screenshot({ path: `${SALIDA}/06-contador-resumen-390.png` });
  await p.locator('[data-testid="contabilidad-version"] [role="radio"]', { hasText: 'Doctor' }).click();
  await p.waitForTimeout(400);
  const desborde2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('390 px: sin desborde horizontal (Doctor)', desborde2 <= 1, `${desborde2}px`);
  await p.screenshot({ path: `${SALIDA}/07-doctor-resumen-390.png` });

  ok('sin errores de página', errores.length === 0, errores.join(' | '));
  await navegador.close();
  const fallos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} verificaciones\n`);
  process.exit(fallos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
