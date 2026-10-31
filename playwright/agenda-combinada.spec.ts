import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * **Agenda combinada** del personal de apoyo contra el backend simulado.
 *
 * Cada prueba entra con una persona distinta **en su propio contexto** (su
 * propio `sessionStorage`, o sea su propia memoria del simulador), así que no
 * dependen unas de otras ni del orden. Se levanta con
 * `ng serve --configuration development,demo` y se apunta con `E2E_BASE_URL`.
 *
 * Lo que recorre, por persona:
 *
 * - **Ana** (secretaria de Pérez y Rojas): ve a los dos en la semana; crea una
 *   cita eligiendo un horario libre y buscando al paciente por su documento
 *   completo; la **reprograma arrastrándola** y lo guardado sobrevive a recargar.
 * - **Lucía** (recepción, Edificio A · Piso 1): solo ve el Piso 1 y **no tiene
 *   «Crear»**: el botón no existe y la nota dice por qué. Lo demás se ve atenuado.
 * - **Marcos** (call center): ve Ecografía de todo el hospital y la combinación
 *   Suárez × Sede Norte; Suárez en el Edificio B y Rojas, atenuados o ausentes.
 * - **Elena** (dos organizaciones): una sola agenda con la sigla de cada una y
 *   la organización dicha en cada acción.
 * - La búsqueda **«Juan»** se rechaza (caso 13): no sale ni la petición.
 */

async function entrar(browser: Browser, clave: string, ancho = 1440, alto = 900, ahora?: Date): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: ancho, height: alto } });
  const page = await contexto.newPage();
  // Un reloj fijo: el indicador de «ahora» se prueba a una hora que cae dentro de la jornada, sea cual sea la del que corre la prueba.
  if (ahora !== undefined) await page.clock.setFixedTime(ahora);
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(`${clave}@alovida.mock`);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 30_000 });
  // Quien trabaja en más de una organización elige primero con cuál entra; la agenda combinada las junta igual.
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** Va a una pantalla por el router, sin recargar: el simulador conserva su memoria. */
async function irA(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page.getByTestId('agenda-titulo')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('agenda-grilla').or(page.getByTestId('agenda-linea')).or(page.getByTestId('agenda-sin-horarios'))).toBeVisible({ timeout: 30_000 });
}

/** Las peticiones que atendió el simulador. */
async function peticiones(page: Page): Promise<{ method: string; url: string; status: number; body: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? []);
}

/**
 * La zona horaria de las pruebas (la de `playwright.config.ts`): lo que la página llama «hoy».
 * Bolivia no tiene horario de verano, así que su desfase es fijo (UTC−4).
 */
const ZONA = 'America/La_Paz';

/** Hoy como lo ve la página, que no es necesariamente como lo ve quien corre la prueba. */
function hoyEnLaPaz(): { readonly y: number; readonly m: number; readonly d: number } {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: ZONA }).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** `YYYY-MM-DD` del lunes de la semana que viene: todo en ella es futuro, sea cual sea la hora a la que corra la prueba. */
function lunesQueViene(): string {
  const { y, m, d } = hoyEnLaPaz();
  const diaDeSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return new Date(Date.UTC(y, m - 1, d - ((diaDeSemana + 6) % 7) + 7)).toISOString().slice(0, 10);
}

/** Las 11:10 de hoy en La Paz: una hora que cae dentro de la jornada. */
function alasOnce(): Date {
  const { y, m, d } = hoyEnLaPaz();
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T11:10:00-04:00`);
}

const ENTRE_CIEN = (page: Page, selector: string) => page.locator(selector);

test.describe('Ana: la semana, crear y reprogramar arrastrando', () => {
  test('ve a Pérez y a Rojas en la semana, crea una cita y la reprograma por arrastre', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);

    // La semana: siete columnas, y los dos doctores en «Mis doctores» y en los eventos.
    await expect(page.locator('.grid__titulo')).toHaveCount(7);
    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Andrés Pérez');
    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Valeria Rojas');
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Pérez"]').first()).toBeVisible();
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Rojas"]').first()).toBeVisible();
    await expect(page.getByTestId('agenda-organizacion')).toContainText('Hospital Piloto Mantra');

    // El estado vive en la URL.
    expect(page.url()).toContain('vista=semana');

    // Crear: un horario libre de Pérez en el 103 → panel → «Crear cita» → documento completo.
    const libres = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"][aria-label*="Pérez"][aria-label*="Consultorio 103"]:not(.celda--atenuada)');
    const origen = libres.first();
    const idOrigen = (await origen.getAttribute('data-event-id'))!;
    await origen.click();
    await expect(page.getByTestId('agenda-panel')).toBeVisible();
    await expect(page.getByTestId('panel-organizacion')).toContainText('Hospital Piloto Mantra');
    await page.getByTestId('agenda-crear-cita').click();

    // «Juan» no es una búsqueda.
    await page.getByTestId('buscador-texto').locator('input').fill('Juan');
    await page.getByTestId('buscador-buscar').click();
    await expect(page.getByTestId('buscador-aviso')).toContainText('«Juan» no alcanza');
    expect((await peticiones(page)).some((p) => p.url.includes('/me/support-patient-search'))).toBe(false);

    // El documento completo sí.
    await page.getByTestId('buscador-texto').locator('input').fill('5000000');
    await page.getByTestId('buscador-buscar').click();
    await page.locator('[data-testid^="elegir-"]').first().click();
    await expect(page.getByTestId('agenda-paciente-encontrado')).toContainText('Ana Lucía Pérez Quiroga');
    await page.getByTestId('agenda-confirmar-cita').click();

    // UI → request → response: se retuvo y se confirmó, en la organización correcta.
    await expect.poll(async () => (await peticiones(page)).some((p) => p.method === 'POST' && p.url.includes('/confirm') && p.status === 201)).toBe(true);
    await expect(page.getByTestId(`item-${idOrigen}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await expect(page.getByTestId('agenda-panel')).toHaveCount(0);

    // Persistencia: tras recargar, la cita sigue.
    await page.reload();
    await expect(page.getByTestId(`item-${idOrigen}`)).toHaveAttribute('data-estado', 'CONFIRMED', { timeout: 30_000 });
    await expect(page.getByTestId(`item-${idOrigen}`)).toHaveAttribute('aria-label', /Ana Lucía Pérez Quiroga/);

    // Reprogramar arrastrando: esa cita sobre otro horario libre de Pérez en el 103, otro día.
    const destino = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"][aria-label*="Pérez"][aria-label*="Consultorio 103"]:not(.celda--atenuada)').last();
    const idDestino = (await destino.getAttribute('data-event-id'))!;
    expect(idDestino).not.toBe(idOrigen);
    await page.getByTestId(`item-${idOrigen}`).dragTo(destino);

    // Primero pide confirmar, con vista previa y motivo obligatorio.
    await expect(page.getByTestId('dialogo-titulo')).toHaveText('Reprogramar la cita');
    await expect(page.getByTestId('dialogo-detalles')).toContainText('Hospital Piloto Mantra');
    await expect(page.getByTestId('dialogo-detalles')).toContainText('Ana Lucía Pérez Quiroga');
    await expect(page.getByTestId('dialogo-detalles')).toContainText('Pasa a');
    await page.getByTestId('dialogo-motivo').locator('textarea').fill('El doctor no atiende ese día');
    await page.getByTestId('dialogo-confirmar').click();

    await expect.poll(async () => (await peticiones(page)).some((p) => p.method === 'POST' && p.url.includes(`/scheduling/bookings/${idOrigen}/reschedule`) && p.status === 200)).toBe(true);
    const envio = (await peticiones(page)).find((p) => p.url.includes('/reschedule'))!;
    expect(envio.body).toMatchObject({ toSlotId: idDestino, reasonText: 'El doctor no atiende ese día' });

    await expect(page.getByTestId(`item-${idDestino}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await expect(page.getByTestId(`item-${idOrigen}`)).toHaveAttribute('data-estado', 'FREE');

    // Persistencia: recargar deja la cita en su nuevo lugar.
    await page.reload();
    await expect(page.getByTestId(`item-${idDestino}`)).toHaveAttribute('data-estado', 'CONFIRMED', { timeout: 30_000 });
    await expect(page.getByTestId(`item-${idOrigen}`)).toHaveAttribute('data-estado', 'FREE');
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-ana-semana.png' });
    await page.context().close();
  });

  test('soltar una cita sobre un horario sin permiso no la mueve y dice por qué', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
    // Un horario de otro servicio de Pérez (el 201 es ecocardiograma): sirve de «destino que no sirve».
    const cita = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="CONFIRMED"][aria-label*="Pérez"][aria-label*="Consultorio 103"]').first();
    const otroServicio = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"][aria-label*="Pérez"][aria-label*="Sala 201"]').first();
    const idCita = (await cita.getAttribute('data-event-id'))!;
    await cita.dragTo(otroServicio);
    await expect(page.getByTestId('dialogo-titulo')).toHaveCount(0);
    await expect(page.getByText('No se puede mover la cita ahí').first()).toBeVisible();
    expect((await peticiones(page)).some((p) => p.url.includes('/reschedule'))).toBe(false);
    await expect(page.getByTestId(`item-${idCita}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await page.context().close();
  });

  test('desde el panel también se reprograma, sin arrastrar: se elige el nuevo horario de una lista', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
    const cita = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="CONFIRMED"][aria-label*="Pérez"][aria-label*="Consultorio 103"]').first();
    const idCita = (await cita.getAttribute('data-event-id'))!;
    await cita.click();
    await page.getByTestId('agenda-accion-reschedule').click();
    await expect(page.getByTestId('agenda-reprogramar')).toBeVisible();
    const destino = page.locator('[data-testid^="destino-"]').first();
    const idDestino = (await destino.getAttribute('data-testid'))!.replace('destino-', '');
    await destino.click();
    await page.getByTestId('dialogo-motivo').locator('textarea').fill('Pidió otra hora');
    await page.getByTestId('dialogo-confirmar').click();
    await expect(page.getByTestId(`item-${idDestino}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await expect(page.getByTestId(`item-${idCita}`)).toHaveAttribute('data-estado', 'FREE');
    await page.context().close();
  });

  test('cancela una cita con motivo y el horario queda libre', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
    const cita = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="CONFIRMED"][aria-label*="Rojas"]').first();
    const idCita = (await cita.getAttribute('data-event-id'))!;
    await cita.click();
    await page.getByTestId('agenda-accion-cancel').click();
    await expect(page.getByTestId('dialogo-titulo')).toHaveText('Cancelar la cita');
    await page.getByTestId('dialogo-confirmar').click();
    await expect(page.getByTestId('dialogo-titulo')).toBeVisible(); // sin motivo no confirma
    await page.getByTestId('dialogo-motivo').locator('textarea').fill('El paciente avisó que no puede venir');
    await page.getByTestId('dialogo-confirmar').click();
    await expect(page.getByTestId(`item-${idCita}`)).toHaveAttribute('data-estado', 'FREE');
    await page.context().close();
  });

  test('confirma una cita reservada: la acción solo existe donde la cita espera confirmación', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?vista=semana&fecha=${lunesQueViene()}`);
    const confirmada = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="CONFIRMED"][aria-label*="Pérez"]').first();
    await confirmada.click();
    await expect(page.getByTestId('agenda-accion-confirm')).toHaveCount(0);
    const reservada = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="BOOKED"][aria-label*="Pérez"]').first();
    const id = (await reservada.getAttribute('data-event-id'))!;
    await reservada.click();
    await page.getByTestId('agenda-accion-confirm').click();
    await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await page.context().close();
  });

  test('nueva cita con el atajo N: se busca al paciente, se elige el horario y se crea; T y las flechas mueven la fecha', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, `/combined-agenda?fecha=${lunesQueViene()}`);
    const titulo = page.getByTestId('agenda-titulo');
    const inicial = await titulo.textContent();
    await page.keyboard.press('ArrowRight');
    await expect(titulo).not.toHaveText(inicial!);
    await page.keyboard.press('ArrowLeft');
    await expect(titulo).toHaveText(inicial!);
    await page.keyboard.press('t');
    await expect(page).not.toHaveURL(/fecha=/);
    await page.goto(`/combined-agenda?fecha=${lunesQueViene()}`);
    await expect(page.getByTestId('agenda-titulo')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('n');
    await expect(page.getByTestId('agenda-buscador')).toBeVisible();
    await page.getByTestId('buscador-texto').locator('input').fill('5000000');
    await page.keyboard.press('Enter');
    await page.locator('[data-testid^="elegir-"]').first().click();
    await expect(page.getByTestId('agenda-nueva-cita-banner')).toContainText('Ana Lucía Pérez Quiroga');
    const libre = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"]:not(.celda--atenuada)').first();
    const id = (await libre.getAttribute('data-event-id'))!;
    await libre.click();
    await page.getByTestId('agenda-crear-cita').click();
    await expect(page.getByTestId('agenda-paciente-encontrado')).toContainText('Ana Lucía Pérez Quiroga');
    await page.getByTestId('agenda-confirmar-cita').click();
    await expect(page.getByTestId(`item-${id}`)).toHaveAttribute('data-estado', 'CONFIRMED');
    await page.context().close();
  });
});

test.describe('La búsqueda de pacientes es exacta', () => {
  test('«Juan» se rechaza (caso 13): el aviso dice cómo buscar y no sale ninguna petición', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, '/combined-agenda');
    await page.keyboard.press('/');
    await expect(page.getByTestId('agenda-buscador')).toBeVisible();
    await page.getByTestId('buscador-texto').locator('input').fill('Juan');
    await page.getByTestId('buscador-buscar').click();
    await expect(page.getByTestId('buscador-aviso-texto')).toContainText('«Juan» no alcanza');
    await expect(page.getByTestId('buscador-aviso')).toContainText('documento de identidad completo');
    expect((await peticiones(page)).filter((p) => p.url.includes('/me/support-patient-search'))).toHaveLength(0);

    // Por nombre sin fecha de nacimiento, tampoco.
    await page.locator('[data-testid="buscador-modo"] [data-value="NAME_BIRTH"]').click();
    await page.getByTestId('buscador-nombre').locator('input').fill('Juan Pérez');
    await page.getByTestId('buscador-buscar').click();
    await expect(page.getByTestId('buscador-aviso-texto')).toContainText('fecha de nacimiento');
    await page.context().close();
  });

  test('el documento completo encuentra, con datos mínimos; sin resultados ofrece registrar; el registro avisa de duplicados', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, '/combined-agenda');
    await page.keyboard.press('/');
    await page.getByTestId('buscador-texto').locator('input').fill('5000000');
    await page.getByTestId('buscador-buscar').click();
    const tarjeta = page.locator('[data-testid^="paciente-"]').first();
    await expect(tarjeta).toContainText('Ana Lucía Pérez Quiroga');
    await expect(tarjeta).toContainText('***000');
    await expect(tarjeta).not.toContainText('5000000');
    await expect(page.getByTestId('agenda-agendarle')).toHaveCount(0);

    // Un documento que no existe: lo dice y ofrece registrar.
    await page.getByTestId('buscador-texto').locator('input').fill('8888888');
    await page.getByTestId('buscador-buscar').click();
    await expect(page.getByTestId('buscador-sin-resultados')).toBeVisible();
    await page.getByTestId('registrar-paciente-nuevo').click();
    await expect(page.getByTestId('registro-paciente')).toBeVisible();
    await expect((page.getByTestId('registro-documento').locator('input'))).toHaveValue('8888888');

    // Los mismos datos de alguien que ya existe: avisa antes de crear.
    await page.getByTestId('registro-nombre').locator('input').fill('Ana Lucía');
    await page.getByTestId('registro-apellido').locator('input').fill('Pérez');
    await page.getByTestId('registro-nacimiento').locator('input').fill('1990-06-21');
    await page.getByTestId('registro-telefono').locator('input').fill('71234567');
    await page.getByTestId('registro-guardar').click();
    await expect(page.getByTestId('registro-duplicados')).toBeVisible();
    // Ana Lucía está registrada en OTRA organización: la API no da su perfil ni su nombre, solo con qué coincide.
    await expect(page.getByTestId('parecido-ajeno')).toContainText('otra organización');
    await expect(page.getByTestId('parecido-ajeno')).toContainText('el nombre y la fecha de nacimiento');
    await expect(page.getByTestId('registro-paciente')).not.toContainText('Ana Lucía Pérez Quiroga');
    // «Es esta persona» no se ofrece: no hay ficha que usar.
    await expect(page.locator('[data-testid^="usar-existente-"]')).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-registro-duplicados.png' });
    await page.context().close();
  });
});

test.describe('Lucía: solo el Piso 1 y sin «Crear»', () => {
  test('el árbol solo trae el Piso 1; no hay botón de crear; lo demás se ve atenuado con su motivo', async ({ browser }) => {
    const page = await entrar(browser, 'lucia');
    await irA(page, '/combined-agenda');

    const arbol = page.getByTestId('agenda-arbol');
    // La API da una lista plana de espacios (sin pisos) y solo los que Lucía ve.
    await expect(arbol).toContainText('Consultorio 103');
    await expect(arbol).not.toContainText('Piso 2');
    await expect(arbol).not.toContainText('Piso 4');
    await expect(arbol).not.toContainText('Cama');

    // Todo lo que puede tocar está en el Piso 1 (consultorios 10x).
    const propios = ENTRE_CIEN(page, '[data-testid^="item-"]:not(.celda--atenuada)');
    expect(await propios.count()).toBeGreaterThan(0);
    for (const aria of await propios.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))) {
      expect(aria).toMatch(/Consultorio 10\d/);
    }

    // Sin «Crear»: el botón no existe, y la nota explica por qué.
    const libre = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"]:not(.celda--atenuada)').first();
    await libre.click();
    await expect(page.getByTestId('agenda-panel')).toBeVisible();
    await expect(page.getByTestId('agenda-crear-cita')).toHaveCount(0);
    await expect(page.getByTestId('agenda-accion-waitlist')).toHaveCount(0);
    await expect(page.getByTestId('agenda-sin-crear')).toContainText('no incluye crear citas');
    await expect(page.getByTestId('agenda-accion-walk_in')).toBeVisible();
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-lucia-sin-crear.png' });
    await page.getByTestId('agenda-panel-cerrar').click();

    // Lo de otros pisos NO llega: la API solo devuelve lo que alguna acción de agenda del vínculo permite sobre esa cita.
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"].celda--atenuada')).toHaveCount(0);
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Consultorio 2"]')).toHaveCount(0);
    await page.context().close();
  });
});

test.describe('Marcos: Ecografía de todo el hospital y Suárez × Norte', () => {
  test('ve Antelo en la sala 201 y Suárez en Norte con acciones; Suárez en el Edificio B y Rojas no', async ({ browser }) => {
    const page = await entrar(browser, 'marcos');
    await irA(page, '/combined-agenda?vista=semana');

    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Lucía Antelo');
    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Martín Suárez');
    await expect(page.getByTestId('agenda-mis-doctores')).not.toContainText('Valeria Rojas');

    const eco = ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Antelo"][aria-label*="Sala 201"]:not(.celda--atenuada)');
    expect(await eco.count()).toBeGreaterThan(0);
    const norte = ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Suárez"][aria-label*="N102"]:not(.celda--atenuada)');
    expect(await norte.count()).toBeGreaterThan(0);
    // Suárez en el Edificio B no lo cubre ninguna acción: la API no devuelve esas filas, ni como bloques.
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Suárez"][aria-label*="B102"]')).toHaveCount(0);

    // Tiene «Crear» en lo que sí cubre; no tiene «Registrar llegada».
    await norte.filter({ has: page.locator('.celda__texto', { hasText: 'Libre' }) }).first().click();
    await expect(page.getByTestId('agenda-crear-cita')).toBeVisible();
    await page.getByTestId('agenda-panel-cerrar').click();

    // Línea de tiempo por servicio: la fila de Ecografía, con su ocupación.
    await page.locator('[data-testid="agenda-vista"] [data-value="TIMELINE"]').click();
    await page.locator('[data-testid="agenda-agrupar"] [data-value="SERVICE"]').click();
    await expect(page).toHaveURL(/vista=linea/);
    await expect(page).toHaveURL(/agrupar=servicio/);
    const fila = page.locator('.linea__fila', { hasText: 'Ecografía' }).first();
    await expect(fila).toBeVisible();
    await expect(fila.locator('[role="meter"]')).toBeVisible();
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-marcos-linea.png' });
    await page.context().close();
  });
});

test.describe('Elena: una sola agenda de dos organizaciones', () => {
  test('cada evento lleva la sigla de su organización y la acción dice en cuál se actúa', async ({ browser }) => {
    const page = await entrar(browser, 'elena');
    await irA(page, '/combined-agenda');
    await expect(page.getByTestId('agenda-organizacion')).toContainText('Todas mis organizaciones');
    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Andrés Pérez');
    await expect(page.getByTestId('agenda-mis-doctores')).toContainText('Paola Céspedes');
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Céspedes"] .celda__org').first()).toContainText('CPC');
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][aria-label*="Pérez"] .celda__org').first()).toContainText('HPM');
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-elena-dos-organizaciones.png' });

    const deCespedes = ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"][aria-label*="Céspedes"]:not(.celda--atenuada)').first();
    await deCespedes.click();
    await expect(page.getByTestId('panel-organizacion')).toContainText('Consultorio Dra. Paola Céspedes');
    await page.getByTestId('agenda-crear-cita').click();
    await page.getByTestId('buscador-texto').locator('input').fill('5000000');
    await page.getByTestId('buscador-buscar').click();
    await page.locator('[data-testid^="elegir-"]').first().click();
    await expect(page.getByTestId('agenda-confirmar-cita')).toContainText('Consultorio Dra. Paola Céspedes');
    await page.getByTestId('agenda-panel-cerrar').click();

    // Elegir una sola organización: la URL lo dice y la otra desaparece.
    await page.getByTestId('agenda-organizacion').click();
    await page.getByRole('option', { name: 'Consultorio Dra. Paola Céspedes' }).click();
    await expect(page).toHaveURL(/org=/);
    await expect(page.getByTestId('agenda-mis-doctores')).not.toContainText('Andrés Pérez');
    await expect(ENTRE_CIEN(page, '.celda__org')).toHaveCount(0);
    await page.context().close();
  });
});

test.describe('Estado en la URL y filtros', () => {
  test('los filtros viven en la URL: recargar los conserva, los chips los quitan uno a uno y «Limpiar todo» los quita todos', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, '/combined-agenda?vista=semana');
    await page.locator('[data-testid^="doctor-visible-"] ').nth(1).uncheck({ force: true });
    await page.getByTestId('agenda-ver-libres').uncheck();
    await expect(page.getByTestId('agenda-chips')).toContainText('Doctores: 1 de 2');
    await expect(page.getByTestId('agenda-chips')).toContainText('Sin horarios libres');
    await expect(page).toHaveURL(/ocultos=/);
    await expect(page).toHaveURL(/libres=0/);

    await page.reload();
    await expect(page.getByTestId('agenda-chips')).toContainText('Doctores: 1 de 2', { timeout: 30_000 });
    await expect(ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"]:not(.celda--atenuada)')).toHaveCount(0);

    await page.getByTestId('chip-free').getByRole('button').click();
    await expect(page.getByTestId('agenda-chips')).not.toContainText('Sin horarios libres');
    await page.getByTestId('agenda-limpiar').click();
    await expect(page.getByTestId('agenda-chips')).toHaveCount(0);
    await expect(page).not.toHaveURL(/ocultos=/);
    await expect(page).toHaveURL(/vista=semana/);
    await page.context().close();
  });

  test('la lista de ubicaciones filtra por consultorio y deja el chip', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, '/combined-agenda?vista=semana');
    await page.locator('[data-testid^="ubicacion-"]', { hasText: 'Consultorio 103' }).first().click();
    await expect(page.getByTestId('agenda-chips')).toContainText('Ubicación: Consultorio 103');
    const aria = await ENTRE_CIEN(page, '[data-testid^="item-"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expect(aria.length).toBeGreaterThan(0);
    for (const a of aria) expect(a).toMatch(/Consultorio 103/);
    await page.context().close();
  });
});

test.describe('El indicador de «ahora»', () => {
  test('aparece en la columna de hoy a la hora actual, en el día, en la semana y en la línea de tiempo', async ({ browser }) => {
    const page = await entrar(browser, 'ana', 1440, 900, alasOnce());
    await irA(page, '/combined-agenda');
    await expect(page.getByTestId('agenda-ahora').first()).toBeVisible();
    const marca = await page.getByTestId('agenda-ahora').first().boundingBox();
    const hora11 = await page.locator('.grid__hora', { hasText: '11:00' }).boundingBox();
    // Diez minutos después de las 11:00, por debajo de la marca de las 11:00 y a menos de una hora de ella.
    expect(marca!.y).toBeGreaterThan(hora11!.y);
    expect(marca!.y - hora11!.y).toBeLessThan(60);
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-ahora-dia.png' });

    await page.locator('[data-testid="agenda-vista"] [data-value="WEEK"]').click();
    await expect(page.getByTestId('agenda-ahora')).toHaveCount(1);
    await page.locator('[data-testid="agenda-vista"] [data-value="TIMELINE"]').click();
    await expect(page.locator('.linea__ahora').first()).toBeVisible();
    await page.context().close();
  });
});

test.describe('Línea de tiempo por recurso', () => {
  test('una fila por consultorio, con su ocupación y la franja de calor por hora', async ({ browser }) => {
    const page = await entrar(browser, 'ana');
    await irA(page, '/combined-agenda?vista=linea&agrupar=consultorio');
    await expect(page.locator('.linea__fila').first()).toBeVisible();
    const medidor = page.locator('[role="meter"]').first();
    await expect(medidor).toHaveAttribute('aria-valuenow', /\d+/);
    await expect(page.locator('.calor').first()).toBeVisible();
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-ana-linea.png' });
    await page.context().close();
  });
});

test.describe('Celular', () => {
  test('el día por doctor se desliza entre doctores y el panel sube desde abajo', async ({ browser }) => {
    const page = await entrar(browser, 'ana', 390, 844);
    await irA(page, '/combined-agenda');
    await expect(page.getByTestId('agenda-pestanas')).toBeVisible();
    const pestanas = page.locator('.pestana');
    await expect(pestanas).toHaveCount(2);
    await expect(pestanas.first()).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-movil-dia.png' });

    await pestanas.nth(1).click();
    await expect(pestanas.nth(1)).toHaveAttribute('aria-pressed', 'true');
    const scroller = page.getByTestId('agenda-grilla');
    await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-movil-segundo-doctor.png' });

    // Sin desbordar la página a lo ancho.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    await ENTRE_CIEN(page, '[data-testid^="item-"][data-estado="FREE"]:not(.celda--atenuada)').first().click();
    const panel = page.getByTestId('agenda-panel');
    await expect(panel).toBeVisible();
    const caja = (await panel.boundingBox())!;
    expect(caja.y + caja.height).toBeLessThanOrEqual(844 + 1);
    expect(caja.width).toBeGreaterThan(300);
    await page.screenshot({ path: 'artifacts/playwright/agenda-combinada-movil-panel.png' });
    await page.context().close();
  });
});
