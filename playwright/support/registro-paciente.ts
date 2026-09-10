import { expect, type Page } from '@playwright/test';

/**
 * Helpers compartidos del alta pública de paciente (`/auth/register/patient`),
 * usados por `registro-empresa-y-mapa.spec.ts` y `registro-persistencia.spec.ts`.
 *
 * Viven en `support/` y no en un archivo `.spec.ts` porque un `.spec.ts`
 * importado por otro vuelve a registrar sus propios `test.describe` en quien
 * lo importa — el runner de Playwright trata cada import como código de
 * módulo normal, no como "sólo funciones". `support/` es exactamente para
 * evitar esa trampa (ver el resto de archivos de esta carpeta).
 */

/**
 * Completa la primera página —lo único obligatorio del alta— y avanza.
 *
 * El motor valida de a una página, así que sin esto el «Siguiente» no mueve
 * nada y la prueba fallaría lejos de lo que quiere comprobar.
 *
 * `documento` es parametrizable porque `registro-persistencia.spec.ts` envía
 * un alta real al backend y necesita un CI único por corrida (dos altas con
 * el mismo documento chocan con 409); las pruebas que nunca llegan a enviar
 * el formulario siguen usando el valor fijo por defecto.
 */
export async function empezarElAlta(page: Page, documento = '9876543'): Promise<void> {
  await page.goto('/auth/register/patient');
  await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

  // Orden de la fuente literal de FT-03: nombres y apellidos primero,
  // documento después. El motor valida de a una página, asi que sin completar
  // el nombre el «Siguiente» no mueve nada y la prueba fallaria lejos de lo
  // que quiere comprobar.
  await page.getByTestId('registro-nombre').fill('Ana');
  await page.getByTestId('registro-apellido-paterno').fill('Paz');
  await page.getByTestId('paginated-form-continuar').click();

  await page.getByTestId('registro-documento').fill(documento);
  // El departamento que expidió la cédula pasó a ser OBLIGATORIO (commit
  // b300ade, «el departamento de emisión se ve —y es— obligatorio»). Sin esto
  // el motor no deja pasar de página, y la suite se colgaba mucho más adelante
  // esperando el campo de fecha de nacimiento, que nunca llegaba a dibujarse:
  // un fallo que no decía nada de su causa.
  await page
    .getByTestId('registro-departamento-ci')
    .locator('select')
    .selectOption({ index: 1 });
  await page.getByTestId('paginated-form-continuar').click();

  // La página «Contanos un poco sobre vos» exige fecha de nacimiento y sexo
  // (FT-03-R03: son dos de los seis campos obligatorios del alta), así que el
  // motor no deja avanzar sin llenarlos primero.
  //
  // `app-date-picker` es un input enmascarado que arma DD/MM/AAAA dígito por
  // dígito según la posición del cursor (ver `handleDigitKey`): un `.fill()`
  // escribe el valor de un tirón sin pasar por esa máscara y deja el campo
  // inválido («01/01/1990DD/MM/AAAA»). Al enfocarlo la máscara escribe la
  // plantilla como valor, así que hay que borrarla antes de teclear —mismo
  // patrón que ya usa playwright/it1-perfil-paciente-libre.spec.ts para este
  // mismo componente— y sólo entonces `pressSequentially` dígito por dígito,
  // que es como la máscara espera recibirlos.
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await fecha.pressSequentially('01011990', { delay: 20 });
  await page.getByTestId('registro-genero').locator('select').selectOption({ label: 'Masculino' });
  await page.getByTestId('paginated-form-continuar').click();

  // «¿Cómo te contactamos?» exige el celular (también obligatorio); el
  // contacto de emergencia es opcional y se deja vacío.
  await page.getByTestId('registro-telefono').fill('70012345');
  await page.getByTestId('paginated-form-continuar').click();
}

/**
 * Avanza hasta la página cuyo titular se pasa, sin pasarse de largo.
 *
 * Espera a que «Siguiente»/«Crear cuenta» esté habilitado antes de cada clic:
 * el botón queda `aria-disabled`/`btn--loading` mientras el motor valida la
 * página actual (o, en la última, mientras el alta viaja al backend), y
 * clickearlo mientras tanto es clickear un botón que todavía no va a hacer
 * nada — o, peor, que puede quedar en un estado inestable a medio repintar.
 */
export async function avanzarHasta(page: Page, titulo: string): Promise<void> {
  const encabezado = page.getByRole('heading', { name: titulo });
  const boton = page.getByTestId('paginated-form-continuar');
  for (let paso = 0; paso < 8; paso += 1) {
    if (await encabezado.isVisible().catch(() => false)) return;
    await expect(boton).toBeEnabled({ timeout: 15_000 });
    await boton.click();
    await page.waitForTimeout(150);
  }
  await expect(encabezado).toBeVisible();
}

/**
 * Completa la localidad de residencia —única obligatoria de «¿Dónde
 * vivís?»— eligiendo Santa Cruz en el mapa y su primera ciudad en el select
 * acotado (FT-03-R03/R06). Sin esto el motor no deja pasar a «¿Dónde
 * trabajás?»: `residenceMunicipalityConceptId` es `required`.
 */
export async function elegirLocalidadDeResidencia(page: Page): Promise<void> {
  await page.getByTestId('registration-residence-mapa-SC').click();
  const municipio = page.getByTestId('registration-residence-municipio').locator('select');
  await expect(municipio).toBeVisible();
  await municipio.selectOption({ index: 1 });
}

/**
 * Elige la localidad de TRABAJO — opcional, mismo componente que la de
 * residencia (`app-location-picker`), pero con `testId="registration-work"`
 * (FT-03-R07). A diferencia de la residencia, no bloquea el avance: se elige
 * igual para probar de forma simétrica que el mapa y el select responden.
 */
export async function elegirLocalidadDeTrabajo(page: Page): Promise<void> {
  await page.getByTestId('registration-work-mapa-SC').click();
  const municipio = page.getByTestId('registration-work-municipio').locator('select');
  await expect(municipio).toBeVisible();
  await municipio.selectOption({ index: 1 });
}
