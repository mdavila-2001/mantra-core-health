import { expect, test } from '@playwright/test';

import { capturar } from '../recorrido/support/evidencia';
import { ADMIN, apiViva, crearOrganizacion, tokenDe, type Actor } from './support/actores';
import { entrar, estable, recorrer, resumen, Vigilante } from './support/sesion';

/**
 * **Organización** — se da de alta con su cuenta owner y entra de inmediato.
 *
 * Es el único actor cuyo tenant **no tiene datos**: catálogo sin poblar, agenda
 * sin recursos, padrón sin pacientes. Los estados vacíos sólo se ven así, y el
 * M34 los llama «Empty **with next action**»: un vacío mudo es un callejón, y
 * eso es lo que esta prueba mira.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Recorrido real · organización', () => {
  let owner: Actor;

  test.beforeAll(async () => {
    expect(
      await apiViva(),
      'La API no responde en /health. Levantá el backend antes de correr esta suite.',
    ).toBe(true);

    // El alta de una organización pide `countryConceptId` y `jurisdictionConceptId`
    // que existan de verdad; se resuelven del catálogo con el token del admin,
    // porque los uuid de concepto no se escriben en el cliente.
    const token = await tokenDe(ADMIN.identificador, ADMIN.clave);
    owner = await crearOrganizacion(token);
  });

  test('el owner entra y sus secciones vacías ofrecen una salida', async ({ page }) => {
    const vigilante = new Vigilante(page, 'organizacion');

    await entrar(page, owner);
    await estable(page);
    await capturar(
      page,
      { carpeta: 'org-01-panel', titulo: 'Panel de la organización' },
      'al-entrar',
    );
    expect(page.url()).toContain('/panel');

    for (const [ruta, carpeta, titulo] of [
      ['/agenda', 'org-02-agenda-vacia', 'Agenda sin recursos'],
      ['/clinico', 'org-03-clinico-vacio', 'Archivo clínico sin pacientes'],
      ['/mi-cuenta', 'org-04-mi-cuenta', 'Mi perfil del owner'],
    ] as const) {
      await recorrer(page, vigilante, { ruta, carpeta, titulo });
    }

    expect(vigilante.hallazgos, resumen(vigilante)).toEqual([]);
  });
});
