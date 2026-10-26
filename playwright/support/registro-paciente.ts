import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers compartidos del alta pública de paciente (`/auth/register/patient`),
 * usados por `registro-empresa-y-mapa.spec.ts`, `registro-persistencia.spec.ts`,
 * `altas-sin-cobertura.spec.ts` y `auditoria-qa-mockup.spec.ts`.
 *
 * Viven en `support/` y no en un archivo `.spec.ts` porque un `.spec.ts`
 * importado por otro vuelve a registrar sus propios `test.describe` en quien
 * lo importa — el runner de Playwright trata cada import como código de
 * módulo normal, no como "sólo funciones". `support/` es exactamente para
 * evitar esa trampa (ver el resto de archivos de esta carpeta).
 */

/**
 * Elige una opción de un `app-select` como lo haría la persona: toca el campo
 * y toca la opción en el `<dialog>` que se abre. `app-select` ya no envuelve un
 * `<select>` nativo (ver `atoms/select/select.ts`), así que `selectOption` no
 * tiene dónde apoyarse.
 *
 * `index` cuenta como el `<select>` de antes —el 0 era el placeholder—, así
 * que `{ index: 1 }` sigue siendo «la primera opción de verdad».
 */
export async function elegirOpcion(
  page: Page,
  testId: string,
  opcion: { readonly index: number } | { readonly label: string },
): Promise<void> {
  const campo = page.getByTestId(testId);
  await campo.locator('.select-trigger').click();
  const dialogo = campo.locator('dialog.select-dialog[open]');
  await expect(dialogo).toBeVisible();
  const fila =
    'label' in opcion
      ? dialogo.getByRole('option', { name: opcion.label, exact: true })
      : dialogo.getByTestId(`select-opcion-${opcion.index - 1}`);
  await fila.click();
  await expect(dialogo).toHaveCount(0);
}

/** El texto que muestra un `app-select`: la opción elegida o el placeholder. */
export function valorDelSelect(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('.select-value');
}

/**
 * Los títulos de los cinco pasos del alta, tal como los rotula
 * `paginasPaciente` (`register-patient.ts`). Desde el 2026-10-21 el alta es de
 * cinco pasos y no de diez: los specs nombran el paso por acá, no con un texto
 * suelto que se desfasa en silencio la próxima vez que se reagrupen.
 */
export const PASOS_DEL_ALTA = {
  identidad: 'Identidad y ocupación',
  residencia: 'Lugares donde vive',
  contacto: 'Datos de contacto y emergencia',
  trabajo: 'Empresa y lugar de trabajo',
  resto: 'Resto de datos (acceso, seguros y facturación)',
} as const;

/**
 * Completa el primer paso —identidad: nombre, apellido, documento y su
 * departamento de emisión, fecha de nacimiento y sexo— y avanza. Deja la
 * pantalla en «Lugares donde vive».
 *
 * El motor valida de a un paso, así que sin esto el «Siguiente» no mueve nada
 * y la prueba fallaría lejos de lo que quiere comprobar.
 *
 * `documento` es parametrizable porque `registro-persistencia.spec.ts` envía
 * un alta real al backend y necesita un CI único por corrida (dos altas con
 * el mismo documento chocan con 409); las pruebas que nunca llegan a enviar
 * el formulario siguen usando el valor fijo por defecto.
 */
export async function empezarElAlta(page: Page, documento = '9876543'): Promise<void> {
  await page.goto('/auth/register/patient');
  await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

  await page.getByTestId('registro-nombre').fill('Ana');
  await page.getByTestId('registro-apellido-paterno').fill('Paz');
  await page.getByTestId('registro-documento').fill(documento);
  // El departamento que expidió la cédula es OBLIGATORIO (commit b300ade):
  // sin él el motor no deja pasar del primer paso.
  await elegirOpcion(page, 'registro-departamento-ci', { index: 1 });

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
  await elegirOpcion(page, 'registro-genero', { label: 'Masculino' });
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.residencia })).toBeVisible();
}

/**
 * Completa el paso de contacto —el celular es lo único obligatorio; el
 * contacto de emergencia y la ambulancia se dejan vacíos— y avanza al de
 * trabajo. Se llama estando ya en «Datos de contacto y emergencia».
 */
export async function completarContacto(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.contacto })).toBeVisible();
  await page.getByTestId('registro-telefono').fill('70012345');
  await page.getByTestId('paginated-form-continuar').click();
  await expect(page.getByRole('heading', { name: PASOS_DEL_ALTA.trabajo })).toBeVisible();
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
 * Completa la localidad de residencia —única obligatoria de «Lugares donde
 * vive»— eligiendo Santa Cruz en el mapa y su primera ciudad en el select
 * acotado (FT-03-R03/R06). Sin esto el motor no deja pasar al paso de
 * contacto: `residenceMunicipalityConceptId` es `required`.
 */
export async function elegirLocalidadDeResidencia(page: Page): Promise<void> {
  await page.getByTestId('registration-residence-mapa-SC').click();
  await expect(page.getByTestId('registration-residence-municipio')).toBeVisible();
  await elegirOpcion(page, 'registration-residence-municipio', { index: 1 });
}

/**
 * Marca la casa en el mapa y la confirma. Desde el 26/10/2026 el punto de la
 * casa es obligatorio (pedido del cliente): sin esto el motor no deja pasar de
 * «Lugares donde vive». Toca el centro del plano, que es la vista por defecto.
 */
export async function marcarYConfirmarCasa(page: Page): Promise<void> {
  await page.getByTestId('registration-home-location-pick').click();
  const mapa = page.getByTestId('registro-mapa-domicilio');
  await expect(mapa.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
  await mapa.locator('.leaflet-container').click();
  await page.getByTestId('registro-confirmar-direccion').click();
  await expect(page.getByTestId('registro-direccion-confirmada')).toBeAttached();
}

/**
 * Elige la localidad de TRABAJO — opcional, mismo componente que la de
 * residencia (`app-location-picker`), pero con `testId="registration-work"`
 * (FT-03-R07). A diferencia de la residencia, no bloquea el avance: se elige
 * igual para probar de forma simétrica que el mapa y el select responden.
 */
export async function elegirLocalidadDeTrabajo(page: Page): Promise<void> {
  await page.getByTestId('registration-work-mapa-SC').click();
  await expect(page.getByTestId('registration-work-municipio')).toBeVisible();
  await elegirOpcion(page, 'registration-work-municipio', { index: 1 });
}
