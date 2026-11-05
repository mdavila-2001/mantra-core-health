import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * **Simulador, «¿por qué?» y autoservicio de explicación** contra el backend simulado (bloque B6f del gobierno de accesos).
 * Un solo escenario con tres personas, cada una en su propio contexto (su propio `sessionStorage`, o sea su propia memoria del
 * simulador). Se levanta con `ng serve --configuration development,demo` (o un build de demo servido) y se apunta con
 * `E2E_BASE_URL`.
 *
 * 1. El **administrador** abre el simulador, pregunta por qué Marcos puede o no cancelar una cita de Suárez con poca
 *    anticipación (⚠ pide la aprobación del doctor, con la traza paso a paso), prueba «¿y si tuviera la aprobación?» y simula un
 *    borrador que le suma «Cobrar la atención» (compara antes y después). En «Equipo de apoyo» lee las insignias de sus permisos.
 * 2. **Marcos** pregunta lo mismo desde «Mis accesos»: la explicación no trae lo que solo ve el administrador; lee las
 *    condiciones y lo que se le pedirá, y retira el pedido de aprobación que tenía esperando.
 * 3. **Suárez** ve en «Mi equipo» lo que espera su decisión y pregunta por qué Marcos pudo o no pudo, solo sobre su agenda.
 */

async function entrar(browser: Browser, correo: string): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(correo);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** Va a una pantalla por el router, sin recargar: el simulador conserva su memoria. */
async function irA(page: Page, ruta: string, esperaTestId: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page.getByTestId(esperaTestId)).toBeVisible({ timeout: 30_000 });
}

/** Las peticiones que atendió el simulador. */
async function peticiones(
  page: Page,
): Promise<{ method: string; url: string; status: number; body: unknown }[]> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? [],
  );
}
const hubo = async (
  page: Page,
  method: string,
  fragmento: string,
  status: number,
): Promise<boolean> =>
  (await peticiones(page)).some(
    (p) => p.method === method && p.url.includes(fragmento) && p.status === status,
  );

/** Elige una opción de un `app-select` por el texto que contiene. */
async function elegir(page: Page, testId: string, texto: string): Promise<void> {
  await page.getByTestId(testId).locator('.select-trigger').click();
  await page.locator('[role="option"]', { hasText: texto }).first().click();
}

const ZONA = 'America/La_Paz';
/** Mañana (en La Paz): una fecha fija a partir de hoy, sea cual sea la hora de quien corre la prueba. */
function manana(): string {
  return new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: ZONA });
}

test.describe('Gobierno de accesos: simulador, «¿por qué?» y autoservicio', () => {
  test('el administrador explica y simula, Marcos pregunta «¿por qué no puedo?» y Suárez pregunta por su equipo', async ({
    browser,
  }) => {
    /* ---- 1. El administrador: explicar, «¿y si…?», simular y las insignias -------------------------------------------- */
    const admin = await entrar(browser, 'hospital.piloto@alovida.mock');
    await irA(admin, '/administration/access-governance/simulator', 'pantalla-simulator');

    await elegir(admin, 'explicar-persona', 'Marcos Ribera');
    await elegir(admin, 'explicar-accion', 'Cancelar citas');
    await elegir(admin, 'explicar-doctor', 'Suárez');
    await admin.getByTestId('explicar-fecha').fill(manana());
    await admin.getByTestId('explicar-hora').fill('10:30');
    await admin.getByTestId('explicar-enviar').click();

    // UI → petición → respuesta: ⚠ falta un requisito, con la traza ordenada y el paso que decidió.
    await expect(admin.getByTestId('veredicto')).toHaveAttribute('data-efecto', 'CHALLENGE', {
      timeout: 30_000,
    });
    await expect(admin.getByTestId('veredicto')).toContainText('Puede, pero falta un requisito');
    await expect(admin.locator('[data-testid^="paso-"][aria-current="step"]')).toContainText(
      'Decidió aquí',
    );
    await expect(admin.getByTestId('explicacion-arreglos')).toContainText('anticipación');
    expect(await hubo(admin, 'POST', '/org/access/explain', 200)).toBe(true);

    // «¿Y si tuviera la aprobación y el motivo?»: la misma pregunta con otros supuestos, sin guardar nada.
    const si = admin.locator('[data-testid="explicacion-ysi"] button[data-value="YES"]');
    await si.nth(2).click();
    await si.nth(0).click();
    await expect(admin.getByTestId('veredicto')).toHaveAttribute('data-efecto', 'PERMIT', {
      timeout: 30_000,
    });
    await expect(admin.getByTestId('explicacion-supuestos')).toContainText(
      'si tuviera la aprobación',
    );

    // Simular: un borrador que le suma «Cobrar la atención», comparado antes y después.
    await admin.getByRole('tab', { name: '¿Qué pasa si cambio permisos?' }).click();
    await elegir(admin, 'borrador-persona', 'Marcos Ribera');
    await expect(admin.getByTestId('borrador-actuales')).toBeVisible({ timeout: 30_000 });
    await elegir(admin, 'borrador-permiso', 'Cobrar la atención');
    await admin.getByTestId('borrador-agregar').click();
    await expect(admin.getByTestId('borrador-items')).toContainText('Permitir: Cobrar la atención');
    await admin.getByTestId('borrador-simular').click();
    await expect(admin.getByTestId('simulacion-resultado')).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByTestId('simulacion-impacto')).toContainText(
      'Casos donde ahora sí podría',
    );
    await expect(admin.getByTestId('simulacion-casos')).toContainText('Ahora sí puede');
    expect(await hubo(admin, 'POST', '/org/access/simulate', 200)).toBe(true);
    // Simular no guarda nada: no hubo ninguna escritura de permisos.
    expect(
      (await peticiones(admin)).some(
        (p) => ['POST', 'PATCH', 'PUT'].includes(p.method) && p.url.includes('/grants'),
      ),
    ).toBe(false);

    // Las insignias de «Equipo de apoyo»: efecto, condiciones, origen y sensibilidad, con palabras.
    await irA(admin, '/administration/support-team', 'equipo-card');
    const marcosFila = admin.locator('[data-testid^="equipo-insignias-"]').first();
    await expect(marcosFila).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByTestId('equipo-card')).toContainText('Con condiciones');
    await expect(admin.getByTestId('equipo-card')).toContainText('Sensibilidad máxima');
    await admin.context().close();

    /* ---- 2. Marcos: «¿Por qué no puedo?», condiciones y su pedido de aprobación -------------------------------------- */
    const marcos = await entrar(browser, 'marcos.ribera@alovida.mock');
    await irA(marcos, '/my-support', 'porque-card');
    await expect(marcos.locator('[data-testid^="condiciones-"]').first()).toContainText(
      '24 horas de anticipación',
    );
    await expect(marcos.locator('[data-testid^="obligaciones-"]').first()).toContainText(
      'Pide el motivo por escrito',
    );

    await elegir(marcos, 'porque-accion', 'Cancelar citas');
    await elegir(marcos, 'porque-doctor', 'Suárez');
    await marcos.getByTestId('porque-fecha').fill(manana());
    await marcos.getByTestId('porque-hora').fill('10:30');
    await marcos.getByTestId('porque-enviar').click();
    await expect(marcos.getByTestId('porque-resultado').getByTestId('veredicto')).toHaveAttribute(
      'data-efecto',
      'CHALLENGE',
      { timeout: 30_000 },
    );
    // Sin lo que solo ve el administrador: en su lugar, «Pida a su administrador…».
    await expect(marcos.getByTestId('explicacion-pedir')).toContainText('Pida a su administrador');
    await expect(marcos.getByTestId('explicacion-arreglos')).toHaveCount(0);
    expect(await hubo(marcos, 'POST', '/me/support-access/explain', 200)).toBe(true);

    // Su pedido de aprobación esperando: lo retira y la lista, recargada, lo dice.
    const pendiente = marcos.locator('[data-testid^="aprobacion-"][data-estado="PENDING"]').first();
    await expect(pendiente).toContainText('Espera la decisión');
    await pendiente.locator('[data-testid^="aprobacion-retirar-"]').click();
    await expect.poll(() => hubo(marcos, 'POST', '/cancel', 200)).toBe(true);
    await expect(
      marcos.locator('[data-testid^="aprobacion-"][data-estado="CANCELLED"]').first(),
    ).toContainText('Retirada');
    await marcos.context().close();

    /* ---- 3. Suárez: lo que le espera y «¿por qué pudo o no pudo…?» sobre su agenda ------------------------------------ */
    const suarez = await entrar(browser, 'martin.suarez@alovida.mock');
    await irA(suarez, '/my-team', 'equipo-atencion');
    await expect(suarez.getByTestId('atencion-aprobaciones')).toContainText('su decisión');
    await expect(suarez.getByTestId('atencion-aprobaciones').locator('a')).toHaveAttribute(
      'href',
      '/my-team/approvals',
    );
    await suarez.locator('[data-testid^="porque-miembro-"]').first().click();
    await elegir(suarez, 'explicar-equipo-accion', 'Cancelar citas');
    await suarez.getByTestId('explicar-equipo-fecha').fill(manana());
    await suarez.getByTestId('explicar-equipo-hora').fill('10:30');
    await suarez.getByTestId('explicar-equipo-enviar').click();
    await expect(
      suarez.getByTestId('explicar-equipo-resultado').getByTestId('veredicto'),
    ).toBeVisible({
      timeout: 30_000,
    });
    expect(await hubo(suarez, 'POST', '/me/practitioner/support-team/explain', 200)).toBe(true);
    await suarez.context().close();
  });
});
