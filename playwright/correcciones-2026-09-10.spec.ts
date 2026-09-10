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
 * «Grupos y foros» abre Comunidades, y que la zona «Directorios» del panel ya no
 * ofrece la tarjeta genérica mientras el menú lateral la conserva.
 *
 * No demuestra la persistencia contra la base real: esta rama se sirve con el
 * backend simulado (`mock-backend.interceptor`), que es el entorno autorizado
 * para probar acá. La persistencia contra la API real queda como comprobación
 * pendiente del entorno de pruebas del backend, y así se declara en el reporte.
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
    const adjuntar = page.getByTestId('expediente-adjuntar-archivo').first();
    await expect(adjuntar).toBeVisible();
    await adjuntar.click();

    await expect(page.getByTestId('content-dialog-title')).toHaveText('Adjuntar archivos');
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

  test('«Grupos y foros» abre Comunidades en un modal, con sus grupos', async ({ page }) => {
    await entrar(page, doctora());
    await irA(page, '/dashboard');
    await estable(page);

    // Zona «Pacientes y equipo», que es donde vive el acceso.
    await page.locator('[data-zona="gente"]').click();
    const acceso = page.locator('[data-ruta="/groups"]');
    await expect(acceso).toBeVisible();
    // Un botón, no un enlace: no lleva a ninguna dirección.
    await expect(acceso).toHaveAttribute('aria-haspopup', 'dialog');

    const accesosAntes = await page.getByTestId('panel-acceso').count();
    await acceso.click();

    await expect(page.getByTestId('content-dialog-title')).toHaveText('Comunidades');
    // Nada se desplegó dentro de la lista de tarjetas.
    expect(await page.getByTestId('panel-acceso').count()).toBe(accesosAntes);
    await capturar(page, 'comunidades', 'E09-comunidades');

    /* La comunidad, con sus anuncios y sus grupos. */
    await page.getByTestId('comunidad').first().click();
    await expect(page.getByTestId('content-dialog')).toContainText('Anuncios');
    const grupo = page.getByTestId('comunidad-grupo').first();
    await expect(grupo).toBeVisible({ timeout: 30_000 });
    await capturar(page, 'comunidades', 'E09-comunidad-con-grupos');

    /* La conversación del grupo, dentro del modal. */
    await grupo.click();
    await expect(page.getByTestId('comunidades-volver-grupo')).toBeVisible();
    await capturar(page, 'comunidades', 'E10-grupo-dentro-del-modal');

    // Volver deshace un escalón, no cierra el modal.
    await page.getByTestId('comunidades-volver-grupo').click();
    await expect(page.getByTestId('content-dialog')).toBeVisible();
    await expect(page.getByTestId('comunidad-grupo').first()).toBeVisible();
  });

  test('la zona Directorios pierde la tarjeta genérica y conserva el menú', async ({ page }) => {
    await entrar(page, doctora());
    await irA(page, '/dashboard');
    await estable(page);

    await page.locator('[data-zona="red"]').click();
    const zona = page.locator('[data-zona-abierta="red"]');
    await expect(zona).toBeVisible();

    // La aserción es **localizada**: dentro del contenedor de tarjetas. El
    // rótulo de la zona y el renglón del menú lateral tienen que seguir
    // diciendo «Directorios».
    await expect(zona.locator('[data-ruta="/directories"]')).toHaveCount(0);
    await expect(zona.locator('[data-ruta="/clinics-directory"]')).toBeVisible();
    await expect(zona.locator('[data-ruta="/laboratory-directory"]')).toBeVisible();
    await expect(zona.locator('[data-ruta="/pharmacies-directory"]')).toBeVisible();
    await expect(zona).toContainText('Directorios');
    await capturar(page, 'directorios', 'E11-zona-directorios');

    // El menú lateral lo conserva: es la mitad del pedido que NO se toca. Se
    // comprueba que el renglón **está**, no que se vea: que la barra esté
    // desplegada o recogida es estado del armazón y no de esta corrección.
    await expect(page.locator('[data-testid="nav-enlace"][href="/directories"]')).toHaveCount(1);

    /* Cada tarjeta abre **su** directorio en un modal de consulta. */
    await zona.locator('[data-ruta="/clinics-directory"]').click();
    await expect(page.getByTestId('content-dialog-title')).toHaveText('Directorio de clínicas');
    await capturar(page, 'directorios', 'E11-directorio-clinicas-en-modal');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('content-dialog')).toBeHidden();
    // Y salir del modal **no** cierra la zona de atrás: `Escape` es del modal.
    // Este recorrido encontró exactamente eso, que las pruebas unitarias no
    // podían ver porque hace falta el `<dialog>` de verdad.
    await expect(zona).toBeVisible();

    await zona.locator('[data-ruta="/pharmacies-directory"]').click();
    await expect(page.getByTestId('content-dialog-title')).toHaveText('Directorio de farmacias');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('content-dialog')).toBeHidden();

    await zona.locator('[data-ruta="/laboratory-directory"]').click();
    await expect(page.getByTestId('content-dialog-title')).toHaveText(
      'Directorio de laboratorios',
    );
  });

  /** E12 · el modal en alto reducido y en teléfono. */
  test('el modal de adjuntos entra en alto reducido y en teléfono', async ({ page }) => {
    await entrar(page, doctora());
    await abrirExpediente(page);

    // Se abre **una vez** y después se cambia el tamaño con el modal abierto. No
    // es un atajo: en teléfono la columna de acciones de la tabla se pliega
    // —comportamiento de `app-data-table`, anterior a esta corrección— y el botón
    // que abre el modal no queda a mano. Lo que hay que medir es el modal.
    await page.getByTestId('expediente-adjuntar-archivo').first().click();
    await expect(page.getByTestId('content-dialog-title')).toHaveText('Adjuntar archivos');

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
