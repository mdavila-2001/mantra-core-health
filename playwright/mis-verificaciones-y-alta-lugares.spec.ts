import { test, expect, type Page } from '@playwright/test';
import type { Actor } from './support/actores';
import { capturar } from './support/captura';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * Evidencia de navegador del pedido del 28/10/2026 sobre el alta de médico:
 *
 * 1. en el alta, elegir instituciones (con su sello de institución verificada) y
 *    seguros con los que trabaja;
 * 2. «Mis verificaciones»: hoja de ruta y bandeja de solicitudes como chat;
 * 3. la aseguradora aprueba o rechaza, y el médico lo ve con su motivo.
 *
 * Corre contra `ng serve` con el simulador (`mockBackend: true`), que es lo que
 * se despliega hoy. Nunca espera `networkidle`: con HMR no llega (CLAUDE.md).
 *
 * Cada mutación se prueba UI → persistencia → recarga → UI. En modo `demo`
 * el simulador contesta dentro del navegador —no hay petición de red que
 * esperar— y persiste en `sessionStorage`, así que la recarga vuelve a leer lo
 * guardado y no lo que la pantalla recordaba. El tramo petición → respuesta se
 * verifica contra la API real (`mis-verificaciones-api-real.spec.ts`).
 *
 * Las capturas son evidencia: sin transiciones de vista (`reducedMotion`), sin
 * `fullPage` (el área de contenido tiene scroll propio y la recomposición
 * dejaba el armazón a medias) y con el ancho real en el nombre
 * (`support/captura.ts`). La ventana es alta para que entre la pantalla.
 */
test.use({ reducedMotion: 'reduce' });

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};
const ASEGURADORA: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'mock',
  nombre: 'Aseguradora',
};

const VIEWPORTS = [
  { nombre: '390', ancho: 390, alto: 1800 },
  { nombre: '768', ancho: 768, alto: 1500 },
  { nombre: '1440', ancho: 1440, alto: 1200 },
] as const;

const EVIDENCIA = 'docs/refactor-profesional/trabajo/capturas/e2e/verificaciones';

/** El único error preexistente conocido bajo `ng serve` (hallazgo H-14). */
const CSP_DEL_SERVIDOR_DE_DESARROLLO =
  /Executing inline script violates the following Content Security Policy/;

/**
 * El índice del glosario es un artefacto generado e ignorado por git
 * (`/public/glossary-data/`, `.gitignore`): en un clon recién hecho no existe y
 * su 404 aparece en cualquier pantalla pública. Ajeno a este cambio; se excluye
 * ESTE recurso y ningún otro.
 */
const INDICE_DEL_GLOSARIO_NO_GENERADO = /\/glossary-data\/manifest\.json$/;

/**
 * Junta los errores de la página: consola, excepciones y respuestas ≥ 400 (con
 * su URL, que el mensaje de consola de un 404 no trae). Devuelve una función
 * que entrega los reales, sin las dos exclusiones documentadas arriba.
 */
function juntarErrores(page: Page): () => string[] {
  const consola: string[] = [];
  const respuestas: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    if (CSP_DEL_SERVIDOR_DE_DESARROLLO.test(mensaje.text())) return;
    consola.push(mensaje.text());
  });
  page.on('pageerror', (error) => consola.push(error.message));
  page.on('response', (respuesta) => {
    if (respuesta.status() >= 400) respuestas.push(`${respuesta.status()} ${respuesta.url()}`);
  });
  return () => {
    const glosario = respuestas.filter((r) => INDICE_DEL_GLOSARIO_NO_GENERADO.test(r)).length;
    let porDescartar = glosario;
    const deConsola = consola.filter((m) => {
      // Cada 404 del glosario deja además un «Failed to load resource» sin URL.
      if (porDescartar > 0 && /status of 404/.test(m)) {
        porDescartar -= 1;
        return false;
      }
      return true;
    });
    return [...deConsola, ...respuestas.filter((r) => !INDICE_DEL_GLOSARIO_NO_GENERADO.test(r))];
  };
}

async function desbordaHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

/** La regla del cliente: centrada (holgura izq ≈ der, ≤ 2 px) y ≥ 85 % del área. */
async function medirTarjeta(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const tarjeta = document.querySelector(sel)!.getBoundingClientRect();
    return {
      holguraIzquierda: tarjeta.left - area.left,
      holguraDerecha: area.right - tarjeta.right,
      proporcion: tarjeta.width / area.width,
    };
  }, selector);
}

async function abrirVerificaciones(page: Page): Promise<void> {
  await irA(page, '/my-account/verifications');
  await expect(page.getByTestId('verif-tramo-profile')).toBeVisible({ timeout: 30_000 });
}

test.describe('Mis verificaciones', () => {
  for (const vp of VIEWPORTS) {
    test(`hoja de ruta y bandeja a ${vp.nombre} px: centradas, a lo ancho, sin desborde`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.ancho, height: vp.alto });
      const errores = juntarErrores(page);
      await entrar(page, MEDICA);
      await abrirVerificaciones(page);

      // Los siete tramos, cada uno con su sello.
      for (const clave of [
        'account',
        'profile',
        'licenses',
        'credentials',
        'specialties',
        'institutions',
        'insurers',
      ]) {
        await expect(page.getByTestId(`verif-tramo-${clave}`)).toBeVisible();
      }
      // La médica demo trae una aseguradora rechazada con motivo.
      await expect(page.getByTestId('verif-tramo-insurers')).toContainText('Rechazado');

      const tarjeta = await medirTarjeta(page, '.verif__tarjeta');
      expect(Math.abs(tarjeta.holguraIzquierda - tarjeta.holguraDerecha)).toBeLessThanOrEqual(2);
      expect(tarjeta.proporcion).toBeGreaterThanOrEqual(0.85);
      expect(await desbordaHorizontal(page)).toBe(false);
      await capturar(page, `${EVIDENCIA}/hoja-de-ruta-${vp.nombre}.png`);

      await page.getByRole('tab', { name: 'Solicitudes enviadas' }).click();
      await expect(page.getByTestId('verif-bandeja')).toBeVisible();
      await expect(page.getByTestId('verif-hilo-abierto')).toBeVisible();
      expect(await desbordaHorizontal(page)).toBe(false);
      await capturar(page, `${EVIDENCIA}/bandeja-${vp.nombre}.png`);

      expect(errores()).toEqual([]);
    });
  }

  test('retirar y volver a pedir: UI → persistencia → recarga → UI, con la historia', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    const errores = juntarErrores(page);
    await entrar(page, MEDICA);
    await abrirVerificaciones(page);
    await page.getByRole('tab', { name: 'Solicitudes enviadas' }).click();

    // La pendiente de la médica demo es con Seguros Andina.
    const hilo = page.getByTestId('verif-bandeja').getByRole('button', { name: /Seguros Andina/ });
    await hilo.click();
    await expect(page.getByTestId('verif-hilo-abierto')).toContainText(
      'Esperando que Seguros Andina',
    );

    await page.getByTestId('verif-retirar').click();
    await expect(page.getByTestId('verif-aviso')).toContainText(
      'Retiró su solicitud a Seguros Andina',
    );

    // Recarga completa: lo que se ve sale de lo guardado.
    await page.reload();
    await esperarAplicacionLista(page);
    // La pestaña va en la URL (`?tab=requests`): la recarga vuelve a la bandeja.
    await expect(page.getByTestId('verif-bandeja')).toBeVisible({ timeout: 30_000 });
    await hilo.click();
    await expect(page.getByTestId('verif-hilo-abierto')).toContainText('Retiré la solicitud.');
    await expect(page.getByTestId('verif-volver-a-pedir')).toBeVisible();

    // Volver a pedir crea otra solicitud: el retiro queda en la conversación.
    await page.getByTestId('verif-volver-a-pedir').click();
    await expect(page.getByTestId('verif-aviso')).toContainText('Volvimos a enviar');
    await page.reload();
    await esperarAplicacionLista(page);
    await hilo.click();
    const abierto = page.getByTestId('verif-hilo-abierto');
    await expect(abierto).toContainText('Retiré la solicitud.', { timeout: 30_000 });
    await expect(abierto).toContainText('Esperando que Seguros Andina');
    await expect(abierto.getByTestId('verif-mensaje-me')).toHaveCount(3);
    await capturar(page, `${EVIDENCIA}/retirar-y-volver-a-pedir-1440.png`);

    expect(errores()).toEqual([]);
  });
});

test.describe('la aseguradora decide y el médico lo ve', () => {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    test(`la bandeja de la aseguradora a ${vp.nombre} px: entra por su panel, centrada y sin desborde`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.ancho, height: vp.alto });
      const errores = juntarErrores(page);
      await entrar(page, ASEGURADORA);
      await irA(page, '/dashboard');
      // La puerta real: la franja del panel, debajo del saludo.
      await page.getByTestId('panel-profesionales-que-piden').getByRole('link').click();
      await expect(page.getByTestId('aseguradora-grupo-por-decidir')).toBeVisible({
        timeout: 30_000,
      });
      const tarjeta = await medirTarjeta(page, '.pedidos__tarjeta');
      expect(Math.abs(tarjeta.holguraIzquierda - tarjeta.holguraDerecha)).toBeLessThanOrEqual(2);
      expect(tarjeta.proporcion).toBeGreaterThanOrEqual(0.85);
      expect(await desbordaHorizontal(page)).toBe(false);
      await capturar(page, `${EVIDENCIA}/aseguradora-bandeja-${vp.nombre}.png`);
      expect(errores()).toEqual([]);
    });
  }

  test('rechazar con motivo llega a la conversación del médico, y volver a pedir no lo borra', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    const errores = juntarErrores(page);
    await entrar(page, ASEGURADORA);
    await irA(page, '/administration/insurer-practitioner-requests');
    const porDecidir = page.getByTestId('aseguradora-grupo-por-decidir');
    // La médica demo: su solicitud pendiente a Seguros Andina.
    const fila = porDecidir.locator('li').filter({ hasText: 'Valeria Rojas' }).first();
    await expect(fila).toBeVisible({ timeout: 30_000 });

    await fila.getByTestId('aseguradora-rechazar').click();
    await fila
      .getByTestId('aseguradora-motivo')
      .locator('textarea')
      .fill('Sin convenio vigente en su ciudad');
    await capturar(page, `${EVIDENCIA}/aseguradora-motivo-1440.png`);
    await fila.getByTestId('aseguradora-confirmar-rechazo').click();
    await expect(page.getByTestId('aseguradora-pedidos-aviso')).toContainText('Se rechazó');

    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('aseguradora-grupo-decididas')).toContainText(
      '«Sin convenio vigente en su ciudad»',
      { timeout: 30_000 },
    );
    await capturar(page, `${EVIDENCIA}/aseguradora-decidida-1440.png`);

    // El médico, en la misma pestaña: el simulador guarda en sessionStorage.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await entrar(page, MEDICA);
    await irA(page, '/my-account/verifications?tab=requests');
    const hilo = page.getByTestId('verif-bandeja').getByRole('button', { name: /Seguros Andina/ });
    await hilo.click();
    const abierto = page.getByTestId('verif-hilo-abierto');
    await expect(abierto).toContainText('«Sin convenio vigente en su ciudad»', { timeout: 30_000 });
    await expect(abierto).toContainText('no aceptó la solicitud');
    await capturar(page, `${EVIDENCIA}/medico-hilo-rechazado-1440.png`);

    await page.getByTestId('verif-volver-a-pedir').click();
    await expect(page.getByTestId('verif-aviso')).toContainText('Volvimos a enviar');
    await page.reload();
    await esperarAplicacionLista(page);
    await hilo.click();
    await expect(abierto).toContainText('«Sin convenio vigente en su ciudad»', { timeout: 30_000 });
    await expect(abierto).toContainText('Esperando que Seguros Andina');
    await capturar(page, `${EVIDENCIA}/medico-hilo-historia-1440.png`);

    expect(errores()).toEqual([]);
  });
});

test.describe('el alta de médico', () => {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    test(`elige instituciones con su sello y seguros a ${vp.nombre} px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.ancho, height: vp.alto });
      const errores = juntarErrores(page);

      // Se entra a la página nueva retomando un borrador, la función real del
      // alta: llenar a mano las cinco anteriores (con el mapa) no prueba nada de
      // lo que se cambió acá.
      await page.goto('/auth/register/practitioner');
      await esperarAplicacionLista(page);
      await page.evaluate(() => {
        localStorage.setItem(
          'alovida.onboarding.draft.practitioner',
          JSON.stringify({
            draftId: 'evidencia',
            formType: 'practitioner',
            stepIndex: 5,
            stepKey: 'workplaces',
            stepTitle: 'Dónde trabaja y con qué seguros',
            data: {},
            extraData: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            percentComplete: 60,
          }),
        );
      });
      await page.reload();
      await esperarAplicacionLista(page);
      await page.getByTestId('onboarding-draft-resume').click();
      await expect(page.getByTestId('registro-pro-lugares')).toBeVisible({ timeout: 30_000 });

      // Instituciones: buscar, elegir y ver los DOS sellos.
      const buscador = page.getByTestId('registro-pro-instituciones-buscar').locator('input');
      await buscador.fill('Clín');
      const opcion = page.getByRole('option').first();
      await expect(opcion).toBeVisible({ timeout: 15_000 });
      await opcion.click();
      const elegida = page.locator('[data-testid^="registro-pro-institucion-"]').first();
      await expect(elegida).toContainText(/Institución (verificada|sin verificar)/);
      await expect(elegida).toContainText('Su vínculo: sin confirmar todavía');

      // Seguros: del catálogo público.
      const seguros = page.getByTestId('registro-pro-seguros');
      await expect(seguros).toBeVisible();
      await seguros.getByText('La Vitalicia').click();
      await expect(seguros.getByRole('checkbox', { name: 'La Vitalicia' })).toBeChecked();
      // Elegida la institución, el buscador queda vacío para la siguiente.
      await expect(buscador).toHaveValue('');

      expect(await desbordaHorizontal(page)).toBe(false);
      await capturar(page, `${EVIDENCIA}/alta-lugares-${vp.nombre}.png`);
      expect(errores()).toEqual([]);
    });
  }
});
