import { expect, request, test, type Page } from '@playwright/test';
import { urlDeApi } from './support/actores';
import { empezarElAlta, avanzarHasta, elegirLocalidadDeResidencia } from './support/registro-paciente';

/**
 * Un solo paso: clic en «Siguiente»/«Crear cuenta» y esperar el título de la
 * página que sigue.
 *
 * A diferencia de `avanzarHasta()` (que reintenta a ciegas hasta 8 veces con
 * una espera fija de 150ms), acá se sabe exactamente cuál es la página
 * siguiente: un solo clic, y una espera generosa del título exacto. Esto
 * importa en el tramo final del alta —seguro y facturación pueden traer un
 * catálogo real (`VS_BO_INSURANCE`, árbol) cuya carga no es instantánea— y un
 * reintento a ciegas ahí puede hacer un segundo clic sobre un botón que
 * todavía estaba resolviendo el primero, saltándose una página entera.
 */
async function avanzarUnPaso(page: Page, tituloSiguiente: string): Promise<void> {
  const continuar = page.getByTestId('paginated-form-continuar');
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await expect(page.locator('.paginated-form__titulo')).toHaveText(tituloSiguiente, {
    timeout: 20_000,
  });
}

/**
 * FT-03-R03/R06 (AG49-FT03-006): el alta no sólo deja avanzar de página —eso
 * ya lo comprueban las otras suites—, también **persiste de verdad** contra
 * el backend.
 *
 * ## Por qué un `APIRequestContext` nuevo, y no seguir con `page`
 *
 * Si se leyera el dato de vuelta con el mismo `page` que hizo el alta, no se
 * distinguiría "el backend lo guardó" de "el formulario nunca perdió lo que
 * ya tenía en memoria". Un contexto de API nuevo, con un login propio, no
 * tiene nada del navegador de la corrida: si el dato vuelve igual, es porque
 * viajó de ida y vuelta por el backend real.
 */
test('el alta persiste contra la API: un login nuevo devuelve la misma localidad de residencia elegida en el mapa', async ({
  page,
}) => {
  const sufijo = `${Date.now()}`;
  const documento = `CI-PERSIST-${sufijo}`;
  const email = `persistencia-pw-${sufijo}@example.test`;
  const password = 'Persist-Pw0rd!';

  await empezarElAlta(page, documento);

  await avanzarHasta(page, '¿Dónde vivís?');
  await elegirLocalidadDeResidencia(page);
  // El nombre de la ciudad que el `<select>` acotado ofreció para Santa Cruz:
  // se lee de la propia pantalla para comparar contra lo que devuelva la API,
  // en vez de asumir cuál es la primera ciudad del catálogo.
  const municipioSeleccionado = page
    .getByTestId('registration-residence-municipio')
    .locator('select');
  const ciudadElegida = await municipioSeleccionado.evaluate(
    (select: HTMLSelectElement) => select.selectedOptions[0]?.textContent?.trim() ?? '',
  );
  expect(ciudadElegida.length).toBeGreaterThan(0);

  // Trabajo (empresa + localidad) y seguro quedan vacíos: son opcionales y no
  // son lo que esta prueba verifica. Un paso por página, con el título exacto
  // de la que sigue (ver `avanzarUnPaso`): así una carga lenta de catálogo no
  // hace que un reintento a ciegas se salte una página.
  await avanzarUnPaso(page, '¿Dónde trabajás?');
  await avanzarUnPaso(page, 'El lugar donde trabajás');
  await avanzarUnPaso(page, 'Tu acceso');

  await page.getByTestId('registro-correo').fill(email);
  await page.getByTestId('registro-password').fill(password);
  await avanzarUnPaso(page, 'Tu seguro de salud');
  await avanzarUnPaso(page, 'Datos de facturación');

  // Última página: el mismo botón, con el texto de envío.
  const enviar = page.getByTestId('paginated-form-continuar');
  await expect(enviar).toHaveText(/Crear cuenta/);
  await expect(enviar).toBeEnabled({ timeout: 20_000 });
  await enviar.click();

  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });

  // Desde acá, nada del `page` de arriba: contexto de API nuevo, login propio.
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const login = await api.post('/iam/auth/login', {
      data: { nationalId: documento, password },
    });
    expect(login.ok(), await login.text()).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken: string };

    const perfil = await api.get('/profiles/patients/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(perfil.ok(), await perfil.text()).toBeTruthy();
    const cuerpo = (await perfil.json()) as {
      residenceMunicipalityConceptId?: string;
      homeAddress?: { city?: string | null; municipalityConceptId?: string | null };
    };

    // El backend guardó exactamente el municipio elegido en el mapa —no un
    // valor por defecto ni el de otra fila— y lo devuelve en un viaje
    // completamente nuevo, sin nada del estado del navegador de la corrida.
    expect(cuerpo.residenceMunicipalityConceptId).toBeTruthy();
    expect(cuerpo.homeAddress?.municipalityConceptId).toBe(cuerpo.residenceMunicipalityConceptId);
    expect(cuerpo.homeAddress?.city).toBe(ciudadElegida);
  } finally {
    await api.dispose();
  }
});
