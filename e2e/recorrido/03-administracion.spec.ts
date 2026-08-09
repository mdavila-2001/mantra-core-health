import { test } from '@playwright/test';

import { CLAIMS_ADMIN, iniciarSesion, simularApiTotal } from './support/api-total';
import { capturar } from './support/evidencia';
import { EVITAR_POR_DEFECTO, esperarEstable, recorrer } from './support/explorador';

/**
 * Las pantallas de administración: las únicas con datos de verdad.
 *
 * Piden rol `SECURITY_ADMIN` —el menú no las ofrece sin él— y son las que más
 * estados tienen: listado con datos, listado vacío, ficha, y tres formularios de
 * alta con sus validaciones.
 */

test.describe('Recorrido · administración', () => {
  test('listado de pacientes', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/pacientes',
        carpeta: '22-pacientes-listado',
        titulo: 'Pacientes · listado',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  test('listado de pacientes sin resultados', async ({ page }) => {
    await simularApiTotal(page, {
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      sinPacientes: true,
    });
    await iniciarSesion(page);

    // El estado vacío es una pantalla propia —con su ilustración y su acción de
    // salida— y no se alcanza con datos cargados: hay que pedirle a la API que
    // no devuelva ninguno.
    await recorrer(
      page,
      {
        ruta: '/administracion/pacientes',
        carpeta: '23-pacientes-vacio',
        titulo: 'Pacientes · sin resultados',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  test('ficha de paciente', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/pacientes/p-001',
        carpeta: '24-paciente-ficha',
        titulo: 'Pacientes · ficha',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });

  test('alta de paciente', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/pacientes/nuevo',
        carpeta: '25-paciente-alta',
        titulo: 'Pacientes · alta',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  test('alta de paciente · envío completo', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '26-paciente-alta-envio', titulo: 'Pacientes · alta enviada' };

    await page.goto('/administracion/pacientes/nuevo');
    await esperarEstable(page);

    // El explorador toca los controles de a uno y nunca llega a mandar el
    // formulario completo: un envío válido es una secuencia, no un clic.
    const enviar = page.getByRole('button', { name: 'Registrar paciente' });

    await enviar.click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'envío vacío con los errores de validación');

    // `testId` termina como `data-testid` **del `<input>`**, no de un envoltorio.
    await page.locator('input[data-testid="alta-paciente-codigo"]').fill('PAC-00099');
    await page.locator('input[data-testid="alta-paciente-nombre"]').fill('Fernanda Ortiz Lima');
    await esperarEstable(page);
    await capturar(page, pantalla, 'formulario completado');

    await enviar.click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'después de guardar');
  });

  test('alta asistida', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/pacientes/alta-asistida',
        carpeta: '27-alta-asistida',
        titulo: 'Pacientes · alta asistida',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  test('alta de usuarios', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/usuarios',
        carpeta: '28-usuarios-alta',
        titulo: 'Usuarios · alta',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 35 },
    );
  });

  test('catálogo de terminología', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      {
        ruta: '/administracion/terminologia',
        carpeta: '30-terminologia',
        titulo: 'Terminología · catálogo',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  test('búsqueda en el catálogo de terminología', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '31-terminologia-busqueda', titulo: 'Terminología · búsqueda' };

    await page.goto('/administracion/terminologia');
    await esperarEstable(page);
    await capturar(page, pantalla, 'catálogo completo');

    const buscador = page.getByLabel('Buscar conceptos');
    await buscador.fill('femenino');
    await esperarEstable(page);
    await capturar(page, pantalla, 'texto escrito en el buscador');

    await buscador.press('Enter');
    await esperarEstable(page);
    await capturar(page, pantalla, 'resultados de la búsqueda');
  });

  test('búsqueda en el listado de pacientes', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '29-pacientes-busqueda', titulo: 'Pacientes · búsqueda' };

    await page.goto('/administracion/pacientes');
    await esperarEstable(page);
    await capturar(page, pantalla, 'listado antes de buscar');

    // El campo es `type="text"`, no `search` —el átomo dibujaría su propio botón
    // de limpiar, que no avisa ni devuelve el foco— así que `getByRole('searchbox')`
    // no lo encuentra. Su nombre accesible sale de una etiqueta `sr-only`.
    const buscador = page.getByLabel('Buscar pacientes');
    await buscador.fill('Peña');
    await esperarEstable(page);
    await capturar(page, pantalla, 'texto escrito en el buscador');

    await buscador.press('Enter');
    await esperarEstable(page);
    await capturar(page, pantalla, 'resultados de la búsqueda');
  });
});
