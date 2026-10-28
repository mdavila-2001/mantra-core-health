import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * «Horarios de otros servicios» — pedido del propietario (02/10/2026).
 *
 * Lo pidió varias veces y no lo veía en ningún rol: los horarios de estudios,
 * procedimientos y demás servicios en una pestaña propia, separados de las
 * consultas, tanto para el médico como para el paciente.
 *
 * Corre contra la maqueta (`mockup`): la médica de demostración tiene martes y
 * jueves de 14 a 18 sólo para servicios («Estudios en la clínica») y los
 * miércoles por la mañana «Ambos». Hasta este cambio esas tardes no aparecían
 * en ninguna pantalla, porque «Mis horarios» dibuja una sola plantilla.
 *
 * 28/10/2026: la pestaña del médico en `/schedule` se retiró (propietario: la
 * barra es «Consultas» y «Mis horarios», nada más). Queda la del paciente.
 */

/** `uuid('hpid-medica')` de `mock-session.ts`: el perfil fijo de la médica. */
const MEDICA_PROFILE_ID = 'be0f3a66-c03e-4eac-a416-c1068238d3d2';

const EVIDENCIA = join('artifacts', 'evidencia', '2026-10-02-horarios-otros-servicios', 'evidencia');

const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCIA, { recursive: true });
});

/**
 * Los dos scripts en línea del «event replay» de Angular bajo SSR
 * (`__jsaction_bootstrap` y su cargador). La CSP del servidor sólo autoriza el
 * script anti-parpadeo, así que el navegador los bloquea en TODAS las páginas.
 * Es un defecto previo y ajeno a este cambio (no toca `index.html`, el servidor
 * ni `angular.json`), registrado aparte. Se excluyen por su hash exacto: cualquier
 * otra violación de CSP sigue haciendo fallar la prueba.
 */
const CSP_DEL_EVENT_REPLAY = [
  'sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg=',
  'sha256-kSSVmtxCwx5BcVxBHL/eBew1IVRG78eha+qAq9Y8B38=',
];

/** Errores de consola y respuestas 5xx, para fallar si la pantalla los produce. */
function vigilar(page: Page): string[] {
  const problemas: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const texto = m.text();
    if (/Content Security Policy/.test(texto) && CSP_DEL_EVENT_REPLAY.some((h) => texto.includes(h))) return;
    problemas.push(`console: ${texto}`);
  });
  page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500) problemas.push(`${r.status()} ${r.url()}`);
  });
  return problemas;
}

/**
 * El contenido no se va de costado: la grilla y la barra de pestañas scrollean
 * dentro de su caja.
 *
 * Se mide el área de contenido y no el documento entero porque la barra
 * superior de la aplicación (`.app-header__derecha`) ya desborda a 375 px en
 * TODAS las pantallas —«Mis horarios», «Mis servicios», el panel—, antes y
 * fuera de este cambio. Está registrado aparte; medir el documento acá haría
 * fallar esta prueba por un defecto que no es suyo.
 */
async function sinScrollHorizontal(page: Page): Promise<void> {
  const desborde = await page.evaluate(() => {
    const area = document.querySelector<HTMLElement>('.app-main__inner');
    if (area === null) return Number.POSITIVE_INFINITY;
    const vw = document.documentElement.clientWidth;
    return Math.max(area.scrollWidth - area.clientWidth, area.getBoundingClientRect().right - vw);
  });
  expect(desborde, 'el contenido no se va de costado').toBeLessThanOrEqual(1);
}

async function fotos(page: Page, nombre: string): Promise<void> {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await esperarAQueSeAsiente(page);
    await sinScrollHorizontal(page);
    await page.screenshot({ path: join(EVIDENCIA, `${nombre}-${vp.nombre}-claro.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}-1440-oscuro.png`), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' });
}

test('paciente · la ficha de la médica tiene la pestaña «Otros servicios» y lleva a reservar', async ({ page }) => {
  const problemas = vigilar(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarAlSimulador(page, 'paciente', '');

  await page.goto(`/directory/${MEDICA_PROFILE_ID}#horarios`, { waitUntil: 'domcontentloaded' });
  const horarios = page.locator('#horarios');
  await expect(horarios.getByRole('tab', { name: 'Consultas' })).toBeVisible();
  const pestana = horarios.getByRole('tab', { name: 'Otros servicios' });
  await pestana.click();

  const otros = page.getByTestId('service-schedule');
  await expect(otros).toBeVisible();
  await expect(otros.getByTestId('service-schedule-detail')).toBeVisible();

  // La semana en curso puede no tener lugar (depende del día en que se corre):
  // se avanza hasta encontrar inicios, como haría el paciente.
  const inicios = otros.getByTestId('service-schedule-start');
  for (let semana = 0; semana < 2 && (await inicios.count()) === 0; semana += 1) {
    await esperarAQueSeAsiente(page);
    if ((await inicios.count()) > 0) break;
    await otros.getByRole('button', { name: 'Semana siguiente' }).click();
  }
  await expect(inicios.first()).toBeVisible();

  await fotos(page, 'paciente-ficha-otros-servicios');

  await page.setViewportSize({ width: 1440, height: 900 });
  await inicios.first().click();
  await expect(page).toHaveURL(/\/my-account\/appointments\/book\/servicio\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('oferta')).not.toBeNull();
  expect(url.searchParams.get('recurso')).not.toBeNull();
  expect(url.searchParams.get('desde')).not.toBeNull();
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(EVIDENCIA, 'paciente-confirmar-servicio-1440-claro.png'), fullPage: true });

  expect(problemas, problemas.join('\n')).toEqual([]);
});
