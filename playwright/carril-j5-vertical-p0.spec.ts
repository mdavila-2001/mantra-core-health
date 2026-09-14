import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, type Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril J5 — la vertical P0, de punta a punta y sobre el `dev` integrado.
 *
 * ## Qué convierte esto en evidencia
 *
 * Cada tramo de la escalera se probó por separado, en su rama y contra su base.
 * «Siete de ocho peldaños funcionan» sale de leer PR por PR, no de recorrerla:
 * hasta que alguien la camina entera con un doctor y un paciente **recién
 * registrados**, «funciona» es una inferencia. Esto la camina.
 *
 * ## Por qué por el navegador y no por la API
 *
 * Porque la API respondiendo bien no alcanza. El PR #137 encontró **39 llamadas
 * que volvían HTML** por prefijos que faltaban en el proxy: la API estaba sana,
 * el front pedía mal, y ninguna prueba lo veía porque ninguna pasaba por el
 * proxy. Este recorrido va por donde va una persona.
 *
 * ## Lo que se monta por API, y por qué no es trampa
 *
 * El alta del doctor y la publicación de su agenda son cinco formularios que ya
 * tienen sus propias pruebas. Montarlos por API deja la prueba **autosuficiente**
 * —no depende de datos sembrados— sin volver a medir lo que ya está medido. Lo
 * que se afirma por pantalla es lo que le toca al paciente, que es donde vive el
 * valor de este carril.
 *
 * ## Un solo ingreso por rol
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP (H-08). Cada prueba
 * entra una vez y navega por el router.
 */

/** Un uuid suelto en pantalla: nada de lo que el paciente ve puede tener uno. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Códigos internos del catálogo que tampoco puede leer.
 *
 * No es una lista de estilo: son los que ya se colaron alguna vez —el estado de
 * la reserva llega como `BOOKING_CONFIRMED` y la pantalla lo traduce—, así que
 * verlos significa que la traducción no ocurrió.
 */
const CODIGOS_INTERNOS = /\b(BOOKING_|IDA_|PRACT_|EV_|STATE_)[A-Z_]+\b/;

const MI_SALUD = '/my-account';
const MIS_TURNOS = '/my-account/appointments';
const MI_HISTORIA = '/my-account/medical-record';

/** El texto visible de la pantalla, sin marcado. */
async function textoDe(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).trim();
}

/**
 * Da de alta un profesional con agenda publicada y cupos.
 *
 * Devuelve cómo entrar y con qué nombre aparece, que es lo que el paciente
 * tiene que poder encontrar.
 */
async function crearDoctoraConAgenda(
  api: APIRequestContext,
): Promise<{ actor: Actor; nombre: string }> {
  const sufijo = String(Date.now()).slice(-9);
  const email = `doctora-j5-${sufijo}@example.test`;
  const clave = 'S3cret-passw0rd';
  const nombre = `Dra. Vertical ${sufijo}`;

  const alta = await api.post('/iam/auth/register-practitioner', {
    data: {
      email,
      password: clave,
      displayName: nombre,
      licenseNumber: `MP-J5-${sufijo}`,
      credentialNumber: `TIT-J5-${sufijo}`,
      professionalTitle: 'Dra.',
    },
  });
  if (!alta.ok()) {
    throw new Error(`register-practitioner respondió ${alta.status()}: ${await alta.text()}`);
  }
  const { practitionerProfileId } = (await alta.json()) as { practitionerProfileId: string };

  const sesion = await api.post('/iam/auth/login', { data: { email, password: clave } });
  const { accessToken } = (await sesion.json()) as { accessToken: string };
  const auth = { Authorization: `Bearer ${accessToken}` };
  const tenantId = tenantDelToken(accessToken);

  // Recurso → plantilla → cupos: las tres escrituras que el autoservicio abrió
  // al profesional (`@Roles('SCHEDULING_ADMIN', 'PRACTITIONER')`).
  const recurso = await api.post('/scheduling/resources', {
    headers: auth,
    data: {
      tenantId,
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: practitionerProfileId,
      name: `Agenda ${nombre}`,
    },
  });
  const { id: resourceId } = (await recurso.json()) as { id: string };

  const plantilla = await api.post(`/scheduling/resources/${resourceId}/templates`, {
    headers: auth,
    data: {
      name: 'Horario base',
      rules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
        slotMinutes: 30,
        capacityPerSlot: 1,
      })),
      slotMinutes: 30,
    },
  });
  const { id: templateId } = (await plantilla.json()) as { id: string };

  const desde = new Date();
  desde.setDate(desde.getDate() + 1);
  const hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 14);
  await api.post(`/scheduling/templates/${templateId}/generate-slots`, {
    headers: auth,
    data: { from: desde.toISOString(), to: hasta.toISOString() },
  });

  return {
    actor: { rol: 'doctora', identificador: email, clave, nombre },
    nombre,
  };
}

/** El primer tenant del token, que es con el que se publica la agenda. */
function tenantDelToken(token: string): string {
  const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as { tenants?: string[] };
  const [primero] = cuerpo.length > 0 ? (json.tenants ?? []) : [];
  if (primero === undefined) {
    throw new Error('El token del profesional no declara ninguna organización.');
  }
  return primero;
}

test.describe('Carril J5 · la vertical P0 de punta a punta', () => {
  let paciente: Actor;
  let doctora: { actor: Actor; nombre: string };

  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    if (!viva) {
      await api.dispose();
      test.skip(true, 'La API no responde: la vertical no tiene de dónde salir.');
      return;
    }
    paciente = await crearPaciente(api);
    doctora = await crearDoctoraConAgenda(api);
    await api.dispose();
  });

  /**
   * Peldaños 2 y 3 — que un doctor recién registrado sea encontrable, y que se
   * le pueda pedir turno. Es el «médico invisible» mirado desde el paciente.
   */
  test('el paciente encuentra a la doctora nueva y le pide turno', async ({ page }) => {
    await entrar(page, paciente);

    await test.step('la doctora recién publicada aparece en el buscador', async () => {
      // Pedir turno es una sección propia del portal, no el fondo de la lista
      // de citas propias: se entra directo con la sección puesta.
      await irA(page, `${MIS_TURNOS}?seccion=pedir`);
      await estable(page);

      // El selector de profesional es un buscador desde J4: se escribe parte
      // del nombre en vez de recorrer la lista.
      const buscador = page.locator('app-reference-combobox input').first();
      await buscador.click();
      await buscador.fill(doctora.nombre.split(' ').slice(-1)[0]);
      await estable(page);

      await expect(page.getByText(doctora.nombre, { exact: false }).first()).toBeVisible();
    });

    await test.step('elige a la doctora y ve sus horarios libres', async () => {
      await page.getByText(doctora.nombre, { exact: false }).first().click();
      await estable(page);

      await expect(page.locator('.turnos__horario').first()).toBeVisible();
    });

    await test.step('pide el primer horario, con su motivo', async () => {
      await page.getByRole('link', { name: /pedir este horario/i }).first().click();
      await estable(page);

      // El resumen de la reserva dice con quién es el turno (F-07 de J4).
      await expect(page.getByTestId('reserva-profesional')).toContainText(doctora.nombre);

      await page.locator('app-textarea textarea').first().fill('Dolor de garganta hace tres días');
      await page.getByRole('button', { name: /retener el cupo/i }).click();
      await estable(page);

      await page.getByRole('button', { name: /confirmar la reserva/i }).click();
      await estable(page);
    });

    await test.step('el turno queda en su lista', async () => {
      await irA(page, MIS_TURNOS);
      await estable(page);

      await expect(page.locator('.turnos__item').first()).toBeVisible();
    });
  });

  /**
   * Peldaño 5 — el archivo del paciente. Es lo que D-3 destrabó: hasta que se
   * arregló, esta pantalla respondía 403 a su propio titular, siempre.
   */
  test('el paciente entra a lo suyo y su historia le abre', async ({ page }) => {
    await entrar(page, paciente);

    await test.step('«Mi salud» es su panel, no el del administrador', async () => {
      await irA(page, MI_SALUD);
      await estable(page);

      const texto = await textoDe(page);
      expect(texto).toContain('Tus turnos, tus recetas y tu historia');
      expect(texto.toLowerCase()).not.toContain('secciones disponibles');
      expect(texto.toLowerCase()).not.toContain('estado del sistema');
    });

    await test.step('su historia responde, no la rechaza (D-3)', async () => {
      await irA(page, MI_HISTORIA);
      await estable(page);

      const texto = await textoDe(page);
      // El 403 se veía como este aviso: si vuelve, el peldaño se cae acá.
      expect(texto.toLowerCase()).not.toContain('sólo podés consultar tu propia historia');
      expect(texto.toLowerCase()).not.toContain('no tenés permiso');
    });
  });

  /**
   * Peldaño 7 — la regla de la analista: en la vista del paciente no puede
   * asomar ni un uuid ni un código del catálogo. Se comprueba sobre las tres
   * pantallas suyas, que es donde miraría ella.
   */
  test('nada de lo que ve el paciente muestra identificadores ni códigos internos', async ({
    page,
  }) => {
    await entrar(page, paciente);

    for (const ruta of [MI_SALUD, MIS_TURNOS, MI_HISTORIA]) {
      await test.step(`sin jerga interna en ${ruta}`, async () => {
        await irA(page, ruta);
        await estable(page);

        const texto = await textoDe(page);
        expect(texto, `${ruta} muestra un uuid`).not.toMatch(UUID);
        expect(texto, `${ruta} muestra un código del catálogo`).not.toMatch(CODIGOS_INTERNOS);
      });
    }
  });

  /**
   * Peldaño 6 — el aviso «tu receta está lista» (carril P1 de Pablo).
   *
   * Se declara **esperado que falle** a propósito: mientras P1 no mergee no hay
   * campana que mirar, y anotarlo así deja el hueco a la vista sin ensuciar la
   * corrida. El día que P1 entre, Playwright avisa que «pasó cuando se esperaba
   * que fallara» — que es la señal para quitar esta anotación.
   */
  test('el paciente recibe el aviso de que su receta está lista (P1)', async ({ page }) => {
    test.fail(true, 'P1 (notificaciones in-app) todavía no mergea.');

    await entrar(page, paciente);
    await irA(page, MI_SALUD);
    await estable(page);

    await expect(page.getByTestId('campana-notificaciones')).toBeVisible();
  });
});
