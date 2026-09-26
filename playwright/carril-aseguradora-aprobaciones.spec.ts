import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
 * órdenes de Aprobación»: la aseguradora aprueba o no aprueba cada ítem, con
 * la cláusula del contrato en lo que no aprueba.
 *
 * Corre contra la maqueta (`mockBackend: true`, `prior-authorization.handlers.ts`),
 * que reproduce el contrato y las reglas de la API. El camino real contra
 * PostgreSQL lo cubre `test/integration/patient-coverage-copays.int-spec.ts`
 * en el repositorio de la API.
 *
 * Nunca `networkidle` (con HMR no llega): se espera un selector concreto.
 */

const BANDEJA = '/administration/insurance-approvals';
const EVIDENCIA = 'docs/frontend/evidence/aseguradora-aprobaciones';

const ASEGURADORA: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Aseguradora (maqueta)',
};

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Paciente (maqueta)',
};

const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'tablet-horizontal', width: 1024, height: 768 },
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'escritorio-grande', width: 1920, height: 1080 },
] as const;

/** Errores de consola y de página: una pantalla que «se ve» con errores no pasa. */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // El CSP rechaza los scripts en línea que inyecta `ng serve`: pasa en
    // todas las pantallas del servidor de desarrollo, no es de ésta.
    if (m.type() === 'error' && !m.text().includes('Content Security Policy')) {
      errores.push(`console: ${m.text()}`);
    }
  });
  return errores;
}

async function abrirBandeja(page: Page, query = ''): Promise<void> {
  await irA(page, `${BANDEJA}${query}`);
  await expect(page.getByRole('heading', { name: 'Solicitudes de aprobación' })).toBeVisible({
    timeout: 30_000,
  });
}

/** Sin barra horizontal en el documento. */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: document.documentElement.clientWidth,
  }));
  expect(ancho, 'desborde horizontal del documento').toBeLessThanOrEqual(visible);
}

test.describe('bandeja de solicitudes de aprobación (aseguradora)', () => {
  test.beforeEach(async ({ page }) => {
    // Cada prueba arranca con la bandeja del fixture: la maqueta la guarda en
    // sessionStorage y una respuesta enviada en otra prueba la cambiaría.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__pa_reset')) {
        sessionStorage.removeItem('mock.insurance.autorizaciones');
        sessionStorage.setItem('__pa_reset', '1');
      }
    });
  });

  test('abre en pendientes y el filtro viaja en la URL', async ({ page }) => {
    const errores = vigilarErrores(page);
    await entrar(page, ASEGURADORA);
    await abrirBandeja(page);

    const filas = page.getByTestId('approval-link');
    await expect(filas).toHaveCount(3);
    await expect(page.getByTestId('approval-status').first()).toHaveText('Pendiente');

    await page.getByTestId('approvals-filter').getByText('Respondidas').click();
    await expect(page).toHaveURL(/estado=decididas/);
    await expect(filas).toHaveCount(1);
    await expect(page.getByTestId('approval-status').first()).toHaveText('Aprobación parcial');

    expect(errores).toEqual([]);
  });

  test('aprobar y no aprobar por ítem: UI → request → respuesta → recarga → UI', async ({ page }) => {
    const errores = vigilarErrores(page);
    await entrar(page, ASEGURADORA);
    await abrirBandeja(page);

    // La receta de cinco medicamentos.
    await page.getByRole('row').filter({ hasText: 'Receta médica' }).getByTestId('approval-link').click();
    await expect(page.getByTestId('approval-item')).toHaveCount(5, { timeout: 30_000 });

    const enviar = page.getByTestId('approval-send');
    await expect(enviar).toHaveAttribute('aria-disabled', 'true');

    // No aprobar el 4 y el 5, con su cláusula.
    const clausulas = [
      'Cláusula 7.1 — antihistamínicos de venta libre excluidos',
      'Cláusula 9.2 — suplementos vitamínicos excluidos',
    ];
    for (const [indice, clausula] of [
      [3, clausulas[0]!],
      [4, clausulas[1]!],
    ] as const) {
      await page
        .getByTestId('approval-item')
        .nth(indice)
        .getByRole('button', { name: /^No aprobar/ })
        .click();
      const modal = page.getByRole('dialog', { name: 'No aprobar este ítem' });
      await expect(modal).toBeVisible();
      // Sin cláusula no confirma.
      await modal.getByTestId('deny-confirm').click();
      await expect(modal).toBeVisible();
      await modal.getByTestId('deny-clause').fill(clausula);
      await modal.getByTestId('deny-confirm').click();
      await expect(modal).toBeHidden();
    }
    await expect(page.getByTestId('approval-outcome')).toHaveText(/Faltan 3 de 5/);

    await page.getByTestId('approve-remaining').click();
    await expect(page.getByTestId('approval-outcome')).toHaveText(
      'Aprobación parcial: 3 aprobados y 2 no aprobados.',
    );
    await page.getByTestId('approval-send').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${EVIDENCIA}/detalle-borrador-1440.png` });

    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    const confirmar = page.getByRole('dialog').getByRole('button', { name: 'Enviar respuesta' });
    await expect(confirmar).toBeVisible();

    // La maqueta es un interceptor HTTP de Angular: el POST no sale a la red,
    // así que se lee lo que quedó persistido en el almacén de la maqueta.
    await confirmar.click();
    await expect(page.getByTestId('approval-send')).toHaveCount(0);
    const persistido = await page.evaluate(() => {
      const crudo = sessionStorage.getItem('mock.insurance.autorizaciones');
      const filas = (JSON.parse(crudo ?? '{"filas":[]}') as {
        filas: { origin: string; status: string; decision: string; items: { decision: { decision: string; policyClauseReference: string | null } | null }[] }[];
      }).filas;
      return filas.find((f) => f.origin === 'PHARMACY' && f.items.length === 5);
    });
    expect(persistido?.status).toBe('DETERMINED');
    expect(persistido?.decision).toBe('PARTIAL');
    expect(persistido?.items.map((i) => i.decision?.decision)).toEqual([
      'APPROVED',
      'APPROVED',
      'APPROVED',
      'DENIED',
      'DENIED',
    ]);
    expect(persistido?.items.slice(3).map((i) => i.decision?.policyClauseReference)).toEqual(
      clausulas,
    );

    await expect(page.getByTestId('approval-status')).toHaveText('Aprobación parcial');

    // Recarga completa: lo que se ve sale de lo persistido, no del borrador.
    await page.reload();
    await expect(page.getByTestId('approval-item')).toHaveCount(5, { timeout: 30_000 });
    await expect(page.getByTestId('approval-status')).toHaveText('Aprobación parcial');
    await expect(page.getByTestId('approval-item-decision')).toHaveText([
      'Aprobado',
      'Aprobado',
      'Aprobado',
      'No aprobado',
      'No aprobado',
    ]);
    await expect(page.getByTestId('approval-item-reason').nth(3)).toContainText(clausulas[0]!);
    await expect(page.getByTestId('approval-item-reason').nth(4)).toContainText(clausulas[1]!);
    await expect(page.getByTestId('approval-send')).toHaveCount(0);
    await page.getByTestId('approval-item').nth(4).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${EVIDENCIA}/detalle-respondida-1440.png` });

    // Y en la bandeja ya no está pendiente.
    await abrirBandeja(page);
    await expect(page.getByTestId('approval-link')).toHaveCount(2);

    expect(errores).toEqual([]);
  });

  for (const vp of VIEWPORTS) {
    test(`responsive ${vp.nombre} ${vp.width}x${vp.height}`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await entrar(page, ASEGURADORA);
      await abrirBandeja(page);
      await expect(page.getByTestId('approval-link')).toHaveCount(3);
      await sinDesbordeHorizontal(page);
      await page.screenshot({ path: `${EVIDENCIA}/bandeja-${vp.nombre}.png` });

      // La primera pendiente es la receta de cinco ítems (la más reciente).
      await page.getByTestId('approval-link').first().click();
      await expect(page.getByTestId('approval-item').first()).toBeVisible({ timeout: 30_000 });
      await sinDesbordeHorizontal(page);

      // Regla §5: una tarjeta centrada y a lo ancho del área de contenido.
      const medida = await page.evaluate(() => {
        const area = document.querySelector('.app-main__inner')?.getBoundingClientRect();
        const tarjeta = document.querySelector('app-card.approval')?.getBoundingClientRect();
        if (!area || !tarjeta) return null;
        const cs = getComputedStyle(document.querySelector('.app-main__inner')!);
        const interior = area.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return {
          izquierda: tarjeta.left - area.left - parseFloat(cs.paddingLeft),
          derecha: area.right - parseFloat(cs.paddingRight) - tarjeta.right,
          proporcion: tarjeta.width / interior,
        };
      });
      expect(medida, 'tarjeta y área medibles').not.toBeNull();
      expect(Math.abs(medida!.izquierda - medida!.derecha)).toBeLessThanOrEqual(2);
      expect(medida!.proporcion).toBeGreaterThanOrEqual(0.85);

      // El modal de «No aprobar» entra en el viewport.
      await page.getByTestId('approval-item').first().getByRole('button', { name: /^No aprobar/ }).click();
      const modal = page.getByRole('dialog', { name: 'No aprobar este ítem' });
      await expect(modal).toBeVisible();
      const caja = await modal.boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(0);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(vp.width);
      await page.screenshot({ path: `${EVIDENCIA}/detalle-modal-${vp.nombre}.png` });
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
      await page.getByTestId('approval-item').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${EVIDENCIA}/detalle-${vp.nombre}.png` });

      expect(errores).toEqual([]);
    });
  }

  test('un paciente no ve la sección ni llega a la bandeja', async ({ page }) => {
    await entrar(page, PACIENTE);
    await irA(page, BANDEJA);
    await expect(page.getByTestId('nav-enlace').filter({ hasText: 'Solicitudes de aprobación' })).toHaveCount(0);
    await expect(page.getByTestId('approval-link')).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCIA}/paciente-sin-acceso.png` });
  });
});
