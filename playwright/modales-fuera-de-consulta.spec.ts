import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';
import { irA } from './support/sesion';

/**
 * Los modales fuera de la consulta (28/10/2026).
 *
 * Abre cada modal con formulario que el simulador deja abrir, en escritorio y
 * en teléfono, le saca una foto y mide lo que se reportó en la receta:
 *
 * - `columnas`: cuántas columnas de campos usa el cuerpo;
 * - `huecoDerecho`: px entre el último campo y el borde del cuerpo (un bloque
 *   pegado a la izquierda con una columna vacía al lado);
 * - `desborde`: px que el cuerpo se desplaza de costado.
 *
 * `ETAPA=antes|despues` separa las fotos. Contra `yarn start:demo`. Un modal
 * que no se pudo abrir queda anotado en `medidas.json` y no tumba el resto:
 * es un recorrido para mirar, no un contrato del simulador.
 */
const ETAPA = process.env['ETAPA'] ?? 'despues';
const SALIDA = join(
  process.env['E2E_EVIDENCE_DIR'] ?? join('artifacts', 'evidencia', '2026-10-28-modales-fuera-de-consulta'),
  ETAPA,
);
const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const ANCHOS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'telefono', width: 390, height: 844 },
] as const;

interface Caso {
  readonly nombre: string;
  readonly ruta: string;
  readonly abrir: (page: Page) => Promise<void>;
}

const dialogo = (page: Page): Locator => page.locator('dialog[open]').last();

async function pestana(page: Page, nombre: RegExp): Promise<void> {
  await page.getByRole('tab', { name: nombre }).first().click();
}

const CASOS: Readonly<Record<string, readonly Caso[]>> = {
  medica: [
    {
      nombre: 'perfil-agregar-titulo',
      ruta: '/my-account/edit',
      abrir: async (p) => {
        await pestana(p, /Credenciales/);
        await p.getByTestId('credencial-agregar').click();
      },
    },
    {
      nombre: 'perfil-agregar-matricula',
      ruta: '/my-account/edit',
      abrir: async (p) => {
        await pestana(p, /Credenciales/);
        await p.getByTestId('matricula-agregar').click();
      },
    },
    {
      nombre: 'perfil-agregar-especialidades',
      ruta: '/my-account/edit',
      abrir: (p) => p.getByTestId('especialidad-agregar').click(),
    },
    {
      nombre: 'historial-anadir-elemento',
      ruta: '/my-account/edit',
      abrir: async (p) => {
        await pestana(p, /Trayectoria/);
        await p.getByTestId('abrir-alta-vinculo').click();
      },
    },
    {
      nombre: 'historial-nuevo-lugar',
      ruta: '/administration/my-practice',
      abrir: async (p) => {
        await p.getByTestId('sede-agregar').click();
        await p.getByTestId('sede-cargar-propio').click();
      },
    },
    {
      nombre: 'contabilidad-registro',
      ruta: '/administration/accounting',
      abrir: async (p) => {
        await pestana(p, /^(Registros|Anotar gastos, equipos y deudas)$/);
        await p.getByTestId('contabilidad-registros').getByTestId('nuevo-EXPENSE').click();
      },
    },
    {
      nombre: 'contabilidad-transaccion',
      ruta: '/administration/accounting',
      abrir: async (p) => {
        await p.locator('[data-testid="contabilidad-version"] [role=radio]', { hasText: 'Contador' }).click();
        await pestana(p, /^Transacciones/);
        await p.getByTestId('nueva-transaccion').click();
      },
    },
    {
      nombre: 'contabilidad-cuenta',
      ruta: '/administration/accounting',
      abrir: async (p) => {
        await p.locator('[data-testid="contabilidad-version"] [role=radio]', { hasText: 'Contador' }).click();
        await pestana(p, /^Cuentas/);
        await p.getByTestId('nueva-cuenta').click();
      },
    },
    {
      nombre: 'agenda-franja-del-dia',
      ruta: '/schedule',
      abrir: (p) => p.getByTestId('dia-agregar').first().click(),
    },
    {
      nombre: 'factura-simulada',
      ruta: '/medical-records/c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0/consultation',
      abrir: async (p) => {
        await p.getByTestId('consulta-casilla-pagos').click();
        await p.getByRole('button', { name: /^Cobrar y facturar/ }).first().click();
      },
    },
    {
      nombre: 'diagnostico-verificar',
      ruta: '/medical-records/c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0',
      abrir: async (p) => {
        await p.getByTestId('expediente-acciones').first().click();
        await p.getByRole('menuitem', { name: /^Confirmar/ }).first().click();
      },
    },
    {
      nombre: 'servicios-como-ofrezco',
      ruta: '/my-services',
      abrir: (p) => p.getByTestId('my-services-offer').first().click(),
    },
    {
      nombre: 'servicios-agregar',
      ruta: '/my-services',
      abrir: (p) => p.getByTestId('my-services-add').click(),
    },
    {
      nombre: 'servicios-terminos',
      ruta: '/my-services',
      abrir: (p) => p.getByTestId('my-services-terms').first().click(),
    },
    {
      nombre: 'encuesta-editar-pregunta',
      ruta: '/questionnaires',
      abrir: async (p) => {
        await p
          .getByRole('row', { name: /Encuesta post-cirugía/ })
          .getByRole('link', { name: /Abrir/ })
          .first()
          .click();
        await p.getByTestId('editor-pregunta-abrir').first().click();
      },
    },
  ],
  administrador: [
    {
      nombre: 'agenda-ingreso-mostrador',
      ruta: '/schedule',
      abrir: (p) => p.getByTestId('dia-ingreso-mostrador').click(),
    },
  ],
  aseguradora: [
    {
      nombre: 'seguro-producto',
      ruta: '/administration/insurance',
      abrir: (p) => p.getByRole('button', { name: /^Añadir un producto seguro en / }).first().click(),
    },
    {
      nombre: 'seguro-clausula',
      ruta: '/administration/insurance',
      abrir: (p) => p.getByRole('button', { name: /^Añadir cláusula a / }).first().click(),
    },
    {
      nombre: 'seguro-reglas-aprobacion',
      ruta: '/administration/insurance',
      abrir: (p) =>
        p.getByRole('button', { name: /^Editar reglas de aprobación de / }).first().click(),
    },
    {
      nombre: 'seguro-prima',
      ruta: '/administration/insurance',
      abrir: (p) =>
        p.getByRole('button', { name: /^Editar la prima de lista mensual de / }).first().click(),
    },
    {
      nombre: 'solicitud-detalle',
      ruta: '/administration/received-claims',
      abrir: (p) => p.getByTestId('received-claim-open').first().click(),
    },
    {
      nombre: 'solicitud-aprobar-parcial',
      ruta: '/administration/received-claims',
      abrir: async (p) => {
        await p.getByTestId('received-claim-actions').first().getByTestId('row-actions-trigger').click();
        await p.getByRole('menuitem', { name: /Aprobar parcialmente/ }).click();
      },
    },
    {
      nombre: 'solicitud-rechazar',
      ruta: '/administration/insurance-claims',
      abrir: async (p) => {
        await p.getByTestId('claim-link').first().click();
        await p.getByTestId('claim-reject-button').click();
      },
    },
  ],
  laboratorio: [
    {
      nombre: 'laboratorio-recibir-muestra',
      ruta: '/laboratory/reception',
      abrir: (p) => p.getByTestId('lab-reception-receive').first().click(),
    },
    {
      nombre: 'laboratorio-sucursal',
      ruta: '/administration/laboratory-branches',
      abrir: (p) => p.getByTestId('branches-create').click(),
    },
  ],
  farmacia: [
    {
      nombre: 'farmacia-producto',
      ruta: '/administration/pharmacy-catalog',
      abrir: (p) => p.getByTestId('products-new').click(),
    },
    {
      nombre: 'farmacia-categoria',
      ruta: '/administration/pharmacy-categories',
      abrir: (p) => p.getByTestId('categories-new').click(),
    },
    {
      nombre: 'farmacia-sucursal',
      ruta: '/administration/pharmacy-branches',
      abrir: (p) => p.getByTestId('branches-create').click(),
    },
  ],
  paciente: [
    {
      nombre: 'paciente-dependiente',
      ruta: '/my-account/dependents',
      abrir: (p) => p.getByTestId('dependents-nuevo').click(),
    },
    {
      nombre: 'paciente-objetar-cobro',
      ruta: '/my-account/requests',
      abrir: async (p) => {
        await p.getByRole('button', { name: /^Ver (decisión|solicitud) — Solicitud/i }).first().click();
        await p.getByTestId('mis-solicitudes-objetar').click();
      },
    },
    {
      nombre: 'paciente-calificar',
      ruta: '/p/valeria-rojas',
      abrir: (p) => p.getByTestId('perfil-calificar').first().click(),
    },
  ],
};

interface Medida {
  readonly campos: number;
  readonly columnas: number;
  readonly huecoDerecho: number;
  readonly desborde: number;
}

async function medir(modal: Locator): Promise<Medida> {
  return modal.evaluate((d) => {
    const cuerpo = d.querySelector<HTMLElement>('.content-dialog__cuerpo');
    if (!cuerpo) throw new Error('sin cuerpo');
    const caja = cuerpo.getBoundingClientRect();
    const derechaUtil = caja.right - parseFloat(getComputedStyle(cuerpo).paddingRight);
    const campos = [...cuerpo.querySelectorAll<HTMLElement>('app-form-field')].filter(
      (c) => c.offsetParent !== null && !c.parentElement?.closest('app-form-field'),
    );
    const izquierdas = new Set(campos.map((c) => Math.round(c.getBoundingClientRect().left / 8)));
    const derecha = Math.max(0, ...campos.map((c) => c.getBoundingClientRect().right));
    return {
      campos: campos.length,
      columnas: izquierdas.size,
      huecoDerecho: campos.length ? Math.round(derechaUtil - derecha) : 0,
      desborde: cuerpo.scrollWidth - cuerpo.clientWidth,
    };
  });
}

test.beforeAll(() => mkdirSync(SALIDA, { recursive: true }));

for (const ancho of ANCHOS) {
  for (const [usuario, casos] of Object.entries(CASOS)) {
    test(`modales de ${usuario} · ${ancho.nombre}`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: ancho.width, height: ancho.height });
      await entrarAlSimulador(page, usuario, BASE);
      const medidas: Record<string, Medida | { error: string }> = {};

      for (const caso of casos) {
        try {
          await irA(page, '/dashboard');
          await irA(page, caso.ruta);
          await page.waitForTimeout(1500);
          await caso.abrir(page);
          const modal = dialogo(page);
          await expect(modal).toBeVisible({ timeout: 10_000 });
          // La entrada del panel es un muelle: se mide quieto.
          await page.waitForTimeout(700);
          medidas[caso.nombre] = await medir(modal);
          await modal.screenshot({ path: join(SALIDA, `${ancho.nombre}-${caso.nombre}.png`) });
          await page.keyboard.press('Escape');
          await expect(page.locator('dialog[open]')).toHaveCount(0, { timeout: 5_000 });
        } catch (fallo) {
          medidas[caso.nombre] = { error: String(fallo).split('\n')[0]!.slice(0, 200) };
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      }

      writeFileSync(
        join(SALIDA, `medidas-${usuario}-${ancho.nombre}.json`),
        JSON.stringify(medidas, null, 2),
      );
    });
  }
}
