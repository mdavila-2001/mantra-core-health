import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, crearPaciente, urlDeApi } from './support/actores';
import { accesoDeRevisor, aprobarIdentidad, tokenDe } from './support/identidad';
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
 * Así que hay tres recorridos, y los tres son de la misma persona:
 *
 * 1. **Recién registrada**: ve su nombre, su nacimiento y su estado, y donde
 *    iría el código lee «Pendiente de verificación» con la invitación al
 *    trámite. Sin muro y sin código inventado.
 * 2. **Verificada**: el mismo perfil, con el código y sin invitación.
 * 3. **Corrigiendo lo suyo**: entra a «Editar tus datos», cambia nombre,
 *    teléfono y nacimiento, y vuelve a «Mi perfil» a verlos. Se comprueba en la
 *    pantalla **y** contra la API, porque una pantalla que muestra lo que
 *    escribió la persona sin haberlo guardado se ve exactamente igual.
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

/* Los valores con los que se corrige el alta en el tramo (c). El nombre no
   comparte prefijo con el que siembra `crearPaciente` («Ana»), para que
   afirmar el nuevo no pueda pasar por casualidad con el viejo puesto. */
const NOMBRE_NUEVO = 'Valentina';
const TELEFONO_NUEVO = '+591 71234567';
const NACIMIENTO_NUEVO_VISIBLE = '02/11/1990';
const NACIMIENTO_NUEVO_ISO = '1990-11-02';

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

    // La captura va al final, con la tarjeta ya pintada: antes de las
    // aserciones la pantalla todavía puede estar en su esqueleto de carga.
    await capturar(page, '01-sin-verificar');
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

    // El código es lo único que cambia: presente, y sin nada pendiente.
    const codigo = filaDelCodigo(page);
    await expect(codigo).toBeVisible();
    await expect(codigo).not.toHaveText('Pendiente de verificación');
    expect((await codigo.textContent())?.trim()).not.toBe('');

    await expect(page.getByRole('link', { name: INVITACION })).toHaveCount(0);
    await expect(page.getByText(TARJETA_VACIA)).toHaveCount(0);

    // Igual que arriba: se retrata el perfil ya resuelto, no su esqueleto.
    await capturar(page, '02-verificado');
  });

  /**
   * El tramo (c): corregir lo que se declaró al registrarse.
   *
   * El alta escribía estos datos una vez y no había forma de volver a tocarlos.
   * Acá se comprueban las dos mitades del arreglo: que la pantalla los guarde
   * —y lo diga— y que el backend los tenga de verdad. La segunda no es
   * redundante: un formulario que conserva en memoria lo que la persona
   * escribió se ve idéntico a uno que guardó.
   */
  test('edita sus datos y los ve corregidos al volver a «Mi perfil»', async ({ page }) => {
    const paciente = await crearPaciente(api);
    await entrar(page, paciente);
    await irAMiPerfil(page);

    // 1 · La salida está donde la persona ya estaba mirando sus datos.
    await page.getByTestId('mi-perfil-editar').click();
    await expect(page.getByRole('heading', { name: 'Editar tus datos' })).toBeVisible();
    await estable(page);

    // 2 · Se corrigen tres campos de naturaleza distinta a propósito: un texto,
    // un texto con formato validado y una fecha, que es la que más viajes de
    // ida y vuelta tiene entre la pantalla y el contrato.
    await page.getByTestId('perfil-nombre').fill(NOMBRE_NUEVO);
    await page.getByTestId('perfil-telefono').fill(TELEFONO_NUEVO);
    // La fecha se teclea dígito a dígito, como lo hace quien ya sabe la suya, y
    // la máscara pone las barras. No sirve `fill`: el alta de `crearPaciente`
    // no manda fecha, el campo llega vacío, y al enfocarlo la máscara escribe
    // la plantilla `DD/MM/AAAA` como valor; un `fill` inserta el texto delante
    // de ella y el campo queda inválido. Por eso primero se borra la plantilla.
    const campoDeFecha = page.getByLabel('Fecha de nacimiento');
    await campoDeFecha.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await campoDeFecha.pressSequentially(NACIMIENTO_NUEVO_VISIBLE.replace(/\//g, ''), {
      delay: 40,
    });
    await campoDeFecha.blur();

    await expect(page.getByTestId('perfil-nombre')).toHaveValue(NOMBRE_NUEVO);
    await expect(campoDeFecha).toHaveValue(NACIMIENTO_NUEVO_VISIBLE);

    // La captura del formulario va acá, con los tres campos ya escritos.
    await capturar(page, '11-editar-form');

    // 3 · Guardar lo dice con palabras, no con un cambio silencioso.
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByTestId('toast-mensaje')).toHaveText(
      'Tus datos quedaron actualizados.',
    );

    // 4 · Y quedaron: al volver, «Mi perfil» los muestra.
    await irAMiPerfil(page);
    const tarjeta = page.locator('.mi-perfil__principal');
    await expect(tarjeta).toContainText(NOMBRE_NUEVO);
    await expect(tarjeta).toContainText(NACIMIENTO_NUEVO_VISIBLE);

    // 5 · La prueba de que se guardaron de verdad: la API los devuelve. Sin
    // esto, un formulario que sólo recuerda lo tecleado pasaría igual.
    const token = await tokenDe(api, paciente);
    const respuesta = await api.get('/profiles/patients/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(respuesta.status(), await respuesta.text()).toBe(200);
    const guardado = (await respuesta.json()) as {
      name?: string;
      phone?: string;
      birthDate?: string;
    };
    expect(guardado.name).toBe(NOMBRE_NUEVO);
    expect(guardado.phone).toBe(TELEFONO_NUEVO);
    // La fecha vuelve serializada como instante aunque el contrato la declare
    // `format: 'date'`: lo que se afirma es el día, que es el dato.
    expect(guardado.birthDate?.slice(0, 10)).toBe(NACIMIENTO_NUEVO_ISO);

    await capturar(page, '12-editado-mi-perfil');
  });
});
