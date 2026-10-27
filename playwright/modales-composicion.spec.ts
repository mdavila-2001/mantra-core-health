import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Lo que se proyecta dentro de un modal (27/10/2026).
 *
 * La receta de la consulta se veía con una tarjeta enmarcada dentro del modal,
 * el título repetido y los campos a tres columnas de 240 px, con la duración
 * sola en su fila. Esta prueba abre CADA casilla de la consulta —todas usan el
 * mismo `app-content-dialog`— y mide, en escritorio y en teléfono:
 *
 * 1. que ninguna rejilla de formulario del modal pase de dos columnas;
 * 2. que el bloque no dibuje un segundo marco dentro del panel;
 * 3. que el cuerpo no se desplace de costado.
 *
 * Contra el simulador (`yarn start:demo`). Deja una captura por casilla.
 */
const SALIDA = process.env['E2E_EVIDENCE_DIR']
  ? join(process.env['E2E_EVIDENCE_DIR'], 'modales-composicion')
  : join('artifacts', 'evidencia', '2026-10-27-modales-composicion');
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};
const ANCHOS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'telefono', width: 390, height: 844 },
] as const;

test.beforeEach(() => {
  test.setTimeout(300_000);
  mkdirSync(SALIDA, { recursive: true });
});

async function abrirLaConsulta(page: Page): Promise<void> {
  await entrar(page, DOCTORA);
  await irA(page, '/schedule');
  const tarjetas = page.locator('.dia__bloque[data-tipo="cita"]');
  await expect(tarjetas.first()).toBeVisible();
  const enCurso = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }),
  });
  const confirmadas = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }),
  });
  const tarjeta = (await enCurso.count()) > 0 ? enCurso.first() : confirmadas.first();
  const atender = tarjeta.getByTestId('dia-ir-a-atender');
  await atender.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await expect(abrir.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible();
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

interface Medida {
  readonly columnasMaximas: number;
  readonly marcoInterior: boolean;
  readonly desbordeLateral: number;
}

async function medir(modal: Locator): Promise<Medida> {
  return modal.evaluate((dialogo) => {
    const cuerpo = dialogo.querySelector<HTMLElement>('.content-dialog__cuerpo');
    if (!cuerpo) throw new Error('el modal no tiene cuerpo');
    const rejillas = [...cuerpo.querySelectorAll<HTMLElement>('.app-form-grid')];
    const columnasMaximas = Math.max(
      0,
      ...rejillas.map((r) => getComputedStyle(r).gridTemplateColumns.split(' ').length),
    );
    // La tarjeta raíz de cada bloque del cuerpo: la que es todo su contenido.
    const raices = [...cuerpo.children].flatMap((hijo) => {
      if (hijo.tagName === 'APP-CARD') return [hijo];
      const primera = hijo.firstElementChild;
      const resto = [...hijo.children].slice(1);
      return primera?.tagName === 'APP-CARD' &&
        resto.every((e) => e.tagName === 'APP-CONTENT-DIALOG')
        ? [primera]
        : [];
    });
    // El borde de costado: el de arriba puede ser el filete entre dos bloques.
    const marcoInterior = raices.some((tarjeta) => {
      const estilo = getComputedStyle(tarjeta);
      return (
        estilo.borderLeftStyle !== 'none' &&
        estilo.borderLeftWidth !== '0px' &&
        estilo.borderLeftColor !== 'rgba(0, 0, 0, 0)'
      );
    });
    return {
      columnasMaximas,
      marcoInterior,
      desbordeLateral: cuerpo.scrollWidth - cuerpo.clientWidth,
    };
  });
}

for (const ancho of ANCHOS) {
  test(`cada casilla de la consulta abre un modal bien compuesto · ${ancho.nombre}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho.width, height: ancho.height });
    await abrirLaConsulta(page);

    const casillas = page.locator('[data-testid^="consulta-casilla-"]');
    const ids = await casillas.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid') ?? ''),
    );
    expect(ids.length).toBeGreaterThan(0);

    for (const id of ids) {
      await page.getByTestId(id).click();
      const modal = page.getByTestId('content-dialog');
      await expect(modal).toBeVisible();
      // La entrada del panel es un muelle: se mide quieto.
      await page.waitForTimeout(600);

      const medida = await medir(modal);
      const nombre = id.replace('consulta-casilla-', '');
      await modal.screenshot({ path: join(SALIDA, `${ancho.nombre}-${nombre}.png`) });
      // La receta: la parte de la posología, que es la del reporte.
      if (nombre === 'medicacion') {
        const frecuencia = modal.getByTestId('receta-frecuencia');
        if ((await frecuencia.count()) > 0) {
          await frecuencia.scrollIntoViewIfNeeded();
          await modal.screenshot({ path: join(SALIDA, `${ancho.nombre}-${nombre}-posologia.png`) });
          await modal
            .locator('.content-dialog__cuerpo')
            .evaluate((cuerpo) => cuerpo.scrollBy(0, cuerpo.clientHeight / 2));
          await modal.screenshot({ path: join(SALIDA, `${ancho.nombre}-${nombre}-vigencia.png`) });
        }
      }

      expect.soft(medida.columnasMaximas, `${id}: columnas`).toBeLessThanOrEqual(2);
      expect.soft(medida.marcoInterior, `${id}: tarjeta enmarcada dentro del modal`).toBe(false);
      expect.soft(medida.desbordeLateral, `${id}: desborde lateral`).toBeLessThanOrEqual(1);

      await modal.getByTestId('content-dialog-close').click();
      await expect(page.getByTestId('content-dialog')).toHaveCount(0);
    }
  });
}
