import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  crearMedicoSintetico,
  crearPacienteConToken,
  crearRelacionAsistencial,
  sembrarObservacionPrevia,
  type MedicoSintetico,
  type PacienteSintetico,
} from './support/api-real-clinica';
import { contextoDeApi, apiViva } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * C-14/C-23 **contra la API real** (Neon, sin `mockBackend`).
 *
 * Complementa a `correcciones-c14-c23.spec.ts` (maqueta): cierra lo que la
 * maqueta no puede, porque responde *dentro* de Angular y no falla a pedido.
 * Cuentas y datos, **sintéticos y declarados**: médico y paciente se
 * registran acá mismo contra la API, nunca la cuenta real de `doctora()`.
 *
 * Se salta entera si no hay API viva en `E2E_API_URL` — no tiene sentido
 * medir nada sin ella (mismo criterio que `auditoria-prompts.spec.ts`).
 *
 * **Hallazgo de la Fase 0, con dueño (seeds):** esta base de Neon no tiene
 * sembrado ningún value set de clínica (ni `VS_OBSERVATION_CODE` ni de tipo
 * de episodio). El selector «Agregar columna» de la cuadrícula depende de
 * ese catálogo y sale vacío — **no se ejercita acá**. Se rodea sembrando por
 * API una observación previa (`sembrarObservacionPrevia`), que es justo el
 * mecanismo que hace que la columna exista sin pasar por ese selector.
 */

const SALIDA = join('docs', 'trabajo', '2026-09-20-notas-cuadricula-e-internacion', 'evidencia', 'api-real');

test.describe('C-14/C-23 · contra la API real', () => {
  let hayApi = false;
  let medico: MedicoSintetico;

  test.beforeAll(async () => {
    const api = await contextoDeApi();
    hayApi = await apiViva(api);
    await api.dispose();
  });

  test.beforeEach(() => {
    test.skip(!hayApi, 'No hay API viva en E2E_API_URL: esta suite no puede medir nada.');
    mkdirSync(SALIDA, { recursive: true });
  });

  /**
   * Envía el formulario de internación y confirma el diálogo nativo que
   * `DialogService.confirm()` abre encima.
   *
   * En `admission-block.spec.ts` ese diálogo está mockeado
   * (`{ provide: DialogService, useValue: { confirm } }`) y se pierde de
   * vista que en el navegador real es un `<dialog>` de verdad, apilado sobre
   * el modal de internación — sin este segundo clic el alta nunca sale.
   */
  async function confirmarAlta(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Dar de alta la internación' }).click();
    await page
      .getByRole('dialog', { name: '¿Dar de alta la internación?' })
      .getByRole('button', { name: 'Dar de alta' })
      .click();
  }

  /** Abre la casilla indicada dentro de la consulta y espera el modal. */
  async function abrirCasilla(page: Page, clave: string) {
    await page.getByTestId(`consulta-casilla-${clave}`).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await estable(page);
    return page.getByRole('dialog');
  }

  /**
   * Entra, va directo a la ficha del paciente (por id, sin buscar por
   * nombre) y abre un encuentro.
   *
   * `page.goto` con `waitUntil: 'commit'`, no `irA` (pushState +
   * `popstate` sintético): `irA` está pensada para el barrido de rutas
   * planas del menú (`docs` en `sesion.ts`), y saltar así directo a una ruta
   * anidada y parametrizada (`/medical-records/:id/consultation`) no
   * disparaba los resolvers de la ruta — el «Abrir encuentro» se clickeaba
   * pero el encuentro nunca aparecía. Mismo patrón que ya prueba
   * `correcciones-c14-c23.spec.ts` (maqueta) para esta misma ruta.
   */
  async function irAConsultaConEncuentro(page: Page, paciente: PacienteSintetico): Promise<void> {
    await entrar(page, medico.actor);
    await page.goto(`/medical-records/${paciente.pid}/consultation`, { waitUntil: 'commit' });
    await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
    await estable(page);

    const abrir = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrir.count()) > 0) {
      await abrir.click();
    }
    await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
  }

  test('la guardia de lectura: 403 sin relación, 200 apenas el paciente la acepta', async () => {
    const api = await contextoDeApi();
    medico = await crearMedicoSintetico(api);
    const sinRelacion = await crearPacienteConToken(api);

    const antes = await api.get(`/clinical/patients/${sinRelacion.pid}/summary`, {
      headers: { Authorization: `Bearer ${medico.token}` },
    });
    expect(antes.status()).toBe(403);

    await crearRelacionAsistencial(api, medico, sinRelacion);

    const despues = await api.get(`/clinical/patients/${sinRelacion.pid}/summary`, {
      headers: { Authorization: `Bearer ${medico.token}` },
    });
    expect(despues.status()).toBe(200);
    await api.dispose();
  });

  test('C-14 · vacío, error, y la fila persiste tras recargar', async ({ page }) => {
    const api = await contextoDeApi();
    medico = medico ?? (await crearMedicoSintetico(api));
    const vacia = await crearPacienteConToken(api);
    await crearRelacionAsistencial(api, medico, vacia);

    /* ---- 1 · vacío: paciente recién registrado, cero observaciones ------- */
    await irAConsultaConEncuentro(page, vacia);
    const modalVacio = await abrirCasilla(page, 'notas');
    await modalVacio.getByRole('tab', { name: 'Cuadrícula' }).click();
    await estable(page);
    await expect(modalVacio.getByTestId('cuadricula-cargando')).toHaveCount(0);
    await expect(modalVacio.getByTestId('cuadricula-vacia')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: join(SALIDA, 'c14-real-vacio.png') });
    await page.keyboard.press('Escape');

    /* ---- 2 · error: se intercepta el summary con un 500 ------------------ */
    const conColumna = await crearPacienteConToken(api);
    await crearRelacionAsistencial(api, medico, conColumna);
    // Se siembra ANTES de que la UI abra ningún encuentro: el sembrado queda
    // como el único abierto y `encuentroActual` lo toma como «esta consulta»
    // — ver la nota de `sembrarObservacionPrevia` sobre por qué no se cierra
    // (el endpoint de cierre está roto en esta base). `irAConsultaConEncuentro`
    // no clickea «Abrir encuentro» porque ya hay uno en curso.
    await sembrarObservacionPrevia(api, medico, conColumna);

    await page.route('**/clinical/patients/**/summary', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL","message":"forzado por la prueba"}' }),
    );
    await irAConsultaConEncuentro(page, conColumna).catch(() => {
      // El check-in de "abrir encuentro" también puede leer el summary; si la
      // ruta interceptada rompe la apertura misma, igual el modal de notas se
      // puede abrir para ver el estado de error de la cuadrícula.
    });
    const modalError = page.getByRole('dialog');
    if ((await modalError.count()) === 0) {
      await page.getByTestId('consulta-casilla-notas').click();
    }
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('tab', { name: 'Cuadrícula' }).click();
    await expect(page.getByTestId('cuadricula-error-carga')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: join(SALIDA, 'c14-real-error.png') });

    await page.unroute('**/clinical/patients/**/summary');
    await page.getByTestId('cuadricula-reintentar').click();
    await estable(page);

    /* ---- 3 · la fila sembrada por API, real, sobrevive a recargar -------- */
    // No se teclea un valor nuevo acá: el encuentro sembrado ya ES «esta
    // consulta» (nota de arriba), así que la fila de hoy ya existe y el
    // motivo de «una por sesión» tiene que aparecer — es justo lo que se
    // comprueba. El camino de escritura de la UI (tipear → guardar) ya está
    // probado contra la maqueta (`correcciones-c14-c23.spec.ts`) y contra la
    // API real por HTTP directo (`clinical-c14-c23-notas-e-internacion.int-spec.ts`).
    const modal = page.getByRole('dialog');
    await expect(modal.getByTestId('cuadricula-cargando')).toHaveCount(0, { timeout: 15_000 });
    await expect(modal.getByTestId('cuadricula-una-por-sesion')).toBeVisible();
    await expect(modal.getByTestId('cuadricula-fila-hoy')).toContainText('65');
    await page.screenshot({ path: join(SALIDA, 'c14-real-con-datos.png') });

    await page.reload();
    await estable(page);
    await page.getByTestId('consulta-casilla-notas').click();
    const modalReabierto = page.getByRole('dialog');
    await expect(modalReabierto).toBeVisible();
    await modalReabierto.getByRole('tab', { name: 'Cuadrícula' }).click();
    await expect(modalReabierto.getByTestId('cuadricula-fila-hoy')).toContainText('65', { timeout: 15_000 });
    await page.screenshot({ path: join(SALIDA, 'c14-real-fila-persistida.png') });

    await api.dispose();
  });

  test('C-23 · alta de internación persiste tras recargar, y el registro tardío se marca', async ({ page }) => {
    const api = await contextoDeApi();
    medico = medico ?? (await crearMedicoSintetico(api));
    const paciente = await crearPacienteConToken(api);
    await crearRelacionAsistencial(api, medico, paciente);

    await irAConsultaConEncuentro(page, paciente);
    const modal = await abrirCasilla(page, 'internacion');

    // Fecha pasada (registro tardío deliberado): el campo de texto es SÓLO
    // fecha —segmentos día/mes/año enmascarados (`date-picker.ts`, sin
    // segmento de hora)—; la hora se elige en los `<select>` del calendario
    // abierto, no se teclea junto a la fecha. Escribirle " 08:00" detrás
    // corrompía la máscara y el campo volvía a "ahora" (se reprodujo así en
    // la primera corrida). Alcanza con la fecha: un día entero de diferencia
    // ya es mucho más que el minuto que exige `registroTardio()`.
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dd = String(ayer.getDate()).padStart(2, '0');
    const mm = String(ayer.getMonth() + 1).padStart(2, '0');
    const yyyy = String(ayer.getFullYear());
    const campoFecha = modal.locator('input[inputmode="numeric"]').first();
    await campoFecha.click();
    // El clic de Playwright cae en el CENTRO del campo — con la máscara
    // "DD/MM/AAAA" eso deja el cursor dentro del segmento año, no en el día:
    // los primeros dígitos tecleados terminaban completando el año y
    // «20092026» salía como «DD/MM/2009», con día y mes en blanco. `Home`
    // selecciona explícitamente el día (`handleInputKeydown`, `date-picker.ts`).
    await campoFecha.press('Home');
    await campoFecha.pressSequentially(`${dd}${mm}${yyyy}`, { delay: 30 });
    await expect(campoFecha).toHaveValue(`${dd}/${mm}/${yyyy}`);

    await confirmarAlta(page);
    await expect(modal.getByTestId('internacion-lista')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId('internacion-registro-tardio')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, 'c23-real-registro-tardio.png') });

    await page.keyboard.press('Escape');
    await page.reload();
    await estable(page);
    // `internacion-duplicada` es el aviso del **409** al intentar una
    // segunda alta (`avisoDeDuplicado()`), no un indicador persistente de
    // «ya hay una internación» — tras recargar, sin reintentar el alta, ese
    // 409 nunca ocurre y el aviso no aparece. Lo que sí prueba la
    // persistencia es que la lista releída del servidor sigue mostrándola, y
    // que el formulario vuelve a cerrarse con su propio texto
    // (`internacionAbierta()`, `admission-block.html`).
    const modalTrasRecargar = await abrirCasilla(page, 'internacion');
    await expect(modalTrasRecargar.getByTestId('internacion-lista')).toBeVisible({ timeout: 15_000 });
    await expect(modalTrasRecargar.getByTestId('internacion-registro-tardio')).toBeVisible();
    await expect(modalTrasRecargar.getByText('Esta persona ya está internada')).toBeVisible();
    await page.screenshot({ path: join(SALIDA, 'c23-real-tras-recargar.png') });

    await api.dispose();
  });

  test('C-23 · el 400 real del servidor llega al único campo del formulario', async ({ page }) => {
    const api = await contextoDeApi();
    medico = medico ?? (await crearMedicoSintetico(api));
    const paciente = await crearPacienteConToken(api);
    await crearRelacionAsistencial(api, medico, paciente);

    await irAConsultaConEncuentro(page, paciente);
    const modal = await abrirCasilla(page, 'internacion');

    // Cuerpo literal capturado contra la API real (Fase 1 del carril,
    // `clinical-c14-c23-notas-e-internacion.int-spec.ts`, caso «startAt
    // inválido»): se reproduce igual, no se inventa una forma de error.
    await page.route('**/clinical/care-episodes', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'VALIDATION_FAILED',
          message: 'Error de validación',
          correlationId: 'pw-real',
          details: { violations: ['startAt must be a valid ISO 8601 date string'] },
          timestamp: new Date(0).toISOString(),
          path: '/clinical/care-episodes',
        }),
      }),
    );

    await confirmarAlta(page);
    await expect(modal.getByTestId('internacion-error')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId('internacion-error')).toContainText(/ISO 8601|fecha/i);
    await page.screenshot({ path: join(SALIDA, 'c23-real-error-de-campo.png') });

    await api.dispose();
  });
});
