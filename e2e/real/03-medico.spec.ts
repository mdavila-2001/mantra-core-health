import { expect, test } from '@playwright/test';

import { capturar } from '../recorrido/support/evidencia';
import { apiViva, crearMedico, type Actor } from './support/actores';
import { aparece, entrar, estable, irA, recorrer, resumen, Vigilante } from './support/sesion';

/**
 * **Médico** — se registra con su matrícula y recorre lo suyo.
 *
 * La idea que ordena el recorrido es la misma que ordena `medico.smoke.ts` del
 * backend: **registrarse no es estar habilitado.** La licencia nace PENDIENTE, y
 * lo que se comprueba acá es que la aplicación sea honesta sobre eso — que no le
 * prometa pantallas que su rol todavía no abre, y que las que sí abre no se
 * rompan.
 *
 * El archivo clínico es el caso que justifica su diseño: `GET /profiles/patients`
 * pide `SECURITY_ADMIN`, que un médico no tiene, así que el buscador le responde
 * `403` y el acceso por identificador es el único camino que le queda. Que ese
 * camino exista **es** la prueba.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Recorrido real · médico', () => {
  let medico: Actor;

  test.beforeAll(async () => {
    expect(
      await apiViva(),
      'La API no responde en /health. Levantá el backend antes de correr esta suite.',
    ).toBe(true);
    medico = await crearMedico();
  });

  /**
   * No es una comprobación de interfaz: fija el supuesto del que cuelga todo el
   * recorrido. Si el backend empezara a habilitar al registrarse, lo de abajo
   * estaría midiendo otra cosa sin avisar.
   */
  test('se registra con matrícula y su licencia nace pendiente', () => {
    expect(medico.datos['practitionerProfileId']).not.toBe('');
    expect(medico.datos['verificationStatus']).toMatch(/PENDING|PENDIENTE/i);
  });

  test('entra y recorre lo que su rol alcanza', async ({ page }) => {
    const vigilante = new Vigilante(page, 'medico');

    await entrar(page, medico);
    await estable(page);
    await capturar(page, { carpeta: 'med-01-panel', titulo: 'Panel del médico' }, 'al-entrar');
    expect(page.url()).toContain('/panel');

    await recorrer(page, vigilante, {
      ruta: '/mi-cuenta',
      carpeta: 'med-02-mi-cuenta',
      titulo: 'Mi perfil',
    });
    await recorrer(page, vigilante, {
      ruta: '/identidad/verificar',
      carpeta: 'med-03-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- El archivo clínico de quien atiende ------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/clinico',
      carpeta: 'med-04-archivo-clinico',
      titulo: 'Archivo clínico',
    });

    // Sin este campo la sección sería inútil justo para el único rol que puede
    // leer un expediente: el buscador de padrón le responde 403.
    await expect(
      page.getByLabel(/identificador de perfil/i),
      'Sin buscador de padrón, el acceso por identificador es el único camino del rol clínico.',
    ).toBeVisible({ timeout: 15_000 });
    await capturar(
      page,
      { carpeta: 'med-04-archivo-clinico', titulo: 'Archivo clínico' },
      'acceso-por-identificador',
    );

    // Un identificador bien formado y ajeno: uno mal formado probaría la
    // validación del backend, no la pantalla.
    vigilante.en('Expediente inexistente');
    await irA(page, '/clinico/00000000-0000-4000-8000-000000000000');
    await estable(page);
    await capturar(
      page,
      { carpeta: 'med-05-expediente-inexistente', titulo: 'Expediente · no encontrado' },
      'al-entrar',
    );
    await expect(page.locator('h1').first()).not.toBeEmpty({ timeout: 15_000 });
    await expect(page.locator('main')).not.toBeEmpty();

    /* -- Su agenda ---------------------------------------------------------- */

    await recorrer(page, vigilante, {
      ruta: '/agenda',
      carpeta: 'med-06-agenda',
      titulo: 'Agenda del médico',
    });

    const cupos = page.getByRole('tab', { name: /cupos/i });
    if (await aparece(cupos, 'med-06-agenda', 'la pestaña de cupos')) {
      await cupos.click();
      await estable(page);
      await capturar(
        page,
        { carpeta: 'med-06-agenda', titulo: 'Agenda del médico' },
        'pestana-cupos',
      );
    }

    expect(vigilante.hallazgos, resumen(vigilante)).toEqual([]);
  });
});
