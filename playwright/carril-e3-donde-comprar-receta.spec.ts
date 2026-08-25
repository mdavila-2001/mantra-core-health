import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril E3 — dónde comprar mi receta.
 *
 * ## Qué prueba hoy y qué queda esperando al backend
 *
 * El backend del carril E2 (`/pharmacy` y `/pharmacy-inventory`) todavía no
 * está fusionado en `dev`, así que este archivo prueba **el recorrido que ya
 * es real sin él**: que la historia clínica del paciente sigue en pie con el
 * botón nuevo, que la pantalla de compra existe, resuelve una receta
 * inexistente como «no encontrada» sin inventar datos, y que **no toca la
 * geolocalización del navegador ni los endpoints de farmacia** cuando no
 * corresponde. El recorrido completo —receta emitida, sucursales completas
 * primero, faltantes por nombre— está declarado al final como `fixme`: se
 * enciende cuando E2 llegue a `dev`, no antes.
 *
 * ## Por qué el paciente es nuevo
 *
 * Como en el resto de los carriles: las cuentas de paciente sembradas no
 * tienen contraseña conocida. Un paciente recién dado de alta no tiene
 * recetas, y eso acá es un dato, no un estorbo: fija el estado vacío.
 */

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  test.skip(
    !(await apiViva(api)),
    `La API E2E no responde en ${urlDeApi()}: este carril necesita backend vivo.`,
  );
});

test.afterAll(async () => {
  await api.dispose();
});

test.describe('Carril E3 · dónde comprar mi receta', () => {
  test('la historia sin recetas no ofrece compra, y la pantalla de compra no inventa una receta', async ({
    page,
  }) => {
    const consultasAFarmacia: string[] = [];
    page.on('request', (peticion) => {
      const url = new URL(peticion.url());
      if (
        url.pathname.startsWith('/pharmacy/') ||
        url.pathname.startsWith('/pharmacy-inventory/')
      ) {
        consultasAFarmacia.push(`${peticion.method()} ${url.pathname}`);
      }
    });

    const paciente = await crearPaciente(api);
    await entrar(page, paciente);

    // 1 · La historia recién nacida es un estado vacío DELIBERADO (`estaVacia`
    // → `empty()`, desde C09): sin secciones no existe el encabezado «Recetas»
    // — y por lo tanto tampoco ningún botón de compra.
    await irA(page, '/my-account/medical-record');
    await estable(page);
    await expect(
      page.getByText('Todavía no hay atenciones registradas en tu historia.'),
    ).toBeVisible();
    await expect(page.getByTestId('historia-donde-comprar')).toHaveCount(0);

    // 2 · La pantalla de compra con una receta que no existe en la historia:
    // «no encontrada», sin pedir la ubicación y sin salir a farmacias.
    await irA(page, '/my-account/medical-record/where-to-buy/00000000-0000-4000-8000-000000000000');
    await estable(page);
    await expect(page.getByRole('heading', { name: /Dónde comprar mi receta/i })).toBeVisible();
    // La pantalla no llegó a los renglones: no hay nada que comprar.
    await expect(page.getByTestId('compra-items')).toHaveCount(0);

    // Ni un uuid a la vista en lo que sí se pintó.
    const cuerpo = (await page.locator('main').first().textContent()) ?? '';
    expect(cuerpo).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    // Sin receta no hay consulta: a los endpoints de farmacia no salió nada.
    expect(consultasAFarmacia).toEqual([]);
  });

  // TODO(E3 · fase 2): encender cuando el carril E2 esté fusionado en `dev` y
  // el entorno E2E siembre una receta emitida comprable (doctora → prescribir
  // → firmar → emitir sobre un paciente conocido). El recorrido que este caso
  // tiene que demostrar, con la API real y sin un solo cuerpo escrito a mano:
  // entrar como paciente → «Mi historia clínica» → «Dónde comprarla» →
  // sucursales completas primero, faltantes por nombre, total y distancia →
  // «Reservar para retirar» y «Pedir delivery» visibles y deshabilitados.
  test.fixme(
    'una receta emitida lista sucursales completas primero, con faltantes por nombre',
    async () => {
      // Pendiente del backend E2 en `dev`.
    },
  );
});
