import { expect, test } from '@playwright/test';

import { capturar } from '../recorrido/support/evidencia';
import { ADMIN, apiViva } from './support/actores';
import { aparece, entrar, estable, irA, recorrer, resumen, Vigilante } from './support/sesion';

/**
 * **Administrador** — la cuenta que la API siembra con `BOOTSTRAP_ADMIN_*`.
 *
 * Es la única sesión que alcanza el sistema entero: su rol `SUPERADMIN` es
 * comodín en el `RolesGuard` del backend, así que ve todas las secciones y
 * ninguna lectura debería devolverle un error de permisos. Eso la vuelve el
 * mejor detector de defectos reales: casi cualquier error acá es del producto.
 *
 * ## Por qué es **una** prueba y no seis
 *
 * `POST /iam/auth/login` está limitado a diez por minuto y por IP —defensa
 * contra fuerza bruta, no un estorbo—. Con una prueba por sección, los cuatro
 * actores gastaban veinte ingresos en un minuto y la suite se rompía sola
 * contra una protección que funciona.
 *
 * Un recorrido es, además, exactamente eso: un recorrido. Partirlo en pruebas
 * sueltas tampoco daba independencia real, porque `mode: 'serial'` ya corta la
 * cadena en el primer fallo.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Recorrido real · administrador', () => {
  test.beforeAll(async () => {
    expect(
      await apiViva(),
      'La API no responde en /health. Levantá el backend antes de correr esta suite.',
    ).toBe(true);
  });

  test('recorre el sistema entero sin errores', async ({ page }) => {
    const vigilante = new Vigilante(page, 'administrador');
    await entrar(page, { ...ADMIN, nombre: 'Administrador', datos: {} });

    /* -- Punto de partida ------------------------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/panel',
      carpeta: 'admin-01-panel',
      titulo: 'Panel',
    });
    await recorrer(page, vigilante, {
      ruta: '/mi-cuenta',
      carpeta: 'admin-02-mi-cuenta',
      titulo: 'Mi perfil',
    });
    await recorrer(page, vigilante, {
      ruta: '/identidad/verificar',
      carpeta: 'admin-03-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- Padrón de pacientes ---------------------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/administracion/pacientes',
      carpeta: 'admin-04-pacientes',
      titulo: 'Pacientes',
    });

    // La ficha se abre desde una fila, que es como se llega de verdad. Con el
    // padrón vacío no hay fila que tocar y se sigue, en vez de fabricar un
    // identificador que no existe.
    const filaDePaciente = page.locator('table tbody tr a').first();
    if (await aparece(filaDePaciente, 'admin-04-pacientes', 'la ficha de un paciente del padrón')) {
      vigilante.en('Ficha de paciente');
      await filaDePaciente.click();
      await estable(page);
      await capturar(
        page,
        { carpeta: 'admin-05-ficha-paciente', titulo: 'Ficha de paciente' },
        'desde-el-listado',
      );
      await expect(page.locator('h1').first()).not.toBeEmpty({ timeout: 15_000 });
    }

    await recorrer(page, vigilante, {
      ruta: '/administracion/pacientes/nuevo',
      carpeta: 'admin-06-alta-paciente',
      titulo: 'Nuevo paciente',
    });
    await recorrer(page, vigilante, {
      ruta: '/administracion/pacientes/alta-asistida',
      carpeta: 'admin-07-alta-asistida',
      titulo: 'Alta asistida',
    });

    /* -- Catálogos y cuentas ---------------------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/administracion/terminologia',
      carpeta: 'admin-08-terminologia',
      titulo: 'Terminología',
    });

    // El buscador contra el catálogo real: es la mitad del endpoint que el
    // cliente no usaba, y la que enciende la sección.
    await page.getByLabel(/buscar conceptos/i).fill('cholera');
    await estable(page);
    await capturar(
      page,
      { carpeta: 'admin-08-terminologia', titulo: 'Terminología' },
      'buscando-cholera',
    );

    await recorrer(page, vigilante, {
      ruta: '/administracion/usuarios',
      carpeta: 'admin-09-usuarios',
      titulo: 'Usuarios',
    });

    /* -- Agenda: la sección que dejó de ser un cartel ---------------------- */

    await recorrer(page, vigilante, {
      ruta: '/agenda',
      carpeta: 'admin-10-agenda',
      titulo: 'Agenda',
    });

    // El selector tiene que **mostrar** el recurso que se está mirando. Un
    // desplegable que dice «Seleccionar opción» con una agenda cargada debajo
    // es la pantalla contradiciéndose, y fue un defecto real del `app-select`:
    // aplicaba la selección con un `[value]` que corría antes de que existieran
    // las opciones.
    const selectorDeRecurso = page.getByLabel('Recurso');
    if (await aparece(selectorDeRecurso, 'admin-10-agenda', 'el selector de recurso')) {
      await expect(selectorDeRecurso).not.toHaveValue('', {
        // El vacío es el índice del placeholder oculto.
        timeout: 15_000,
      });
    }

    // La pestaña de cupos: el panel inactivo no existe en el DOM, así que sin
    // este clic la evidencia no mostraría la mitad de la pantalla.
    const pestanaDeCupos = page.getByRole('tab', { name: /cupos/i });
    if (await aparece(pestanaDeCupos, 'admin-10-agenda', 'la pestaña de cupos')) {
      await pestanaDeCupos.click();
      await estable(page);
      await capturar(page, { carpeta: 'admin-10-agenda', titulo: 'Agenda' }, 'pestana-cupos');
    }

    // La ventana de treinta días, que es la que más le pide al backend.
    vigilante.en('Agenda · 30 días');
    await irA(page, '/agenda?rango=mes');
    await estable(page);
    await capturar(page, { carpeta: 'admin-10-agenda', titulo: 'Agenda' }, 'ventana-30-dias');

    /* -- Archivo clínico y expediente -------------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/clinico',
      carpeta: 'admin-11-archivo-clinico',
      titulo: 'Archivo clínico',
    });

    const verExpediente = page.getByRole('link', { name: /ver expediente/i }).first();
    if (await aparece(verExpediente, 'admin-11-archivo-clinico', 'el expediente de un paciente')) {
      vigilante.en('Expediente clínico');
      await verExpediente.click();
      await estable(page);
      await capturar(
        page,
        { carpeta: 'admin-12-expediente', titulo: 'Expediente clínico' },
        'desde-el-listado',
      );

      // Las ocho pestañas, una por una: cada panel se dibuja sólo cuando está
      // activo, así que una sola captura no probaría ninguna de las otras siete.
      const pestanas = page.getByRole('tab');
      await aparece(pestanas, 'admin-12-expediente', 'las pestañas del expediente');
      const total = await pestanas.count();
      for (let i = 0; i < total; i += 1) {
        const nombre = (await pestanas.nth(i).textContent()) ?? `pestana-${i}`;
        await pestanas.nth(i).click();
        await estable(page);
        await capturar(
          page,
          { carpeta: 'admin-12-expediente', titulo: 'Expediente clínico' },
          nombre.trim(),
        );
      }
    }

    /* -- Lo que sigue planificado ------------------------------------------ */

    for (const [ruta, carpeta, titulo] of [
      ['/administracion/organizaciones', 'admin-13-organizaciones', 'Organizaciones'],
      ['/facturacion', 'admin-14-facturacion', 'Facturación'],
    ] as const) {
      await recorrer(page, vigilante, { ruta, carpeta, titulo });
    }

    expect(vigilante.hallazgos, resumen(vigilante)).toEqual([]);
  });
});
