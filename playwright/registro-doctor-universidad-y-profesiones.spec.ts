import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Alta de doctor — la universidad, el lugar de estudio y la segunda profesión.
 *
 * ## Qué afirma esto que las unitarias no pueden
 *
 * `register-practitioner.spec.ts` ya fija el comportamiento contra el
 * componente montado: que una fila guarde su universidad, que quitar una no
 * toque la de al lado, que nada de esto viaje en el alta. Nada de eso dice si
 * **en el navegador de verdad** los campos se ven, se pueden escribir, tienen
 * nombre accesible, conservan lo escrito al ir y volver de página, y entran en
 * un teléfono sin desbordar. Eso es geometría y recorrido, y sólo se comprueba
 * navegando.
 *
 * Lo que se prueba es el pedido del propietario, literal: elegir la universidad
 * y el lugar de estudio —país y ciudad—, y poder declarar **más de una
 * profesión**, «solo como un campo opcional cada uno con su respectiva
 * universidad, lugar de estudio y pdf de su diploma».
 *
 * ## No necesita backend
 *
 * El alta se completa entera sin enviar salvo en la prueba de opcionalidad, y
 * ahí el envío lo atiende la maqueta en memoria de esta rama. Por eso no hay
 * `test.skip` por API caída: no hay API de la que depender.
 */

/** Los tres campos de «Dónde lo estudiaste» del título con el que ejerce. */
const CAMPOS_DE_ESTUDIO = [
  { testId: 'registro-pro-titulo-universidad', nombre: 'Universidad' },
  { testId: 'registro-pro-titulo-pais', nombre: 'País de estudio' },
  { testId: 'registro-pro-titulo-ciudad', nombre: 'Ciudad de estudio' },
] as const;

/** El encabezado de la página que el motor está mostrando ahora. */
function encabezado(page: Page): Locator {
  return page.locator('.paginated-form__titulo');
}

/**
 * Un paso, con el título exacto de la página que sigue.
 *
 * Mismo criterio que `registro-persistencia.spec.ts`: se espera el botón
 * habilitado —el motor lo deshabilita mientras valida— y después el título que
 * corresponde, en vez de reintentar a ciegas. Un reintento ciego acá se comería
 * una página entera y la prueba fallaría lejos de lo que quiere decir.
 */
async function avanzar(page: Page, tituloSiguiente: string): Promise<void> {
  const continuar = page.getByTestId('paginated-form-continuar');
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await expect(encabezado(page)).toHaveText(tituloSiguiente, { timeout: 20_000 });
}

/**
 * Escribe la fecha en el campo enmascarado de `app-date-picker`.
 *
 * El tecleo dígito a dígito **no sirve acá**: se probó y la máscara devolvió
 * `01/MM/2051` —los dígitos caen según dónde quedó el cursor, y el repintado de
 * Angular lo mueve entre tecla y tecla—. `fill()` tampoco: de camino hace foco,
 * el foco reescribe el campo a `DD/MM/AAAA` (`ensureMask`), y el resultado
 * queda concatenado.
 *
 * Lo que sí funciona es el camino que el propio componente contempla para el
 * autocompletado del navegador (`handleTextInput`: diez caracteres y ninguna
 * letra de la máscara, y lo parsea entero): el valor ya formateado, escrito con
 * el setter nativo y anunciado con el mismo `input` que dispararía un pegado,
 * sin pasar por el foco. Es el mismo camino que documenta el helper de
 * `carril-14-crear-cita.spec.ts` después de descartar los otros dos.
 */
async function escribirFecha(page: Page, valor: string): Promise<void> {
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.evaluate((el: HTMLInputElement, texto: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, texto);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, valor);
  await expect(fecha).toHaveValue(valor);
}

/** El «Atrás» del motor, con el título de la página a la que se vuelve. */
async function retroceder(page: Page, tituloAnterior: string): Promise<void> {
  await page.getByTestId('paginated-form-atras').click();
  await expect(encabezado(page)).toHaveText(tituloAnterior, { timeout: 20_000 });
}

/**
 * Completa lo obligatorio hasta dejar la pantalla en «Tu título profesional y
 * foto», que es la primera de las dos páginas que esta suite mira.
 *
 * Se contesta sólo lo que el motor exige para dejar pasar: el resto queda
 * vacío a propósito, porque un alta llena de datos que no se afirman esconde
 * cuál de todos es el que sostiene la prueba.
 */
async function llegarAlTitulo(page: Page): Promise<void> {
  await page.goto('/auth/register/practitioner');
  await expect(page.getByTestId('registro-form-profesional')).toBeVisible();

  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await avanzar(page, 'Tu documento de identidad');

  await page.getByTestId('registro-pro-documento').fill('1234567');
  await page
    .getByTestId('registro-pro-departamento-ci')
    .locator('select')
    .selectOption({ index: 1 });
  await avanzar(page, 'Contanos un poco sobre vos');

  await page
    .getByTestId('registration-practitioner-sex')
    .locator('select')
    .selectOption({ label: 'Femenino' });
  await escribirFecha(page, '12/05/1985');
  await avanzar(page, 'Cómo te contactamos en privado');

  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill('ana.paz@example.test');
  await avanzar(page, 'El contacto de tu trabajo');

  // Trabajo, domicilio y consultorio son opcionales: se pasan de largo.
  await avanzar(page, '¿Dónde vivís?');
  await avanzar(page, 'Tu consultorio propio');
  await avanzar(page, 'Tu título profesional y foto');
}

/**
 * Elige el título profesional en la lupa: es lo único obligatorio del paso.
 *
 * El `data-testid` cae en el **host** `app-reference-combobox`, no en su
 * `<input>` —es la trampa que el CLAUDE.md del front deja avisada: `testId` y
 * `data-testid` caen en elementos distintos—, así que hay que bajar al control
 * por su rol. Un `fill()` sobre el host falla con «Element is not an <input>».
 */
async function elegirTituloProfesional(page: Page): Promise<void> {
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();
}

/** Deja la pantalla en «Tus títulos», que es la página de las profesiones. */
async function llegarALosTitulos(page: Page): Promise<void> {
  await llegarAlTitulo(page);
  await elegirTituloProfesional(page);
  await avanzar(page, 'Tu habilitación para ejercer');

  await page.getByTestId('registro-pro-matricula').fill('MP-12345');
  await page.getByTestId('registro-pro-credencial').fill('T.I. 538/14');
  await avanzar(page, 'Los respaldos de tu habilitación');
  await avanzar(page, 'Tus títulos');
}

/** Las casillas de texto de una fila de título, en orden: nombre, universidad, país, ciudad. */
function casillasDeLaFila(fila: Locator): Locator {
  return fila.locator('input[type="text"]');
}

/**
 * Comprueba las cuatro casillas de una fila, una por una.
 *
 * `toHaveValues` no sirve: es el matcher de un `<select multiple>`, y sobre
 * cuatro `<input>` distintos rompe por modo estricto. Acá se afirma cada
 * casilla por su posición, que además dice cuál falló cuando falla.
 */
async function esperarLaFila(fila: Locator, valores: readonly string[]): Promise<void> {
  const casillas = casillasDeLaFila(fila);
  await expect(casillas).toHaveCount(valores.length);
  for (const [posicion, valor] of valores.entries()) {
    await expect(casillas.nth(posicion)).toHaveValue(valor);
  }
}

test.describe('alta de doctor · universidad, lugar de estudio y segunda profesión', () => {
  test('el título con el que ejerce pregunta universidad, país y ciudad, y los tres son opcionales', async ({
    page,
  }) => {
    await llegarAlTitulo(page);

    // Existen, se ven y cada uno tiene nombre accesible propio: sin eso un
    // lector de pantalla anuncia tres cajas de texto sin decir cuál es cuál.
    for (const campo of CAMPOS_DE_ESTUDIO) {
      const caja = page.getByTestId(campo.testId);
      await expect(caja, `falta la casilla ${campo.nombre}`).toBeVisible();
      await expect(caja).toHaveAccessibleName(campo.nombre);
    }

    // Y son opcionales de verdad: sin escribir nada, el motor deja avanzar en
    // cuanto está el título, que es lo único obligatorio de esta página.
    await elegirTituloProfesional(page);
    await avanzar(page, 'Tu habilitación para ejercer');
    await retroceder(page, 'Tu título profesional y foto');

    // Lo escrito sobrevive a irse de la página y volver. Es lo que se rompe
    // solo cuando un campo proyectado no está atado a su `FormControl`: se ve
    // bien, se escribe bien, y al volver está vacío.
    await page.getByTestId('registro-pro-titulo-universidad').fill('Universidad Mayor de San Andrés');
    await page.getByTestId('registro-pro-titulo-pais').fill('Bolivia');
    await page.getByTestId('registro-pro-titulo-ciudad').fill('La Paz');

    await avanzar(page, 'Tu habilitación para ejercer');
    await retroceder(page, 'Tu título profesional y foto');

    await expect(page.getByTestId('registro-pro-titulo-universidad')).toHaveValue(
      'Universidad Mayor de San Andrés',
    );
    await expect(page.getByTestId('registro-pro-titulo-pais')).toHaveValue('Bolivia');
    await expect(page.getByTestId('registro-pro-titulo-ciudad')).toHaveValue('La Paz');
  });

  test('se declaran dos profesiones y cada una lleva su universidad, su lugar de estudio y su diploma', async ({
    page,
  }) => {
    await llegarALosTitulos(page);

    // La sección es «Otra profesión», no «Título profesional universitario»:
    // la profesión con la que ejerce ya se eligió, obligatoria, en el paso del
    // título. Este es el lugar de la segunda carrera.
    await expect(
      page.getByRole('heading', { name: 'Otra profesión', level: 3 }),
    ).toBeVisible();

    const agregar = page.getByTestId('registro-pro-agregar-UNIVERSITARIO');
    await expect(agregar).toHaveText('+ Agregar otra profesión');

    const filas = page.getByTestId('registro-pro-fila-UNIVERSITARIO');
    await expect(filas).toHaveCount(0);

    await agregar.click();
    await agregar.click();
    await expect(filas).toHaveCount(2);

    const primera = ['Medicina', 'Universidad Mayor de San Andrés', 'Bolivia', 'La Paz'];
    const segunda = [
      'Ingeniería de Sistemas',
      'Universidad Privada Boliviana',
      'Bolivia',
      'Cochabamba',
    ];

    for (const [indice, valores] of [primera, segunda].entries()) {
      const casillas = casillasDeLaFila(filas.nth(indice));
      await expect(casillas).toHaveCount(4);
      for (const [posicion, valor] of valores.entries()) {
        await casillas.nth(posicion).fill(valor);
      }
    }

    // El diploma de cada una es suyo: se adjunta a la segunda y la primera
    // queda sin archivo. Es la trampa que el pedido nombra —«cada uno con …
    // pdf de su diploma»— y la que rompe una lista con un solo adjunto global.
    await filas
      .nth(1)
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'sistemas.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 diploma de prueba'),
      });

    await expect(filas.nth(1)).toContainText('sistemas.pdf');
    await expect(filas.nth(0)).not.toContainText('sistemas.pdf');
    await expect(filas.nth(0).getByText('Adjuntar archivo')).toBeVisible();

    // Y ninguna se pisó con la otra.
    await esperarLaFila(filas.nth(0), primera);
    await esperarLaFila(filas.nth(1), segunda);

    // Quitar una se lleva lo suyo y deja intacta la que queda.
    await filas.nth(0).getByRole('button', { name: 'Quitar otra profesión' }).click();
    await expect(filas).toHaveCount(1);
    await esperarLaFila(filas.nth(0), segunda);
    await expect(filas.nth(0)).toContainText('sistemas.pdf');
  });

  test('ninguna profesión extra es obligatoria: el alta se completa sin cargar una sola', async ({
    page,
  }) => {
    await llegarALosTitulos(page);

    await expect(page.getByTestId('registro-pro-fila-UNIVERSITARIO')).toHaveCount(0);

    await avanzar(page, 'Tus especialidades');
    await avanzar(page, 'Tu contraseña');

    await page.getByTestId('registro-pro-password').fill('secreto12');
    const enviar = page.getByTestId('paginated-form-continuar');
    await expect(enviar).toHaveText(/Crear cuenta/);
    await enviar.click();

    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
  });

  test('en un teléfono las casillas se apilan y la página no desborda a lo ancho', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await llegarALosTitulos(page);

    const agregar = page.getByTestId('registro-pro-agregar-UNIVERSITARIO');
    await agregar.click();

    const casillas = casillasDeLaFila(page.getByTestId('registro-pro-fila-UNIVERSITARIO').first());
    await expect(casillas).toHaveCount(4);

    // Apiladas: cada casilla empieza más abajo que la anterior, y ninguna
    // comparte renglón. En 390 px cuatro campos en línea son ilegibles.
    const cajas = await casillas.evaluateAll((nodos) =>
      nodos.map((n) => n.getBoundingClientRect()).map((r) => ({ y: r.y, ancho: r.width })),
    );
    for (const [indice, caja] of cajas.entries()) {
      if (indice > 0) expect(caja.y).toBeGreaterThan(cajas[indice - 1].y);
      expect(caja.ancho).toBeLessThanOrEqual(390);
    }

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(desborda, 'la página no debe desplazarse a lo ancho en 390 px').toBe(false);

    await page.screenshot({
      path: 'artifacts/playwright/registro-doctor-profesiones-movil.png',
      fullPage: true,
    });
  });
});
