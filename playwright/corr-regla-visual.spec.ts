import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** La rama `mockup` no habla con ninguna API: se entra contra el simulador. */
const USUARIO = process.env['CORR_USUARIO'] ?? 'medica';

async function entrarAlSimulador(page: Page): Promise<void> {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill(`${USUARIO}@alovida.mock`);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  // La doctora pertenece a dos organizaciones: el ingreso termina eligiendo una.
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByRole('button').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
}

/**
 * Auditoría GLOBAL de la regla visual del cliente (CORR-04 / carril 34):
 * todas las rutas de `docs/progress/evidence/lane-34/rutas.json`, en 3
 * viewports claro + 1 oscuro, con foto y medición. Escribe `MATRIZ.md`.
 *
 * `rutas.json` se genera la primera vez con:
 *   node -e "..."  (ver scripts/corr-evidencia.sh --auditoria)
 * y se puede podar a mano (rutas con parámetros que necesitan un id real).
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FASE = process.env['CORR_FASE'] ?? 'despues';
const SOLO_RUTA = process.env['CORR_RUTA'] ?? '';
const DESTINO = join('..', 'docs', 'progress', 'evidence', 'lane-34');
const FOTOS = join(DESTINO, 'fotos', FASE);
const RUTAS: string[] = (JSON.parse(readFileSync(join(DESTINO, 'rutas.json'), 'utf8')) as string[])
  .filter((r) => !SOLO_RUTA || r === SOLO_RUTA);

const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

async function medir(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('.app-main') as HTMLElement | null;
    const area = document.querySelector('.app-main__inner') as HTMLElement | null;
    const bloque = area
      ? (Array.from(area.children).find((c) => (c as HTMLElement).offsetWidth > 0) as HTMLElement | undefined)
      : undefined;
    const a = area?.getBoundingClientRect();
    const b = bloque?.getBoundingClientRect();
    return {
      fondo: main ? getComputedStyle(main).backgroundColor : 'sin .app-main',
      izq: a && b ? b.left - a.left : -1,
      der: a && b ? a.right - b.right : -1,
      ancho: b?.width ?? 0,
      area: a?.width ?? 0,
      scroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      cargo: !!document.querySelector('.app-main__inner') && !document.querySelector('app-not-found'),
    };
  });
}

test('auditoría de la regla visual en todas las rutas', async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  mkdirSync(FOTOS, { recursive: true });
  const filas: string[] = [];
  let pass = 0, fail = 0, sinCargar = 0;

  for (const tema of ['claro', 'oscuro'] as const) {
    const vps = tema === 'claro' ? VIEWPORTS : VIEWPORTS.slice(2);
    for (const vp of vps) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: tema === 'oscuro' ? 'dark' : 'light',
        locale: 'es-BO', timezoneId: 'America/La_Paz',
      });
      const page = await context.newPage();
      await entrarAlSimulador(page);
      for (const ruta of RUTAS) {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(900);
        const nombre = ruta.replace(/^\//, '').replace(/[\/?=&]+/g, '_') || 'inicio';
        const foto = join(FOTOS, `${nombre}-${vp.nombre}-${tema}.png`);
        await page.screenshot({ path: foto, fullPage: true });
        const m = await medir(page);
        if (!m.cargo) { sinCargar += 1; filas.push(`| \`${ruta}\` | ${vp.nombre} | ${tema} | SIN CARGAR | | | | \`${foto}\` |`); continue; }
        const fondo = tema === 'oscuro' ? '—' : (m.fondo === 'rgb(255, 255, 255)' ? 'PASS' : `FAIL (${m.fondo})`);
        const centrado = Math.abs(m.izq - m.der) <= 2 ? 'PASS' : `FAIL (${Math.round(m.izq)}/${Math.round(m.der)})`;
        const ancho = m.area > 0 && m.ancho / m.area >= 0.85 ? 'PASS' : `FAIL (${Math.round((m.ancho / Math.max(1, m.area)) * 100)} %)`;
        const scroll = m.scroll ? 'FAIL' : 'PASS';
        const ok = ![fondo, centrado, ancho, scroll].some((x) => x.startsWith('FAIL'));
        ok ? pass++ : fail++;
        filas.push(`| \`${ruta}\` | ${vp.nombre} | ${tema} | ${fondo} | ${centrado} | ${ancho} | ${scroll} | \`${foto.replace(`${DESTINO}/`, '')}\` |`);
      }
      await context.close();
    }
  }

  writeFileSync(join(DESTINO, `MATRIZ${FASE === 'antes' ? '-antes' : ''}.md`), [
    `# MATRIZ — regla visual del cliente — ${FASE} — ${new Date().toISOString()}`,
    '', `Rutas: ${RUTAS.length} · celdas PASS: ${pass} · FAIL: ${fail} · sin cargar: ${sinCargar}`, '',
    '| Ruta | Viewport | Tema | Fondo blanco | Centrado | Ancho | Sin scroll H | Foto |',
    '|---|---|---|---|---|---|---|---|', ...filas,
  ].join('\n'), 'utf8');

  expect(sinCargar, 'hay rutas que no cargaron: podá rutas.json o arreglá la ruta').toBe(0);
  if (FASE === 'despues') expect(fail, 'celdas en FAIL — ver MATRIZ.md').toBe(0);
});
