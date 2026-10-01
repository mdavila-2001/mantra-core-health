import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * C4 — la reconsulta como una cita real, de punta a punta.
 *
 * ## Contra el simulador, no contra la API
 *
 * La rama `mockup` declara `mockBackend: true`: no habla con ninguna API y el
 * interceptor de `src/app/core/mock/` contesta todo. Por eso se entra con
 * {@link entrarAlSimulador} y con las cuentas del propio simulador
 * (`medica@alovida.mock`, `paciente@alovida.mock`, personas **sintéticas**
 * declaradas en `core/mock/fixtures/personas.ts`), no con los actores de
 * `support/actores.ts`, que crean cuentas de verdad y necesitan Docker.
 *
 * ## Qué se ejercita
 *
 * El recorrido del pedido: la médica abre una consulta desde su agenda, abre la
 * casilla «Reconsulta», elige día y horario, escribe el motivo y agenda. La
 * cita aparece en «Consultas médicas» con su sello, y en «Mis citas» de la
 * paciente con el sello y la frase que la explica. Cierra el caso negativo: la
 * segunda reconsulta de la misma consulta se rechaza con **409** y el mensaje
 * se ve en el bloque.
 *
 * ## Lo que esta suite NO puede afirmar todavía
 *
 * **La casilla `consulta-casilla-reconsulta` la monta `consultation/**`, que es
 * de otro carril y al escribirse esto no había entregado.** El bloque
 * (`patient-chart/follow-up-block/`) está entregado y probado por unidad; lo
 * que falta es el `@case ('reconsulta')` que lo abre. Hasta que ese cableado
 * exista, los casos que arrancan en la casilla no pueden pasar, y **no se
 * ejecutaron**: declararlos verdes sin haberlos corrido sería inventar
 * evidencia. Los dos últimos —los sellos sobre la reconsulta **sembrada**— no
 * dependen del cableado y son los que cierran el kill-test.
 *
 * Tampoco se ejecutó ninguno en esta sesión: el árbol no tiene
 * `scripts/pw-guard.mjs` (artefacto del carril C0) y el turno tenía prohibido
 * levantar servidores. Ver `docs/trabajo/2026-09-25-encuentro-clinico/c4/REPORTE.md`.
 */

const BASE = process.env['PW_BASE_URL'] ?? 'http://localhost:4214';

const CONSULTAS = '/schedule';
const MIS_CITAS = '/my-account/appointments';

/** Los tres anchos obligatorios, más los dos extremos de la matriz de C4. */
const VIEWPORTS = [
  { nombre: 'movil-chico', width: 320, height: 720 },
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'escritorio-ancho', width: 1920, height: 1080 },
] as const;

/**
 * Abre la primera consulta de la agenda de la médica.
 *
 * Se entra **desde la cita** y no desde el expediente a propósito: es la única
 * puerta que lleva el `?cita=`, y sin él la reconsulta no tiene de qué colgar
 * —el bloque lo dice con todas las letras—.
 */
async function abrirConsultaDesdeLaCita(page: Page): Promise<void> {
  await entrarAlSimulador(page, 'medica', BASE);
  await page.goto(`${BASE}${CONSULTAS}`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);

  await page.getByRole('link', { name: /iniciar la consulta/i }).first().click();
  await page.waitForURL((url) => url.searchParams.has('cita'), { timeout: 30_000 });
  await esperarAQueSeAsiente(page);
}

test.describe('C4 · la reconsulta se agenda desde la consulta', () => {
  test('la casilla abre el bloque con el motivo de la cita ya puesto', async ({ page }) => {
    await abrirConsultaDesdeLaCita(page);

    await page.getByTestId('consulta-casilla-reconsulta').click();

    await expect(page.getByTestId('reconsulta-calendario')).toBeVisible();
    // El motivo llega precargado desde la consulta de origen, con su prefijo.
    await expect(page.getByTestId('reconsulta-motivo').locator('textarea')).toHaveValue(
      /^Reconsulta: .+/,
    );
    // Sin horario elegido no se puede agendar: la oferta no precede al dato.
    await expect(page.getByTestId('reconsulta-guardar')).toHaveAttribute('aria-disabled', 'true');
  });

  test('elegir día y horario crea la cita, y el éxito dice para cuándo quedó', async ({ page }) => {
    await abrirConsultaDesdeLaCita(page);
    await page.getByTestId('consulta-casilla-reconsulta').click();

    await elegirPrimerDiaConHorarios(page);
    await page.getByTestId('reconsulta-cupo-opcion').first().click();
    await expect(page.getByTestId('reconsulta-guardar')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await page.getByTestId('reconsulta-guardar').click();

    const exito = page.getByTestId('reconsulta-exito');
    await expect(exito).toBeVisible();
    await expect(exito).toContainText(/Ver en Consultas médicas/i);
  });

  test('la segunda reconsulta de la misma consulta se rechaza con un mensaje', async ({ page }) => {
    await abrirConsultaDesdeLaCita(page);
    await page.getByTestId('consulta-casilla-reconsulta').click();

    await elegirPrimerDiaConHorarios(page);
    await page.getByTestId('reconsulta-cupo-opcion').first().click();
    await page.getByTestId('reconsulta-guardar').click();
    await expect(page.getByTestId('reconsulta-exito')).toBeVisible();

    // Reabrir la casilla: la consulta ya tiene su reconsulta, y el bloque lo
    // dice en vez de ofrecer un formulario que el servidor rechaza con 409.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);
    await page.getByTestId('consulta-casilla-reconsulta').click();

    await expect(page.getByTestId('reconsulta-ya-agendada')).toBeVisible();
    await expect(page.getByTestId('reconsulta-guardar')).toHaveCount(0);
  });
});

test.describe('C4 · el sello se ve en las dos agendas', () => {
  /**
   * El kill-test del carril, del lado de quien atiende.
   *
   * No depende del cableado de la casilla: la reconsulta **sembrada**
   * (`core/mock/fixtures/agenda.ts`) ya cuelga de una consulta atendida de la
   * paciente principal.
   */
  test('en Consultas médicas la fila lleva el sello y de qué consulta salió', async ({ page }) => {
    await entrarAlSimulador(page, 'medica', BASE);
    await page.goto(`${BASE}${CONSULTAS}`, { waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);

    const sello = page.getByTestId('cita-reconsulta-sello').first();
    await expect(sello).toBeVisible();
    await expect(sello).toHaveText('Reconsulta');
    await expect(page.getByText(/de la cita del/i).first()).toBeVisible();
  });

  /**
   * **El kill-test.** Si la reconsulta no aparece acá con su sello, C4 no está
   * hecho, por más que todo lo demás pase.
   */
  test('en «Mis citas» la paciente ve el sello y por qué la citaron de nuevo', async ({ page }) => {
    await entrarAlSimulador(page, 'paciente', BASE);
    await page.goto(`${BASE}${MIS_CITAS}`, { waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);

    await expect(page.getByTestId('mis-citas-reconsulta-sello').first()).toBeVisible();
    await expect(page.getByTestId('mis-citas-reconsulta-frase').first()).toContainText(
      /Tu médico te citó de nuevo/i,
    );
  });

  for (const viewport of VIEWPORTS) {
    test(`el sello se lee entero en ${viewport.nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrarAlSimulador(page, 'paciente', BASE);
      await page.goto(`${BASE}${MIS_CITAS}`, { waitUntil: 'domcontentloaded' });
      await esperarAQueSeAsiente(page);

      const sello = page.getByTestId('mis-citas-reconsulta-sello').first();
      await expect(sello).toBeVisible();
      // Nada recortado: un sello que se corta deja de decir lo que dice.
      const caja = await sello.boundingBox();
      expect(caja?.width ?? 0).toBeGreaterThan(0);
      expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    });
  }
});

/**
 * Elige el primer día **verde** del calendario.
 *
 * Ya no hace falta probar fecha por fecha: el calendario marca en verde los
 * días con horarios libres y deshabilita los rojos, así que alcanza con tomar
 * el primero. Si el mes a la vista no tuviera ninguno —los cupos de la maqueta
 * se generan alrededor de hoy— se pasa al siguiente.
 */
async function elegirPrimerDiaConHorarios(page: Page): Promise<void> {
  const MESES_A_PROBAR = 3;
  const verdes = page.locator('[data-testid="reconsulta-dia"][data-estado="libre"]');

  for (let intento = 0; intento < MESES_A_PROBAR; intento += 1) {
    if ((await verdes.count()) > 0) {
      await verdes.first().click();
      await expect(page.getByTestId('reconsulta-cupo')).toBeVisible();
      return;
    }
    await page.getByTestId('reconsulta-mes-siguiente').click();
    await esperarAQueSeAsiente(page);
  }

  throw new Error(
    'Ningún día de los próximos tres meses quedó en verde en la agenda de la médica: ' +
      'revisá el fixture de cupos antes de culpar a la pantalla.',
  );
}
