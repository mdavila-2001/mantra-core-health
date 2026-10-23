import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista } from './support/sesion';
import { entrarAlSimulador } from './support/simulador';

/**
 * Kill-tests del documento «CORRECCIONES» del 2026-10-23.
 *
 * Una prueba por punto verificable del cliente. **Hoy están en rojo a
 * propósito**: cada una afirma el comportamiento que el cliente pide y falla
 * por el motivo que describe `VERIFICACION-CONTRA-CODIGO-2026-10-23.md` del
 * repo del estándar. La regla es una sola: se corrige el producto hasta que la
 * prueba pase; **la aserción no se toca**. Si una aserción está mal escrita,
 * se corrige con justificación en el PR y se declara.
 *
 * El título lleva el ID del cliente y dos etiquetas: el carril
 * (`@carril-1|2|3`) y la persona (`@leo`, `@richard`, `@pablo`, `@justin`,
 * `@ender`, `@itzan`). Cada persona corre su `--grep` en la Ola 0 (baseline,
 * todo rojo) y en la Ola 3 (cierre, todo verde).
 *
 * ## Contra qué corre
 *
 * - **API real** (lo que vale para cerrar): `corepack yarn start:real-api` con
 *   la API y las cuentas E2E sembradas, y las variables `E2E_MODE=real`,
 *   `E2E_<ROL>_EMAIL` / `E2E_<ROL>_PASSWORD` para `PATIENT`, `DOCTOR`, `ADMIN`,
 *   `PHARMACY`, `LAB`.
 * - **Simulador** (sólo orientativo, `VERIFIED_FUNCTIONAL_ONLY` como mucho):
 *   `corepack yarn start:demo`; entra con las cuentas `*@alovida.mock`.
 *
 * Sin `waitForTimeout`, sin `skip`: una precondición ausente (por ejemplo, no
 * hay orden de laboratorio para el paciente) falla con un mensaje que lo dice.
 */

type Rol = 'paciente' | 'medica' | 'admin' | 'farmacia' | 'laboratorio';

const CUENTAS_SIMULADOR: Record<Rol, string> = {
  paciente: 'paciente',
  medica: 'medica',
  admin: 'administrador',
  farmacia: 'farmacia',
  laboratorio: 'laboratorio',
};

const VARIABLES_REALES: Record<Rol, { email: string; clave: string }> = {
  paciente: { email: 'E2E_PATIENT_EMAIL', clave: 'E2E_PATIENT_PASSWORD' },
  medica: { email: 'E2E_DOCTOR_EMAIL', clave: 'E2E_DOCTOR_PASSWORD' },
  admin: { email: 'E2E_ADMIN_EMAIL', clave: 'E2E_ADMIN_PASSWORD' },
  farmacia: { email: 'E2E_PHARMACY_EMAIL', clave: 'E2E_PHARMACY_PASSWORD' },
  laboratorio: { email: 'E2E_LAB_EMAIL', clave: 'E2E_LAB_PASSWORD' },
};

const MODO_REAL = process.env['E2E_MODE'] === 'real';

async function entrarComo(page: Page, rol: Rol): Promise<void> {
  if (MODO_REAL) {
    const nombres = VARIABLES_REALES[rol];
    const identificador = process.env[nombres.email];
    const clave = process.env[nombres.clave];
    expect(
      identificador && clave,
      `Falta ${nombres.email} / ${nombres.clave} para entrar como ${rol} contra la API real`,
    ).toBeTruthy();
    const actor: Actor = {
      rol: rol as unknown as Actor['rol'],
      identificador: identificador!,
      clave: clave!,
      nombre: rol,
    };
    await entrar(page, actor);
    return;
  }
  const base = new URL(page.url() === 'about:blank' ? 'http://localhost:4200' : page.url()).origin;
  await entrarAlSimulador(page, CUENTAS_SIMULADOR[rol], base);
}

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await esperarAplicacionLista(page);
}

/**
 * Espera a que la cabecera del panel esté pintada antes de afirmar que un
 * control **no** está. `toHaveCount(0)` pasa al instante sobre una página que
 * todavía no renderizó la cabecera: eso sería un verde falso, no una prueba.
 */
async function cabeceraPintada(page: Page): Promise<void> {
  await expect(page.getByTestId('header-ajustes')).toBeVisible();
  await expect(page.getByTestId('header-cuenta')).toBeVisible();
}

/** La región principal de la pantalla, donde viven las tarjetas y las tablas. */
function principal(page: Page) {
  return page.getByRole('main');
}

// ---------------------------------------------------------------------------
// Carril 1 · Paciente — Leo
// ---------------------------------------------------------------------------

test.describe('@carril-1 @leo', () => {
  test('PA-01 el paciente ve el estado de su verificación de identidad y la próxima acción', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/identity');
    const estado = page.getByTestId('identidad-estado');
    await expect(estado, 'Falta la tarjeta de estado del caso (PA-01, L-H2.S4)').toBeVisible();
    await expect(estado).toContainText(/en revisión|validada|rechazad|sin verificar/i);
  });

  test('PA-01 el administrador acepta o rechaza la identidad con un botón, sin pegar UUIDs', async ({ page }) => {
    await entrarComo(page, 'admin');
    await abrir(page, '/administration/identity-assurance/queue');
    const fila = page.getByRole('row').filter({ hasText: /revisi|verificaci|pendiente/i }).first();
    await expect(fila, 'No hay casos en la cola: sembrar un caso de KYC antes de correr esta prueba').toBeVisible();
    await fila.getByRole('link').first().click();
    await esperarAplicacionLista(page);
    await expect(page.getByRole('button', { name: /aceptar identidad/i }), 'Falta el botón «Aceptar identidad» en el caso (PA-01, L-H2.S3)').toBeVisible();
    await expect(page.getByRole('button', { name: /rechazar/i })).toBeVisible();
  });

  test('PA-03.a la cabecera no tiene el botón de emergencia', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    await cabeceraPintada(page);
    await expect(page.getByTestId('boton-emergencia')).toHaveCount(0);
  });

  test('PA-03.b Tutoriales vive dentro de Ajustes y la ruta vieja redirige', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    await cabeceraPintada(page);
    await expect(page.getByTestId('header-tutoriales')).toHaveCount(0);
    await abrir(page, '/tutorials');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('tab', { name: /tutoriales/i })).toBeVisible();
  });

  test('PA-03.c Mis facturas es la pestaña «Resumen» de Mis gastos para el paciente', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    await cabeceraPintada(page);
    await expect(page.getByTestId('header-facturas')).toHaveCount(0);
    await abrir(page, '/my-account/invoices');
    await expect(page).toHaveURL(/\/my-account\/spending/);
    await expect(page.getByRole('tab', { name: /resumen/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /movimientos/i })).toBeVisible();
  });

  test('PA-03.d Promociones vive dentro del Carrito y no tiene el mapa', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    await cabeceraPintada(page);
    await expect(page.getByTestId('header-promociones')).toHaveCount(0);
    await abrir(page, '/my-account/promotions');
    await expect(page).toHaveURL(/\/my-account\/pharmacy\/cart/);
    const promociones = page.getByRole('tab', { name: /promociones/i });
    await expect(promociones, 'El carrito no tiene la pestaña «Promociones» (PA-03.d, L-H3.S4)').toBeVisible();
    await promociones.click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByTestId('promociones-mapa')).toHaveCount(0);
    await expect(page.locator('app-department-map')).toHaveCount(0);
  });

  test('PA-08 la tabla de permisos muestra sección de la historia, sistema del cuerpo y motivo', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/permissions');
    const tabla = principal(page).getByRole('table');
    await expect(tabla, 'Falta la tabla de permisos (PA-08, L-H4)').toBeVisible();
    for (const columna of [/médic|profesional/i, /secci/i, /sistema/i, /fase/i, /estado/i, /motivo/i]) {
      await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
    }
  });

  test('PA-08 rechazar un permiso exige motivo', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/permissions');
    const rechazar = principal(page).getByRole('button', { name: /rechazar/i }).first();
    await expect(rechazar, 'No hay pedidos pendientes: sembrar un pedido de acceso antes de correr esta prueba').toBeVisible();
    await rechazar.click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('button', { name: /confirmar|rechazar/i })).toBeDisabled();
  });

  test('PA-09.a la orientación del triage no ofrece «Recomendar medicamentos»', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    const texto = page.getByTestId('sintomas-texto').locator('textarea');
    await expect(texto, 'El inicio del paciente no muestra el triage con su área de texto').toBeVisible();
    await texto.fill('me duele la cabeza desde hace dos días');
    await expect(page.getByTestId('sintomas-orientacion-header'), 'El triage no produjo orientación para el texto').toBeVisible();
    await expect(page.getByTestId('sintomas-tab-especialidades')).toBeVisible();
    await expect(page.getByTestId('sintomas-boton-recomendar-medicamentos')).toHaveCount(0);
    await expect(page.getByTestId('sintomas-medicamentos-seccion')).toHaveCount(0);
  });

  test('PA-12 el buzón de encuestas está en el menú y agrupa por tipo de partner', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/dashboard');
    const enlace = page.getByRole('navigation').getByRole('link', { name: /encuestas/i });
    await expect(enlace, 'El buzón de encuestas no está en el menú (PA-12, L-H7)').toBeVisible();
    await enlace.click();
    await esperarAplicacionLista(page);
    await expect(principal(page).getByRole('heading', { name: /médico|farmacia|laboratorio|imagenolog|aseguradora/i }).first()).toBeVisible();
  });

  test('PA-05 un enlace /rx sin sesión pide iniciar sesión y recuerda a dónde volver', async ({ page }) => {
    await abrir(page, '/rx/token-de-prueba-sin-sesion');
    await expect(page).toHaveURL(/\/auth\?.*next=%2Frx%2F/);
    await expect(principal(page).getByText(/receta|medicamento/i)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Carril 1 · Paciente — Richard
// ---------------------------------------------------------------------------

test.describe('@carril-1 @richard', () => {
  test('PA-02 el paciente ve su cobertura y la tabla de solicitudes de aprobación', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/coverage');
    await expect(page.getByRole('tab', { name: /mi cobertura/i })).toBeVisible();
    await page.getByRole('tab', { name: /solicitudes/i }).click();
    const tabla = principal(page).getByRole('table');
    await expect(tabla).toBeVisible();
    for (const columna of [/servicio/i, /prestador/i, /cubierto|%/i, /mi parte|tu parte/i, /estado/i, /motivo/i]) {
      await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
    }
  });

  test('PA-04 la pantalla de pago muestra el QR de la sede, el comprobante y «Pagué en efectivo»', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/appointments');
    const pagar = principal(page).getByRole('link', { name: /^pagar/i }).or(principal(page).getByRole('button', { name: /^pagar/i })).first();
    await expect(pagar, 'No hay cargos pendientes de pago para este paciente: sembrar una consulta iniciada antes de correr esta prueba').toBeVisible();
    await pagar.click();
    await esperarAplicacionLista(page);
    await expect(page).toHaveURL(/\/my-account\/pay\//);
    await expect(principal(page).getByText(/tu parte/i)).toBeVisible();
    await expect(principal(page).getByRole('img', { name: /qr/i })).toBeVisible();
    await expect(principal(page).getByRole('button', { name: /subir comprobante/i })).toBeVisible();
    await expect(principal(page).getByRole('button', { name: /pagué en efectivo/i })).toBeVisible();
  });

  test('PA-09.b los directorios no tienen el mapa de Bolivia y vienen prefiltrados por ubicación', async ({ page }) => {
    await entrarComo(page, 'paciente');
    for (const ruta of ['/clinics-directory', '/pharmacies-directory', '/insurers-directory', '/laboratory-directory']) {
      await abrir(page, ruta);
      await expect(page.locator('app-directory-page'), `${ruta} no pintó el directorio`).toBeVisible();
      await expect(page.locator('app-department-map'), `${ruta} todavía tiene el mapa de Bolivia (PA-09.b)`).toHaveCount(0);
      await expect(principal(page).getByText(/departamento/i).first()).toBeVisible();
    }
  });

  test('PA-11 el directorio de médicos tiene filtros de ubicación y calificación y selector de orden', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/directory');
    await expect(principal(page).getByLabel(/departamento/i)).toBeVisible();
    await expect(principal(page).getByLabel(/municipio/i)).toBeVisible();
    await expect(principal(page).getByLabel(/calificaci/i)).toBeVisible();
    await expect(principal(page).getByLabel(/ordenar/i)).toBeVisible();
  });

  test('PA-10 las promociones se filtran por tipo de partner', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/pharmacy/cart?pestana=promociones');
    for (const partner of [/médic/i, /imagenolog/i, /laboratorio/i, /farmacia/i, /aseguradora/i]) {
      await expect(principal(page).getByRole('button', { name: partner }).or(principal(page).getByRole('checkbox', { name: partner })).first()).toBeVisible();
    }
  });

  test('PA-07 «Reservar hora» desde una orden lleva la orden a la reserva', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/diagnostic-orders');
    const reservar = principal(page).getByRole('link', { name: /reservar hora/i }).first();
    await expect(reservar, 'El paciente no tiene órdenes: sembrar una orden de laboratorio antes de correr esta prueba').toBeVisible();
    await expect(reservar).toHaveAttribute('href', /orden=/);
  });

  test('MD-10 el paciente puede mover su cita desde el portal', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/my-account/appointments');
    const cancelar = principal(page).getByRole('button', { name: /cancelar/i }).first();
    await expect(cancelar, 'El paciente no tiene citas: sembrar una cita confirmada antes de correr esta prueba').toBeVisible();
    await expect(principal(page).getByRole('button', { name: /^mover/i }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Carril 2 · Doctor — Pablo
// ---------------------------------------------------------------------------

test.describe('@carril-2 @pablo', () => {
  test('MD-06 la facturación tiene la tabla de pagos por sesión con su estado', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/billing');
    const pestana = page.getByRole('tab', { name: /pagos por sesión/i });
    await expect(pestana, 'Falta la pestaña «Pagos por sesión» en /billing (MD-06, P-H2.S3)').toBeVisible();
    await pestana.click();
    const tabla = principal(page).getByRole('table');
    await expect(tabla).toBeVisible();
    for (const columna of [/paciente/i, /monto/i, /seguro/i, /estado/i, /comprobante/i]) {
      await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
    }
  });

  test('MD-01 el alta del médico avisa si el documento ya está registrado por otro médico', async ({ page }) => {
    await abrir(page, '/auth/register/practitioner');
    const documento = page.getByLabel(/cédula de identidad|número de documento/i).first();
    for (let paso = 0; paso < 6 && (await documento.count()) === 0; paso += 1) {
      const siguiente = page.getByRole('button', { name: /siguiente|continuar/i }).first();
      if ((await siguiente.count()) === 0) break;
      await siguiente.click();
    }
    await expect(documento, 'No se encontró el campo «Cédula de identidad» en el alta del médico').toBeVisible();
    await documento.fill('1234567');
    await documento.blur();
    await expect(page.getByTestId('documento-disponibilidad'), 'Falta el validador de disponibilidad del documento (MD-01, P-H3)').toBeVisible();
  });

  test('MD-02 el alta del médico pide la matrícula del Colegio', async ({ page }) => {
    await abrir(page, '/auth/register/practitioner');
    await expect(page.getByLabel(/matrícula del colegio/i)).toBeVisible();
  });

  test('MD-03 el médico tiene una bandeja de sus pedidos de acceso con estado por sección', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/access-inbox');
    const tabla = principal(page).getByRole('table');
    await expect(tabla, 'Falta la bandeja del médico (MD-03, P-H5)').toBeVisible();
    for (const columna of [/paciente/i, /secci/i, /estado/i, /motivo/i]) {
      await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
    }
  });

  test('MD-05.a el constructor de formularios tiene un botón Guardar explícito', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/form-builder');
    await expect(page.getByTestId('form-builder-guardar')).toBeVisible();
  });

  test('MD-05.c el constructor tiene el toggle Médico – Marketing arriba a la derecha', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/form-builder');
    const toggle = page.getByTestId('modo-medico-marketing');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText(/médico/i);
    await expect(toggle).toContainText(/marketing/i);
  });

  test('MD-05.b en modo marketing hay preguntas de escala de Likert', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/questionnaires');
    const primera = principal(page).getByRole('link').filter({ hasText: /./ }).first();
    await expect(primera, 'No hay encuestas: crear una antes de correr esta prueba').toBeVisible();
    await primera.click();
    await esperarAplicacionLista(page);
    const toggle = page.getByTestId('modo-medico-marketing');
    await expect(toggle, 'Falta el toggle Médico – Marketing en el editor de encuestas (MD-05.c)').toBeVisible();
    await toggle.getByRole('radio', { name: /marketing/i }).check();
    const agregar = page.getByRole('button', { name: /agregar pregunta|nueva pregunta/i });
    await expect(agregar).toBeVisible();
    await agregar.click();
    await expect(page.getByTestId('tipo-pregunta-likert')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Carril 2 · Doctor — Justin
// ---------------------------------------------------------------------------

test.describe('@carril-2 @justin', () => {
  test('MD-09 los bloqueos listan todas las sedes y se filtran por sede', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/schedule/blocks');
    await expect(principal(page).getByLabel(/sede/i)).toBeVisible();
    await expect(page.getByTestId('bloqueo-sede').first()).toBeVisible();
  });

  test('MD-09 la semana no pinta el día entero por un bloqueo parcial', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/schedule?vista=consultas&calendario=semana');
    const bloqueo = page.getByTestId('semana-bloqueo').first();
    await expect(bloqueo, 'No hay bloqueos esta semana: crear uno parcial antes de correr esta prueba').toBeVisible();
    await expect(bloqueo).toContainText(/\d{2}:\d{2}/);
  });

  test('MD-04 existe la línea de tiempo multi-sede y multi-servicio', async ({ page }) => {
    await entrarComo(page, 'medica');
    await abrir(page, '/schedule?vista=linea');
    const linea = page.getByTestId('linea-de-tiempo');
    await expect(linea).toBeVisible();
    await expect(linea.getByRole('rowheader').first()).toBeVisible();
    await expect(page.getByRole('table', { name: /línea de tiempo/i })).toBeVisible();
  });

  test('MD-10 la reserva de mostrador del médico no devuelve 403 y avisa al paciente', async ({ page }) => {
    const rechazos: string[] = [];
    page.on('response', (respuesta) => {
      if (/\/scheduling\/(slots|holds)/.test(respuesta.url()) && respuesta.status() === 403) {
        rechazos.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });
    await entrarComo(page, 'medica');
    await abrir(page, '/schedule?vista=cupos');
    const cupo = principal(page).getByRole('link', { name: /reservar/i }).first();
    await expect(cupo, 'No hay cupos libres: generar cupos antes de correr esta prueba').toBeVisible();
    await cupo.click();
    await esperarAplicacionLista(page);
    await expect(page).toHaveURL(/\/schedule\/book\//);
    const confirmar = page.getByRole('button', { name: /confirmar/i });
    await expect(confirmar).toBeVisible();
    await confirmar.click();
    await expect(principal(page).getByText(/se avisó al paciente/i)).toBeVisible();
    expect(rechazos, 'La API rechazó al médico con 403 (AG-03)').toEqual([]);
  });

  test('MD-07 la barra de filtros del glosario queda fija y las categorías no desaparecen al buscar', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/glossary?q=hipertension');
    const filtros = page.getByTestId('glosario-filtros');
    await expect(filtros).toBeVisible();
    await expect(filtros).toHaveCSS('position', 'sticky');
    await expect(page.getByTestId('glosario-categorias')).toBeVisible();
    await expect(page.getByTestId('glosario-conteo')).toBeVisible();
  });

  test('MD-07 un término del atlas muestra artículo con fuente e imagen con licencia', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/glossary/hipertension-arterial');
    const articulo = page.getByRole('tab', { name: /artículo/i });
    await expect(articulo, 'El término no tiene pestaña «Artículo»: el atlas no llegó a este término (MD-07)').toBeVisible();
    await articulo.click();
    await expect(principal(page).getByText(/fuente:/i).first()).toBeVisible();
    const imagen = principal(page).getByRole('img').first();
    await expect(imagen).toBeVisible();
    await expect(principal(page).getByText(/licencia|cc by|dominio público/i).first()).toBeVisible();
  });

  test('MD-08 el mapa de relaciones del término dice de dónde sale cada relación', async ({ page }) => {
    await entrarComo(page, 'paciente');
    await abrir(page, '/glossary/hipertension-arterial');
    const relacion = page.getByTestId('relacion-fuente').first();
    await expect(relacion, 'Las relaciones no muestran su procedencia (MD-08, J-H7)').toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Carril 3 · Farmacia — Ender
// ---------------------------------------------------------------------------

test.describe('@carril-3 @ender', () => {
  test('PA-05 la farmacia tiene una bandeja de recetas cargadas con «Escanear receta»', async ({ page }) => {
    await entrarComo(page, 'farmacia');
    await abrir(page, '/administration/pharmacy/prescription-loads');
    await expect(principal(page).getByRole('button', { name: /escanear receta/i })).toBeVisible();
    await expect(principal(page).getByRole('table')).toBeVisible();
  });

  test('PA-06 el inventario del ERP muestra el estado del sistema de farmacia externo', async ({ page }) => {
    await entrarComo(page, 'farmacia');
    await abrir(page, '/administration/pharmacy?pestana=inventario');
    await expect(principal(page).getByText(/sistema externo/i)).toBeVisible();
    await expect(principal(page).getByText(/último sync|última sincronización/i)).toBeVisible();
  });

  test('FA-01 cada pestaña del ERP tiene «Importar» y acepta CSV y XLSX', async ({ page }) => {
    await entrarComo(page, 'farmacia');
    for (const pestana of ['productos', 'categorias', 'precios', 'inventario']) {
      await abrir(page, `/administration/pharmacy?pestana=${pestana}`);
      const importar = principal(page).getByRole('button', { name: /importar/i });
      await expect(importar, `La pestaña ${pestana} no tiene «Importar» (FA-01)`).toBeVisible();
      await importar.click();
      const archivo = page.getByRole('dialog').locator('input[type="file"]');
      await expect(archivo).toHaveAttribute('accept', /xlsx/);
      await expect(archivo).toHaveAttribute('accept', /csv/);
      await page.keyboard.press('Escape');
    }
  });

  test('FA-02 el catálogo de farmacia es una sola pantalla con cuatro pestañas y las rutas viejas redirigen', async ({ page }) => {
    await entrarComo(page, 'farmacia');
    await abrir(page, '/administration/pharmacy');
    for (const pestana of [/productos/i, /categorías/i, /precios/i, /inventario/i]) {
      await expect(page.getByRole('tab', { name: pestana })).toBeVisible();
    }
    await abrir(page, '/administration/pharmacy-categories');
    await expect(page).toHaveURL(/\/administration\/pharmacy\?pestana=categorias/);
    await abrir(page, '/administration/pharmacy-prices');
    await expect(page).toHaveURL(/\/administration\/pharmacy\?pestana=precios/);
  });
});

// ---------------------------------------------------------------------------
// Carril 3 · Laboratorio e imagenología — Itzan
// ---------------------------------------------------------------------------

test.describe('@carril-3 @itzan', () => {
  test('LI-01 la pantalla de órdenes tiene «Crear instancia de servicio» y las cinco columnas', async ({ page }) => {
    await entrarComo(page, 'laboratorio');
    await abrir(page, '/administration/laboratory');
    const crear = principal(page).getByRole('button', { name: /crear instancia de servicio/i });
    await expect(crear).toBeVisible();
    const tabla = principal(page).getByRole('table');
    await expect(tabla).toBeVisible();
    for (const columna of [/paciente/i, /estudio/i, /fecha/i, /estado/i, /acciones/i]) {
      await expect(tabla.getByRole('columnheader', { name: columna })).toBeVisible();
    }
  });

  test('LI-01 los estados son INICIADA, RECIBIDA, EN PROCESO, RECHAZADA y CONFIRMADO', async ({ page }) => {
    await entrarComo(page, 'laboratorio');
    await abrir(page, '/administration/laboratory');
    const filtro = principal(page).getByLabel(/estado/i);
    await expect(filtro).toBeVisible();
    for (const estado of [/iniciada/i, /recibida/i, /en proceso/i, /rechazada/i, /confirmado/i]) {
      await expect(filtro.getByRole('option', { name: estado }).or(page.getByRole('option', { name: estado }))).toHaveCount(1);
    }
  });

  test('LI-01 una orden confirmada no deja borrar ni subir resultados', async ({ page }) => {
    await entrarComo(page, 'laboratorio');
    await abrir(page, '/administration/laboratory?estado=confirmado');
    const fila = principal(page).getByRole('row').filter({ hasText: /confirmado/i }).first();
    await expect(fila, 'No hay órdenes confirmadas: confirmar una antes de correr esta prueba').toBeVisible();
    await expect(fila.getByRole('button', { name: /subir resultados/i })).toHaveCount(0);
    await expect(fila.getByRole('button', { name: /descargar/i })).toBeVisible();
  });

  test('LI-02 el catálogo de servicios del centro tiene alta, edición e importación masiva', async ({ page }) => {
    await entrarComo(page, 'laboratorio');
    await abrir(page, '/administration/laboratory-services');
    await expect(principal(page).getByRole('button', { name: /nuevo servicio/i })).toBeVisible();
    await expect(principal(page).getByRole('button', { name: /importar/i })).toBeVisible();
    await expect(principal(page).getByRole('button', { name: /editar/i }).first()).toBeVisible();
  });

  test('LI-03 el perfil del centro tiene Identidad, Operación, Legal, Gerentes y Acreditaciones', async ({ page }) => {
    await entrarComo(page, 'laboratorio');
    await abrir(page, '/my-account');
    for (const pestana of [/identidad/i, /operaci/i, /legal/i, /gerentes/i, /acreditaciones/i]) {
      await expect(page.getByRole('tab', { name: pestana }), 'El perfil del laboratorio sigue siendo la tarjeta de tres campos (LI-03)').toBeVisible();
    }
  });

  test('PA-07 un enlace /orden sin sesión pide iniciar sesión y recuerda a dónde volver', async ({ page }) => {
    await abrir(page, '/orden/token-de-prueba-sin-sesion');
    await expect(page).toHaveURL(/\/auth\?.*next=%2Forden%2F/);
  });
});
