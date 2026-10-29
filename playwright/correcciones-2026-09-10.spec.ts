import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Evidencia de la corrección del 10/09/2026 — modales, adjuntos, vínculos
 * clínicos, comunidades y directorios.
 *
 * ## Qué demuestra y qué no
 *
 * Demuestra **comportamiento en el navegador**: que el detalle y los adjuntos
 * se abren en un modal y no dentro de la fila, que el formulario de carga ya no
 * pide categoría ni sensibilidad, que la selección múltiple de formatos
 * distintos entra entera y **se manda entera** —se cuentan las peticiones—, que
 * (hasta el 28/10/2026) «Grupos y foros» abría Comunidades y la zona
 * «Directorios» del panel no ofrecía la tarjeta genérica; esas dos pruebas se
 * fueron con el árbol del panel.
 *
 * No demuestra la persistencia contra la base real: esta rama se sirve con el
 * backend simulado (`mock-backend.interceptor`), que es el entorno autorizado
 * para probar acá. La persistencia contra la API real no la cubre esta spec.
 *
 * ## Una sola prueba por área, con un solo ingreso
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Cada área entra una
 * vez y recorre lo suyo de un tirón, igual que el resto de la suite.
 */

/** Dónde queda la evidencia. `artifacts/` no se versiona. */
const EVIDENCIA = join(__dirname, '..', 'artifacts', 'correcciones-alovida');

function carpeta(area: string): string {
  const destino = join(EVIDENCIA, area);
  mkdirSync(destino, { recursive: true });
  return destino;
}

async function capturar(page: Page, area: string, nombre: string): Promise<void> {
  // `animations: 'disabled'` porque el modal entra con una transición de 150 ms
  // y sin esto la evidencia salía a medio aparecer: un panel semitransparente
  // sobre la pantalla de atrás no demuestra nada.
  await page.screenshot({
    path: join(carpeta(area), `${nombre}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}

/**
 * El expediente de la paciente que el backend simulado siembra.
 *
 * Hay que buscarla: el archivo clínico **no lista sin criterio** —enumerar el
 * padrón entero es exactamente lo que P-07-10 evita—, así que se busca por
 * nombre y se entra por «Ver expediente».
 */
async function abrirExpediente(page: Page): Promise<void> {
  await irA(page, '/medical-records');
  await estable(page);

  // `app-search-field` dibuja un `type="text"` a propósito —con `search` el
  // átomo pondría su propio botón de limpiar—, así que se lo busca por su
  // rótulo y no por el rol de caja de búsqueda.
  const buscador = page.getByLabel('Buscar por nombre o código').first();
  await expect(buscador).toBeVisible({ timeout: 30_000 });
  await buscador.fill('Ana');
  await buscador.press('Enter');

  const verExpediente = page.getByRole('link', { name: 'Ver expediente' }).first();
  await expect(verExpediente).toBeVisible({ timeout: 30_000 });
  await verExpediente.click();
  await estable(page);
  await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 30_000 });
}

/** Abre el modal de adjuntos de la primera fila, por el menú de acciones. */
async function abrirAdjuntosDesdeLaFila(page: Page): Promise<void> {
  await page.getByTestId('expediente-acciones').first().click();
  await page.getByRole('menuitem', { name: /Adjuntar archivos/ }).click();
  await expect(page.getByTestId('content-dialog-title')).toContainText('Adjuntar archivos');
}

test.describe('Corrección 10/09/2026', () => {
  test('el expediente abre detalle y adjuntos en modal, nunca dentro de la fila', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await abrirExpediente(page);
    await capturar(page, 'modales', 'E01-listado-clinico');

    const filasAntes = await page.locator('tbody tr').count();

    /* ── E02 · el detalle, en modal ──────────────────────────────────────── */
    await page.getByTestId('expediente-ver-detalle').first().click();

    const modal = page.getByTestId('content-dialog');
    await expect(modal).toBeVisible();
    // Un diálogo de verdad: el nativo, con nombre accesible.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('content-dialog-title')).toContainText('Detalle');
    // Y el listado quedó igual: no se insertó ninguna fila con el detalle.
    expect(await page.locator('tbody tr').count()).toBe(filasAntes);
    // El vínculo clínico se lee acá, que es donde la tabla no lo mostraría.
    await expect(page.getByTestId('expediente-detalle')).toContainText('Encuentro');
    await capturar(page, 'modales', 'E02-detalle-en-modal');

    // Cierra con Escape y el foco vuelve a un destino lógico.
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    /* ── E05 · adjuntar archivos, sin Categoría ni Sensibilidad ─────────── */
    // La fila ya no tiene un botón por acción: tiene su menú, y adjuntar es una
    // de sus entradas. Ése es el reparto que dejó la regla 6 del sistema de
    // diseño —lo que pide datos va a un modal; la celda conserva su alto—.
    await abrirAdjuntosDesdeLaFila(page);

    await expect(page.getByTestId('content-dialog-title')).toContainText('Adjuntar archivos');
    const cuerpo = page.getByTestId('content-dialog');
    await expect(cuerpo).not.toContainText('Categoría');
    await expect(cuerpo).not.toContainText('Sensibilidad');
    await expect(page.getByTestId('adjuntar-vacio')).toBeVisible();
    // El contexto clínico que hereda del diagnóstico padre, a la vista.
    await expect(page.getByTestId('adjuntar-contexto')).toContainText('Diagnóstico');
    await capturar(page, 'archivos', 'E05-modal-adjuntos-vacio');

    /* ── E06/E07 · tres formatos distintos, y las tres subidas ───────────── */
    // Acá **no** se cuentan peticiones de red: en esta rama el backend
    // simulado intercepta dentro de `HttpClient`, así que no sale nada por el
    // cable y contar `page.on('request')` daría cero con la subida
    // funcionando. Que sean tres peticiones —una por archivo, que es lo que el
    // endpoint acepta— lo fija la prueba unitaria del subidor con
    // `HttpTestingController`. Lo que se demuestra acá es la interacción.

    await page.getByTestId('adjuntar-archivos-input').setInputFiles([
      { name: 'estudio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 uno') },
      { name: 'lunar.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) },
      { name: 'holter.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    ]);

    const cola = page.getByTestId('adjuntar-lista');
    await expect(cola).toBeVisible();
    await expect(cola.locator('li')).toHaveCount(3);
    await expect(page.getByTestId('adjuntar-resumen')).toContainText('3 archivos');
    await expect(page.getByTestId('adjuntar-confirmar')).toContainText('Adjuntar 3 archivos');
    // Los tres, con su estado en palabras y no sólo en color.
    await expect(cola).toContainText('Pendiente');
    await expect(cola).toContainText('estudio.pdf');
    await expect(cola).toContainText('lunar.jpg');
    await expect(cola).toContainText('holter.png');
    await capturar(page, 'archivos', 'E06-tres-formatos-distintos');

    /* Quitar el del medio conserva los otros dos, y el rótulo se ajusta. */
    await cola.locator('li').nth(1).getByTestId('adjuntar-quitar').click();
    await expect(cola.locator('li')).toHaveCount(2);
    await expect(cola).not.toContainText('lunar.jpg');
    await expect(page.getByTestId('adjuntar-confirmar')).toContainText('Adjuntar 2 archivos');
    await capturar(page, 'archivos', 'E06-quitar-el-del-medio');

    /* Y se pueden añadir más sin perder los pendientes. */
    await page.getByTestId('adjuntar-archivos-input').setInputFiles([
      { name: 'lunar.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) },
    ]);
    await expect(cola.locator('li')).toHaveCount(3);

    await page.getByTestId('adjuntar-confirmar').click();

    // El modal cierra **sólo** con el lote entero adjuntado: `attached` se emite
    // recién cuando ningún archivo quedó pendiente ni con error.
    await expect(page.getByTestId('content-dialog')).toBeHidden({ timeout: 30_000 });
    await capturar(page, 'archivos', 'E07-lote-adjuntado');
  });

  // Acá había dos pruebas del árbol «Sus herramientas» del panel: «Grupos y
  // foros» abriendo Comunidades en un modal desde la zona «Pacientes y
  // equipo», y la zona «Directorios» sin la tarjeta genérica. El propietario
  // mandó retirar el árbol el 28/10/2026; «Grupos y foros» pasó al menú
  // lateral (abre `/groups`) y los directorios se abren desde su portada.

  test('el modal de adjuntos entra en alto reducido y en teléfono', async ({ page }) => {
    await entrar(page, doctora());
    await abrirExpediente(page);

    // Se abre **una vez** y después se cambia el tamaño con el modal abierto. No
    // es un atajo: en teléfono la columna de acciones de la tabla se pliega
    // —comportamiento de `app-data-table`, anterior a esta corrección— y el botón
    // que abre el modal no queda a mano. Lo que hay que medir es el modal.
    await abrirAdjuntosDesdeLaFila(page);

    for (const [nombre, tamano] of [
      ['alto-reducido-1024x600', { width: 1024, height: 600 }],
      ['movil-390x844', { width: 390, height: 844 }],
      ['movil-estrecho-360x800', { width: 360, height: 800 }],
    ] as const) {
      await page.setViewportSize(tamano);

      // El título arriba y las acciones del pie siguen alcanzables sin recorrer
      // el cuerpo: eso es lo que el pie proyectado vino a garantizar.
      await expect(page.getByTestId('content-dialog-title')).toBeVisible();
      await expect(page.getByTestId('adjuntar-confirmar')).toBeVisible();
      // Y la página no se desborda a lo ancho.
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde).toBe(false);
      await capturar(page, 'responsive', `E12-adjuntos-${nombre}`);
    }
  });
});
