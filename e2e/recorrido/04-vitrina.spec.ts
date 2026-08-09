import { test } from '@playwright/test';

import { simularApiTotal } from './support/api-total';
import { capturar } from './support/evidencia';
import { EVITAR_POR_DEFECTO, esperarEstable, recorrer } from './support/explorador';

/**
 * La vitrina del sistema de diseño.
 *
 * Es la pantalla más densa de la aplicación por lejos: reúne los treinta y pico
 * de componentes con todas sus variantes, y sola tiene más controles que el
 * resto del producto junto. Por eso va en su propio archivo y con su propio
 * tope: mezclada con las demás, se llevaría el tiempo de la corrida y su
 * evidencia taparía la del producto en el reporte.
 *
 * El tope existe igual, y cuando corta **queda anotado**. Está puesto por encima
 * de la cuenta de controles de la vitrina —eran 226 en la última medición— para
 * que no corte nada hoy, y que siga siendo un tope por si alguien agrega una
 * galería que se descontrole: sin él, un bucle de controles que se generan al
 * accionarlos colgaría la corrida entera en vez de recortar y avisar.
 */

test.describe('Recorrido · vitrina de diseño', () => {
  test('vitrina completa', async ({ page }) => {
    await simularApiTotal(page);

    await recorrer(
      page,
      { ruta: '/design-system', carpeta: '40-vitrina', titulo: 'Vitrina de diseño' },
      // Sólo lo visible, y sólo acá: la vitrina mide más de veinte mil píxeles
      // de alto, así que cada captura de página completa pesa dos megas y medio
      // y doscientas serían medio giga de imágenes casi idénticas. El clic ya
      // dejó el control accionado a la vista, que es lo que hay que ver.
      { maxAcciones: 300, evitar: EVITAR_POR_DEFECTO, paginaCompleta: false },
    );
  });

  /**
   * Los estados que la vitrina sólo muestra si se le pide.
   *
   * El diálogo de confirmación y los avisos emergentes viven detrás de un botón
   * y desaparecen solos. El explorador captura el clic que los abre, pero no
   * garantiza que la captura los agarre montados: acá se los espera.
   */
  test('diálogo de confirmación', async ({ page }) => {
    await simularApiTotal(page);

    const pantalla = { carpeta: '41-vitrina-dialogo', titulo: 'Vitrina · diálogo' };

    await page.goto('/design-system');
    await esperarEstable(page);

    await page.locator('[data-testid="demo-confirmar-guardado"]').first().click();
    await page.getByRole('dialog').first().waitFor({ timeout: 10_000 });
    await esperarEstable(page);
    await capturar(page, pantalla, 'diálogo de confirmación abierto');

    // Los dos desenlaces del diálogo, no sólo el de aceptar.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /cancelar|cerrar/i })
      .first()
      .click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'diálogo cancelado');
  });

  test('galería de estados de vista', async ({ page }) => {
    await simularApiTotal(page);

    const pantalla = { carpeta: '42-estados-vista', titulo: 'Galería de estados de vista' };

    await page.goto('/design-system');
    await esperarEstable(page);

    // La galería recorre los estados S1…S5 con un botón que avanza al siguiente:
    // cada clic es un estado distinto y todos merecen su captura.
    const siguiente = page.getByRole('button', { name: /siguiente estado/i }).first();
    await capturar(page, pantalla, 'estado inicial');

    for (let paso = 1; paso <= 6; paso += 1) {
      if ((await siguiente.count()) === 0) {
        break;
      }
      await siguiente.click();
      await esperarEstable(page);
      await capturar(page, pantalla, `estado ${paso}`);
    }
  });
});
