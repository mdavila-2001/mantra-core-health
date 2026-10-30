/* ============================================================================
    CM-11 · revisión del PR #1441: lo que los cambios del formulario por partes
    y de la hoja compartida del alta (`registration.css`) tocan en OTRAS altas.

    - **El foco al campo con error** (`focus-first-invalid.ts`): en el alta de
      paciente y de profesional, «Siguiente» con la primera página vacía lleva
      el foco al **primer nombre** —un campo `custom`, las casillas de nombre—
      y no a «Apellido paterno»; el rótulo queda a la vista y no se abre el
      globo de descripción encima.
    - **El aviso de error del alta** (`.registro__alert` sin `display: block`):
      el ícono va al lado del texto. Para verlo sin completar un alta entera,
      el estado del aviso se fija con las herramientas de depuración de
      Angular (`ng.getComponent`, sólo en desarrollo): es una comprobación de
      cómo se DIBUJA el aviso, no de cuándo aparece.

    Contra el front en `real-api` (los catálogos de la primera página son de la
    API). Nunca espera `networkidle`.

      E2E_API_REAL=1 E2E_BASE_URL=http://localhost:4320 \
      yarn pw playwright/cm-11-foco-y-avisos-de-altas.spec.ts
    ========================================================================== */

import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

const EVIDENCIA = join('docs', 'frontend', 'evidence', 'cm-11-organizacion-medica');

const ALTAS = [
  { ruta: '/auth/register/patient', selector: 'app-register-patient', nombre: 'registro-nombre', clave: 'paciente' },
  {
    ruta: '/auth/register/practitioner',
    selector: 'app-register-practitioner',
    nombre: 'registro-pro-nombre',
    clave: 'profesional',
  },
] as const;

const VISTAS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

test.skip(process.env['E2E_API_REAL'] !== '1', 'Omitido: hace falta el front en real-api. No es un verde.');

/**
 * Errores de consola de estas altas que ya existían y no toca este cambio:
 * borradores con 429 o 404, telemetría con 400 y el aviso de desarrollo de la página
 * de 5 campos del profesional. Registrados en el issue #1451. Se dejan pasar
 * NOMBRADOS: el mensaje del `console.error` del navegador («Failed to load
 * resource…») sólo vale si viene de uno de esos dos recursos —se filtra por la
 * URL de la ubicación del mensaje—, y cualquier otro 400/429 hace caer la prueba.
 */
const RECURSOS_1451 = [/\/iam\/onboarding-drafts\//, /\/telemetry\/onboarding-events/];
const PREEXISTENTES_1451 = [
  /onboarding-drafts\/.* → 429 · RATE_LIMITED/,
  /onboarding-drafts\/.* → 404 · NOT_FOUND · «Borrador no encontrado»/,
  /telemetry\/onboarding-events → 400 · VALIDATION_FAILED/,
  /\[app-paginated-form\] La página «Su nombre y su cédula» trae 5 campos/,
];
const ESTADO_DE_RECURSO = /status of (429|404|400)/;

/** Errores de consola, excepciones y requests caídas (sin las que corta una navegación). */
function vigilar(page: Page): string[] {
  const problemas: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (PREEXISTENTES_1451.some((patron) => patron.test(m.text()))) return;
    if (
      ESTADO_DE_RECURSO.test(m.text()) &&
      RECURSOS_1451.some((recurso) => recurso.test(m.location().url))
    ) {
      return;
    }
    problemas.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const motivo = r.failure()?.errorText ?? '';
    if (!motivo.includes('ERR_ABORTED')) problemas.push(`requestfailed: ${r.url()} ${motivo}`);
  });
  return problemas;
}

async function foto(page: Page, nombre: string): Promise<void> {
  await page.evaluate(async () => {
    const corriendo = document.getAnimations().filter((animacion) => {
      const iteraciones = animacion.effect?.getComputedTiming().iterations ?? 1;
      return Number.isFinite(iteraciones) && animacion.playState === 'running';
    });
    await Promise.race([
      Promise.all(corriendo.map((animacion) => animacion.finished.catch(() => undefined))),
      new Promise((listo) => setTimeout(listo, 5_000)),
    ]);
  });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled' });
}

for (const alta of ALTAS) {
  for (const vista of VISTAS) {
    test(`${alta.clave} · ${vista.width}: el foco va al primer nombre, con el rótulo a la vista y sin globo`, async ({
      page,
    }) => {
      const problemas = vigilar(page);
      await page.setViewportSize(vista);
      await page.goto(alta.ruta, { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      const nombre = page.getByTestId(alta.nombre);
      await expect(nombre).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('paginated-form-continuar').last().click();

      await expect(nombre).toBeFocused();
      const medidas = await page.evaluate((testId) => {
        const control = document.querySelector(`[data-testid="${testId}"]`)!;
        const campo = control.closest('app-form-field')!;
        const rotulo = campo.querySelector('label')!.getBoundingClientRect();
        const globos = [...document.querySelectorAll('.form-field-description')].filter(
          (globo) => getComputedStyle(globo).opacity !== '0',
        );
        return { rotuloArriba: rotulo.top, rotuloAbajo: rotulo.bottom, alto: window.innerHeight, globos: globos.length };
      }, alta.nombre);
      expect(medidas.rotuloArriba, 'el rótulo no queda cortado arriba').toBeGreaterThanOrEqual(8);
      expect(medidas.rotuloAbajo).toBeLessThanOrEqual(medidas.alto);
      expect(medidas.globos, 'ningún globo de descripción abierto').toBe(0);
      await foto(page, `alta-${alta.clave}-${vista.width}-foco-en-el-error`);

      // La primera tecla devuelve el globo a su comportamiento de siempre.
      await page.keyboard.type('L');
      await expect(page.locator('[data-foco-por-error]')).toHaveCount(0);
      expect(problemas).toEqual([]);
    });
  }

  test(`${alta.clave} · 390 y 1440: el aviso de error lleva el ícono al lado del texto`, async ({ page }) => {
    const problemas = vigilar(page);
    for (const vista of VISTAS) {
      await page.setViewportSize(vista);
      await page.goto(alta.ruta, { waitUntil: 'domcontentloaded' });
      await esperarAplicacionLista(page);
      await expect(page.getByTestId(alta.nombre)).toBeVisible({ timeout: 30_000 });
      await page.evaluate((selector) => {
        interface Pantalla {
          state: { set(valor: unknown): void };
        }
        const ng = (
          window as unknown as {
            ng: { getComponent(e: Element): Pantalla; applyChanges(c: unknown): void };
          }
        ).ng;
        const pantalla = ng.getComponent(document.querySelector(selector)!);
        pantalla.state.set({
          status: 'validation',
          issues: [{ message: 'Ya existe una cuenta con ese correo. Pruebe con otro.' }],
        });
        ng.applyChanges(pantalla);
      }, alta.selector);
      const aviso = page.getByTestId('registro-error');
      await expect(aviso).toBeVisible();
      const icono = await aviso.locator('.alert__icon').boundingBox();
      const texto = await aviso.locator('.alert__content').boundingBox();
      expect(icono, 'el aviso tiene ícono').not.toBeNull();
      expect(Math.abs((icono?.y ?? 0) - (texto?.y ?? 999))).toBeLessThan(8);
      expect(icono?.x ?? 999).toBeLessThan(texto?.x ?? 0);
      await aviso.scrollIntoViewIfNeeded();
      await foto(page, `alta-${alta.clave}-${vista.width}-aviso-de-error`);
    }
    expect(problemas).toEqual([]);
  });
}
