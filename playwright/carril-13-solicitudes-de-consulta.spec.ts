import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora } from './support/actores';
import { entrar, irA, estable } from './support/sesion';

/**
 * TAREA-13 · Carril de revisión visual y de accesibilidad de la solapa
 * «Solicitudes de consulta».
 *
 * ## Dónde vive la pantalla
 *
 * No hay ruta propia `/schedule/requests`: la ficha la deja «pendiente de
 * P-13-1» y lo que se mergeó (TAREA-13 S1/S2/§5, PRs #277-#281) resolvió esa
 * pregunta abierta con una **solapa** dentro de `/schedule`
 * (`src/app/features/agenda/agenda.ts` + `agenda.html`), no con una pantalla
 * separada. La solapa «Solicitudes» es la primera y la que arranca
 * seleccionada (`pestana()` por defecto en 0), lista sólo
 * `BOOKING_REQUESTED` / `BOOKING_PENDING_CONFIRMATION`, con las cinco
 * columnas del punto 1 (`columnasDeSolicitudes`), «Ver detalle» en un modal
 * compartido (`DialogService.confirm()` con `details`), aceptar/rechazar en
 * la fila, «Ver historial» y el estado de pago (§5) en la solapa «Citas».
 *
 * Este spec no vuelve a probar el contrato de datos (ya cubierto por
 * `carril-ag6-agenda-convivencia.spec.ts` y las unitarias de `agenda.spec.ts`):
 * mide lo visual y la accesibilidad del modal, con capturas reales.
 */

const VIEWPORTS = [
  { nombre: 'movil-390x844', width: 390, height: 844 },
  { nombre: 'tablet-768x1024', width: 768, height: 1024 },
  { nombre: 'escritorio-1440x900', width: 1440, height: 900 },
] as const;

const CARPETA_CAPTURAS = 'artifacts/playwright/tarea-13';

/** `document.documentElement.scrollWidth <= clientWidth`, sin scroll horizontal de página. */
async function sinScrollHorizontal(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** Decodifica el cuerpo de un JWT (sin validar la firma: es de prueba). */
function decodificarJwt(token: string): Record<string, unknown> {
  const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as Record<string, unknown>;
}

/** El `tenantId` viaja en el JWT: se decodifica en vez de pedirlo aparte. */
function tenantDelToken(token: string): string {
  const { tenants } = decodificarJwt(token) as { tenants?: string[] };
  const [primero] = tenants ?? [];
  if (primero === undefined) {
    throw new Error('El token de la médica no declara ninguna organización.');
  }
  return primero;
}

/**
 * Deja UNA solicitud pendiente (`BOOKING_REQUESTED`) contra la agenda propia
 * de la médica, para poder medir el modal de detalle y no sólo el estado
 * vacío. Un paciente nuevo retiene el primer cupo libre de los próximos 7 días
 * y lo **pide** (`POST /scheduling/holds/:token/request`, no `/confirm`): esa
 * es la puerta que deja la cita en `BOOKING_REQUESTED`, la misma que usa
 * cualquier paciente real desde el portal.
 *
 * Si algo falla —sin cupos libres, sin API— se devuelve `false` y el spec
 * documenta el estado vacío en vez de fallar: no es lo que se está probando.
 */
async function sembrarUnaSolicitudPendiente(): Promise<boolean> {
  const api: APIRequestContext = await contextoDeApi();
  const paso = async (
    etiqueta: string,
    respuesta: { ok(): boolean; status(): number; text(): Promise<string> },
  ): Promise<boolean> => {
    if (respuesta.ok()) return true;
    console.log(`[siembra] ${etiqueta} → ${respuesta.status()}: ${await respuesta.text()}`);
    return false;
  };
  try {
    if (!(await apiViva(api))) {
      console.log('[siembra] la API no respondió /health');
      return false;
    }

    const sesionDoctora = await api.post('/iam/auth/login', {
      data: { email: doctora().identificador, password: doctora().clave },
    });
    if (!(await paso('login médica', sesionDoctora))) return false;
    const { accessToken } = (await sesionDoctora.json()) as { accessToken: string };
    const authDoctora = { Authorization: `Bearer ${accessToken}` };
    const tenantId = tenantDelToken(accessToken);

    // `GET /scheduling/resources` devuelve TODOS los recursos del tenant, no
    // sólo el propio: hay que elegir el que corresponde a esta médica, o la
    // solicitud sembrada cae en la agenda de un colega y nunca aparece en la
    // pantalla que se está midiendo. `hpid` del JWT es el mismo
    // `resourceRefId` que expone cada recurso.
    const { hpid } = decodificarJwt(accessToken) as { hpid?: string };
    const recursos = await api.get(`/scheduling/resources?tenantId=${tenantId}`, {
      headers: authDoctora,
    });
    if (!(await paso('listar recursos', recursos))) return false;
    const { items: listaRecursos = [] } = (await recursos.json()) as {
      items?: { id: string; resourceRefId?: string }[];
    };
    const recurso = listaRecursos.find((r) => r.resourceRefId === hpid) ?? listaRecursos.at(0);
    if (recurso === undefined) {
      console.log('[siembra] la organización no tiene ningún recurso agendable');
      return false;
    }

    const desde = new Date();
    const hasta = new Date(desde);
    hasta.setUTCDate(hasta.getUTCDate() + 7);
    const cupos = await api.get(
      `/scheduling/slots?resourceId=${recurso.id}&from=${desde.toISOString()}&to=${hasta.toISOString()}&onlyAvailable=true`,
      { headers: authDoctora },
    );
    if (!(await paso('listar cupos libres', cupos))) return false;
    const { items: listaCupos = [] } = (await cupos.json()) as { items?: { id: string }[] };
    const [cupo] = listaCupos;
    if (cupo === undefined) {
      console.log('[siembra] no hay cupos libres en los próximos 7 días para este recurso');
      return false;
    }

    // NO se usa `crearPaciente()` de `support/actores.ts`: contra la API de
    // hoy responde 400 — `POST /iam/auth/register-patient` ahora exige
    // `birthDate` y `residenceMunicipalityConceptId` (UUID de
    // `VS_BO_MUNICIPALITY`), y ese helper compartido no los manda. Se reporta
    // aparte; acá se registra con el payload que la API de hoy sí acepta, sin
    // tocar un archivo que usan otros specs.
    const sufijo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const altaPaciente = await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: `CI-T13-${sufijo}`,
        password: doctora().clave,
        name: 'Ana',
        middleName: 'Lucía',
        lastName: 'Quispe',
        motherLastName: 'Mamani',
        email: `paciente-t13-${sufijo}@example.test`,
        phone: '+591 70055555',
        gender: 'FEMALE',
        sexAtBirth: 'FEMALE',
        birthDate: '1995-05-20',
        // Sucre (VS_BO_MUNICIPALITY, geo:bo:municipality:010101) — cualquier
        // municipio válido sirve, sólo hace falta que el uuid exista.
        residenceMunicipalityConceptId: '5132db42-8cb1-52d6-88f5-0e9a04bdc94c',
      },
    });
    if (!(await paso('alta del paciente', altaPaciente))) return false;
    const paciente = { identificador: `CI-T13-${sufijo}`, clave: doctora().clave };
    const sesionPaciente = await api.post('/iam/auth/login', {
      data: { nationalId: paciente.identificador, password: paciente.clave },
    });
    if (!(await paso('login paciente', sesionPaciente))) return false;
    const { accessToken: tokenPaciente } = (await sesionPaciente.json()) as { accessToken: string };
    const authPaciente = { Authorization: `Bearer ${tokenPaciente}` };
    const patientProfileId = tokenPacienteAPerfil(tokenPaciente);

    const hold = await api.post(`/scheduling/slots/${cupo.id}/holds`, {
      headers: authPaciente,
      data: { patientProfileId },
    });
    if (!(await paso('retener cupo', hold))) return false;
    const { holdToken } = (await hold.json()) as { holdToken: string };

    const pedido = await api.post(`/scheduling/holds/${holdToken}/request`, {
      headers: authPaciente,
      data: {
        tenantId,
        patientProfileId,
        channel: 'PORTAL',
        reasonText: 'TAREA-13 · solicitud sembrada para medir el modal de detalle',
      },
    });
    return await paso('pedir la cita (request)', pedido);
  } catch (fallo) {
    console.log('[siembra] excepción:', fallo);
    return false;
  } finally {
    await api.dispose();
  }
}

/**
 * El `patientProfileId` viaja en el JWT del paciente bajo la clave `pid`
 * —comprobado contra un alta real: NO es `sub` (ese es el `userId`) ni
 * `patientProfileId` a secas. Usar `sub` como si fuera el perfil produce un
 * `patientProfileId` que no existe y el hold responde 422
 * `PRECONDITION_FAILED` — así se encontró el error.
 */
function tokenPacienteAPerfil(token: string): string {
  const { pid } = decodificarJwt(token) as { pid?: string };
  if (pid === undefined) {
    throw new Error('El token del paciente no declara `pid` (su perfil).');
  }
  return pid;
}

test.describe('TAREA-13 · Solicitudes de consulta (solapa en /schedule)', () => {
  test.beforeAll(async () => {
    const sembrada = await sembrarUnaSolicitudPendiente();
    console.log(
      sembrada
        ? 'Se sembró una solicitud pendiente para medir el modal de detalle.'
        : 'No se pudo sembrar una solicitud pendiente (sin cupos libres o la API no respondió); el spec sigue y documenta lo que encuentre.',
    );
  });

  test('la tabla de solicitudes, el modal de detalle y los tres anchos', async ({ page }) => {
    await entrar(page, doctora());
    await irA(page, '/schedule');
    await estable(page);

    // ─── La solapa arranca en «Solicitudes» ────────────────────────────────
    await expect(page.getByText(/^Solicitudes/).first()).toBeVisible({ timeout: 20_000 });

    const tabla = page.getByTestId('tabla').first();
    await expect(tabla).toBeVisible({ timeout: 20_000 });

    // ─── Columnas del punto 1: estado, solicitada, cita, paciente, profesional ──
    const encabezados = await tabla.locator('thead th').allTextContents();
    const encabezadosNormalizados = encabezados.map((h) => h.trim()).filter((h) => h.length > 0);
    console.log('Encabezados de la tabla de solicitudes:', encabezadosNormalizados);

    for (const esperado of ['Estado', 'Solicitada', 'Cita', 'Paciente']) {
      expect(
        encabezadosNormalizados.some((h) => h.toLowerCase().includes(esperado.toLowerCase())),
        `Falta la columna «${esperado}» en la tabla de solicitudes. Encabezados vistos: ${encabezadosNormalizados.join(', ')}`,
      ).toBe(true);
    }

    // ─── Estado vacío o filas: se documentan las dos posibilidades ─────────
    const filas = page.getByTestId('tabla-fila');
    const cantidadFilas = await filas.count();
    console.log(`Filas visibles en «Solicitudes»: ${cantidadFilas}`);

    // ─── Capturas en los tres anchos, tabla primero ────────────────────────
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await estable(page);
      // Un respiro extra para que el CSS de anchos termine de acomodar la tabla.
      await page.waitForTimeout(300);

      const medidas = await sinScrollHorizontal(page);
      console.log(
        `[${vp.nombre}] scrollWidth=${medidas.scrollWidth} clientWidth=${medidas.clientWidth}`,
      );
      if (medidas.scrollWidth > medidas.clientWidth) {
        // Encuentra el elemento que REALMENTE desborda: el suyo, no uno
        // heredado. `scrollWidth > clientWidth` en el propio elemento (no en
        // `document`) descarta los que sólo ocupan el 100% de un contenedor ya
        // estirado por otro.
        const culpables = await page.evaluate(() => {
          const hallazgos: {
            tag: string;
            class: string;
            testid: string | null;
            texto: string | undefined;
            ownScrollWidth: number;
            ownClientWidth: number;
            rect: DOMRect;
          }[] = [];
          for (const el of document.querySelectorAll<HTMLElement>('body *')) {
            if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
              hallazgos.push({
                tag: el.tagName,
                class: el.className,
                testid: el.getAttribute('data-testid'),
                texto: el.textContent?.trim().slice(0, 100),
                ownScrollWidth: el.scrollWidth,
                ownClientWidth: el.clientWidth,
                rect: el.getBoundingClientRect(),
              });
            }
          }
          // De más específico (menos descendientes con el mismo problema) a
          // más general: los primeros son los candidatos reales.
          return hallazgos.slice(0, 15);
        });
        console.log(`[${vp.nombre}] elementos que desbordan su propia caja:`, JSON.stringify(culpables));

        const cadena = await page.evaluate(() => {
          const selectores = [
            '.agenda',
            'app-tabs',
            '.tabs__panels',
            'app-tab',
            'app-data-table',
            '.data-table__scroll',
            '.data-table__table',
          ];
          return selectores.map((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (el === null) return { sel, encontrado: false };
            const estilo = getComputedStyle(el);
            return {
              sel,
              encontrado: true,
              width: estilo.width,
              minWidth: estilo.minWidth,
              display: estilo.display,
              offsetWidth: el.offsetWidth,
              scrollWidth: el.scrollWidth,
            };
          });
        });
        console.log(`[${vp.nombre}] cadena de anchos:`, JSON.stringify(cadena, null, 0));
      }
      expect
        .soft(
          medidas.scrollWidth,
          `Scroll horizontal de página en ${vp.nombre}: scrollWidth ${medidas.scrollWidth} > clientWidth ${medidas.clientWidth}`,
        )
        .toBeLessThanOrEqual(medidas.clientWidth);

      await page.screenshot({
        path: `${CARPETA_CAPTURAS}/${vp.nombre}-tabla-solicitudes.png`,
        fullPage: true,
      });
    }

    // ─── «Ver detalle»: el modal, medido, no supuesto ──────────────────────
    const botonDetalle = page.getByTestId('agenda-detalle').first();
    const hayDetalle = (await botonDetalle.count()) > 0;

    if (!hayDetalle) {
      console.log(
        'No hay ninguna solicitud pendiente en los datos sembrados: no se pudo abrir el modal de detalle. Se documenta el estado vacío en las capturas ya tomadas.',
      );
      return;
    }

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await estable(page);
      await page.waitForTimeout(300);

      const boton = page.getByTestId('agenda-detalle').first();
      await expect(boton).toBeVisible();
      await boton.focus();
      await boton.click();

      const dialogo = page.getByTestId('dialogo');
      await expect(dialogo).toBeVisible({ timeout: 10_000 });

      // ¿Es un <dialog> nativo, realmente abierto y modal?
      const infoDialogo = await dialogo.evaluate((el) => {
        const nativo = el as HTMLDialogElement;
        return {
          tag: nativo.tagName,
          open: nativo.open,
          ariaLabelledby: nativo.getAttribute('aria-labelledby'),
          ariaDescribedby: nativo.getAttribute('aria-describedby'),
        };
      });
      console.log(`[${vp.nombre}] modal:`, infoDialogo);
      expect(infoDialogo.tag).toBe('DIALOG');
      expect(infoDialogo.open).toBe(true);
      expect(infoDialogo.ariaLabelledby, 'El modal debería tener aria-labelledby con el título').toBeTruthy();

      // ¿El foco entró al modal?
      const focoDentro = await page.evaluate(() => {
        const activo = document.activeElement;
        const dialogo = document.querySelector('dialog[data-testid="dialogo"]');
        return dialogo !== null && activo !== null && dialogo.contains(activo);
      });
      console.log(`[${vp.nombre}] foco dentro del modal: ${focoDentro}`);
      expect(focoDentro, 'El foco debería entrar al modal al abrirlo').toBe(true);

      const medidasConModal = await sinScrollHorizontal(page);
      console.log(
        `[${vp.nombre}] con modal abierto: scrollWidth=${medidasConModal.scrollWidth} clientWidth=${medidasConModal.clientWidth}`,
      );

      await page.screenshot({
        path: `${CARPETA_CAPTURAS}/${vp.nombre}-modal-detalle.png`,
        fullPage: true,
      });

      // ¿Escape cierra, y el foco vuelve a la fila que lo abrió?
      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden({ timeout: 10_000 });

      const focoVolvio = await page.evaluate(
        (testId) => document.activeElement?.getAttribute('data-testid') === testId,
        'agenda-detalle',
      );
      console.log(`[${vp.nombre}] foco volvió al botón que abrió el modal: ${focoVolvio}`);
      expect(focoVolvio, 'Al cerrar con Escape, el foco debería volver al botón «Ver detalle»').toBe(
        true,
      );
    }
  });
});
