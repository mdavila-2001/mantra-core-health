import { test, expect, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, type Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * ALV-005/006/010 — «Dónde atiendo»: el profesional carga un consultorio
 * propio con dirección, lo ve tras recargar (persistió, no es estado de
 * pantalla), la dirección se muestra en MAYÚSCULAS sin haberse guardado así,
 * y lo retira. Todo contra la API viva.
 *
 * Registra su propio profesional por API en vez de depender de la cuenta demo:
 * la base de desarrollo (Neon) no tiene `SEED_DEMO_PASSWORD`, así que la
 * doctora de `actores.ts` no existe ahí. El alta es el mismo endpoint que usa
 * el registro del front.
 */
const RUTA_PERFIL = '/my-account';

async function profesionalNuevo(): Promise<Actor> {
  const api = await contextoDeApi();
  const sufijo = `${String(Date.now()).slice(-8)}`;
  const identificador = `alv005.e2e.${sufijo}@example.com`;
  const clave = 'Alv-005-Passw0rd!';
  const respuesta = await api.post('/iam/auth/register-practitioner', {
    data: {
      email: identificador,
      password: clave,
      name: 'Valeria',
      lastName: 'Fuentes',
      licenseNumber: `MSD-${sufijo}`,
    },
  });
  expect(respuesta.status(), 'el alta del profesional de prueba').toBe(201);
  await api.dispose();
  return { rol: 'doctora', identificador, clave, nombre: 'Valeria Fuentes' };
}

/** La sección «Dónde atiendo», esté al pie del perfil o dentro de Trayectoria. */
async function seccionDeSedes(page: Page) {
  const seccion = page.getByTestId('sedes-propias').first();
  if (!(await seccion.isVisible().catch(() => false))) {
    await page.getByRole('tab', { name: /Trayectoria/i }).first().click();
    await estable(page);
  }
  await expect(seccion).toBeVisible();
  return seccion;
}

test.describe('ALV-005/006/010 · dónde atiendo', () => {
  let actor: Actor;

  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    await api.dispose();
    test.skip(!viva, 'La API no responde: no hay dónde registrar la sede.');
    actor = await profesionalNuevo();
  });

  test('carga un consultorio propio, persiste al recargar en MAYÚSCULAS y se retira', async ({
    page,
  }) => {
    await entrar(page, actor);
    await irA(page, RUTA_PERFIL);
    await estable(page);

    const sedes = await seccionDeSedes(page);
    await expect(sedes.getByTestId('sedes-vacio')).toBeVisible();

    await sedes.getByTestId('sede-agregar').click();
    await sedes.getByTestId('sede-nombre').locator('input').fill('Consultorio Dra. Fuentes');
    await sedes.getByTestId('sede-direccion').locator('input').fill('Av. Brasil 1234');
    await sedes.getByRole('button', { name: /Guardar consultorio/i }).click();
    await estable(page);

    // La lista sale del servidor: aparece porque el POST se persistió.
    await expect(sedes.getByTestId('sede-propia')).toHaveCount(1);
    await expect(sedes.getByTestId('sede-propia').first()).toContainText('Consultorio Dra. Fuentes');
    // ALV-010: se renderiza normalizada; lo que se guardó fue «Av. Brasil 1234».
    await expect(sedes.getByTestId('sede-propia').first()).toContainText('AV. BRASIL 1234');

    // Recargar: si fuera estado de pantalla, desaparecería.
    await page.reload();
    await estable(page);
    const sedesTrasRecargar = await seccionDeSedes(page);
    await expect(sedesTrasRecargar.getByTestId('sede-propia')).toHaveCount(1);

    // Retirar, con confirmación. Desde ADR-0012 la sede propia tiene tres
    // acciones y por eso van plegadas: primero se abre el desplegable de esa
    // fila. El `data-action` es el código de la acción, no su texto, que
    // cambia según de quién sea la sede.
    await sedesTrasRecargar
      .getByTestId('sede-propia')
      .first()
      .getByTestId('row-actions-trigger')
      .click();
    await page.locator('app-menu [data-action="retirar"]').click();
    await page.getByRole('dialog').getByRole('button', { name: /^Retirar$/ }).click();
    await estable(page);
    await expect(sedesTrasRecargar.getByTestId('sede-propia')).toHaveCount(0);
    await expect(sedesTrasRecargar.getByTestId('sedes-vacio')).toBeVisible();
  });

  // ALV-007 (vínculo sin cargo) se verifica por API y por spec unitario:
  // el date-picker del formulario no expone su `<input>` por etiqueta y el
  // recorrido por UI queda para cuando tenga `data-testid`.
});
