import { test } from '@playwright/test';

import { CLAIMS_ADMIN, iniciarSesion, simularApiTotal } from './support/api-total';
import { capturar } from './support/evidencia';
import { EVITAR_POR_DEFECTO, esperarEstable, recorrer } from './support/explorador';

/**
 * Las pantallas de **Atención**: agenda y archivo clínico.
 *
 * Son las dos que dejaron de ser un cartel en esta iteración, y las que más
 * estados tienen de todo el producto: cada una con datos y sin ellos, y el
 * expediente con ocho bloques que se dibujan **uno por vez** —el panel de una
 * pestaña inactiva no existe en el DOM—, así que una sola captura no probaría
 * ninguno de los otros siete.
 *
 * El rol es `SECURITY_ADMIN` como en el resto del recorrido: el explorador
 * necesita el menú entero, y las lecturas de agenda y expediente están
 * simuladas, así que el rol no cambia lo que se ve.
 */

test.describe('Recorrido · atención', () => {
  test('agenda con citas y cupos', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '40-agenda', titulo: 'Agenda' };

    await page.goto('/agenda');
    await esperarEstable(page);
    await capturar(page, pantalla, 'citas de la ventana por defecto');

    // La pestaña de cupos: sin este clic, la mitad de la pantalla no queda en
    // la evidencia.
    await page.getByRole('tab', { name: /cupos/i }).click();
    await esperarEstable(page);
    await capturar(page, pantalla, 'cupos disponibles');

    // Las tres ventanas, que es el único filtro que cambia qué se le pide al
    // backend. Se llega por la URL y no por el desplegable porque el valor que
    // viaja es la clave, no la etiqueta.
    for (const [rango, nombre] of [
      ['hoy', 'ventana de hoy'],
      ['mes', 'ventana de 30 días'],
    ] as const) {
      await page.goto(`/agenda?rango=${rango}`);
      await esperarEstable(page);
      await capturar(page, pantalla, nombre);
    }

    await page.goto('/agenda?canceladas=si');
    await esperarEstable(page);
    await capturar(page, pantalla, 'incluyendo canceladas');
  });

  test('agenda de una organización sin recursos', async ({ page }) => {
    await simularApiTotal(page, {
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      sinAgenda: true,
    });
    await iniciarSesion(page);

    // El estado de un tenant recién creado. No se alcanza con datos cargados:
    // hay que pedirle a la API simulada que no devuelva ningún recurso.
    await recorrer(
      page,
      { ruta: '/agenda', carpeta: '41-agenda-sin-recursos', titulo: 'Agenda · sin recursos' },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });

  test('archivo clínico: elegir a quién se mira', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    await recorrer(
      page,
      { ruta: '/clinico', carpeta: '42-archivo-clinico', titulo: 'Archivo clínico' },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  test('expediente clínico, bloque por bloque', async ({ page }) => {
    await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    await iniciarSesion(page);

    const pantalla = { carpeta: '43-expediente', titulo: 'Expediente clínico' };

    await page.goto('/clinico/p-001');
    await esperarEstable(page);
    await capturar(page, pantalla, 'al entrar');

    const pestanas = page.getByRole('tab');
    const total = await pestanas.count();
    for (let i = 0; i < total; i += 1) {
      const rotulo = ((await pestanas.nth(i).textContent()) ?? `bloque ${i}`).trim();
      await pestanas.nth(i).click();
      await esperarEstable(page);
      await capturar(page, pantalla, rotulo);
    }
  });

  test('expediente clínico sin ningún registro', async ({ page }) => {
    await simularApiTotal(page, {
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      sinExpediente: true,
    });
    await iniciarSesion(page);

    // Los ocho bloques vacíos a la vez: es lo que ve quien abre el expediente de
    // alguien que todavía no fue atendido, y el vacío de un bloque clínico
    // ofrece salir, no cargar — la pantalla es de lectura.
    await recorrer(
      page,
      {
        ruta: '/clinico/p-001',
        carpeta: '44-expediente-vacio',
        titulo: 'Expediente · sin registros',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });
});
