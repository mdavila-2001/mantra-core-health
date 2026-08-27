import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, crearPaciente, urlDeApi } from './support/actores';
import { accesoDeRevisor, aprobarIdentidad } from './support/identidad';
import { entrar, esperarAplicacionLista, estable, irA } from './support/sesion';

/**
 * IT-1 (F-34) — **el perfil del paciente no depende de verificarse**.
 *
 * ## Lo que este carril viene a demostrar
 *
 * Hasta F-34, «Mi perfil» de un paciente recién registrado era una tarjeta
 * vacía: «Tus datos aparecen acá cuando tu identidad esté verificada». El gate
 * estaba en el endpoint del resumen propio, que respondía `403`. Ahora responde
 * `200` siempre y lo único que la verificación gobierna es el **código de
 * paciente**, que viaja sólo con aserción vigente.
 *
 * Así que hay dos recorridos, y los dos son de la misma persona:
 *
 * 1. **Recién registrada**: ve su nombre, su nacimiento y su estado, y donde
 *    iría el código lee «Pendiente de verificación» con la invitación al
 *    trámite. Sin muro y sin código inventado.
 * 2. **Verificada**: el mismo perfil, con el código y sin invitación.
 *
 * ## Contra qué API corre
 *
 * El segundo recorrido necesita aprobar la identidad por API, que es el único
 * camino que existe (`playwright/support/identidad.ts`, portado del recorrido
 * real `08` de Cypress), y eso exige una cuenta con permisos de revisión: sin
 * sus credenciales en el entorno el tramo **se saltea con el motivo literal**,
 * nunca se da por bueno.
 *
 * El primero **falla contra una API anterior a F-34**: ahí el resumen todavía
 * responde `403` y la pantalla pinta —con razón— la tarjeta neutra de
 * compatibilidad. Ese fallo es información, no un motivo para bajar la
 * aserción.
 *
 * Las capturas van a `artifacts/playwright/it1/`, o a donde diga `E2E_SHOTS`.
 */

const CAPTURAS = process.env['E2E_SHOTS'] ?? join('artifacts', 'playwright', 'it1');

/** El texto exacto de la invitación del pie de la tarjeta. */
const INVITACION = 'Verificá tu identidad para ver tu código de paciente';

/** El copy de la tarjeta vacía de antes: si aparece, el muro sigue en pie. */
const TARJETA_VACIA = 'cuando tu identidad esté verificada';

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  test.skip(
    !(await apiViva(api)),
    `La API E2E no responde en ${urlDeApi()}: este carril necesita backend vivo.`,
  );
  mkdirSync(CAPTURAS, { recursive: true });
});

test.afterAll(async () => {
  await api.dispose();
});

/** Abre «Mi perfil» por el router y espera a que termine de leer. */
async function irAMiPerfil(page: Page): Promise<void> {
  await irA(page, '/my-account');
  await estable(page);
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible();
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** El `<dd>` de la fila «Código de paciente»: lo único que cambia entre los dos estados. */
function filaDelCodigo(page: Page): Locator {
  return page.getByTestId('mi-perfil-codigo');
}

test.describe('IT-1 · «Mi perfil» del paciente, con y sin identidad verificada', () => {
  test('recién registrada ve sus datos; el código queda pendiente, con invitación', async ({
    page,
  }) => {
    const paciente = await crearPaciente(api);
    await entrar(page, paciente);
    await irAMiPerfil(page);
    await capturar(page, '01-sin-verificar');

    // 1 · Sus datos están. El nombre lo **compone el backend** a partir de las
    // cuatro partes del alta, así que se afirman las dos que ninguna
    // composición razonable descarta en vez de la cadena entera.
    const [nombreDePila = '', , apellidoPaterno = ''] = paciente.nombre.split(' ');
    const tarjeta = page.locator('.mi-perfil__principal');
    await expect(tarjeta).toContainText(nombreDePila);
    await expect(tarjeta).toContainText(apellidoPaterno);

    // 2 · El código no llegó, y la pantalla lo dice en palabras en vez de
    // inventarlo o de tapar el resto de la tarjeta.
    await expect(filaDelCodigo(page)).toHaveText('Pendiente de verificación');

    // 3 · La invitación es un enlace real al trámite, no una alerta.
    const invitacion = page.getByRole('link', { name: INVITACION });
    await expect(invitacion).toBeVisible();
    await expect(invitacion).toHaveAttribute('href', '/my-account/identity/verify');

    // 4 · El muro de antes ya no está.
    await expect(page.getByText(TARJETA_VACIA)).toHaveCount(0);

    // 5 · Ni un identificador interno a la vista, acá tampoco.
    const cuerpo = (await page.locator('main').first().textContent()) ?? '';
    expect(cuerpo).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  test('una vez verificada, la misma persona ve su código y ya no la invitan', async ({ page }) => {
    // Aprobar una identidad exige una cuenta con permisos de revisión, y esas
    // credenciales las declara el entorno. Sin ellas el tramo **no se puede
    // ejecutar**: se saltea con el motivo literal que devolvió la API, que es
    // lo contrario de darlo por bueno. Se comprueba antes de crear nada.
    const revisor = administrador();
    const acceso = await accesoDeRevisor(api, revisor);
    if (!('token' in acceso)) {
      test.skip(
        true,
        `${acceso.motivo} · Este tramo necesita una cuenta con permisos de revisión de ` +
          'identidad: exportá E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD de este entorno.',
      );
      return;
    }

    // Se registra una titular propia: la del caso anterior podría venir de una
    // corrida interrumpida, y el backend admite **una sola verificación en
    // curso por sujeto** (409 al abrir la segunda).
    const titular = await crearPaciente(api);
    await aprobarIdentidad(api, titular, acceso.token);

    await entrar(page, titular);
    await irAMiPerfil(page);

    // La pantalla ya estaba montada cuando se aprobó: se recarga para que
    // vuelva a leer el resumen, que es lo que hace una persona al volver.
    await page.reload();
    await esperarAplicacionLista(page);
    await estable(page);
    await capturar(page, '02-verificado');

    // El código es lo único que cambia: presente, y sin nada pendiente.
    const codigo = filaDelCodigo(page);
    await expect(codigo).toBeVisible();
    await expect(codigo).not.toHaveText('Pendiente de verificación');
    expect((await codigo.textContent())?.trim()).not.toBe('');

    await expect(page.getByRole('link', { name: INVITACION })).toHaveCount(0);
    await expect(page.getByText(TARJETA_VACIA)).toHaveCount(0);
  });
});
