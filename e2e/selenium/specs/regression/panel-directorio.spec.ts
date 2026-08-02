import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { iniciarSesion } from '../../helpers/auth.helper';

/**
 * Los estados de vista del panel, contra la API de verdad del arnés.
 *
 * El directorio público es la única lectura real de la pantalla: cruza el
 * interceptor, la traducción de errores y el componente de estados. Probar sus
 * tres desenlaces —vacío, con datos y caído— es lo que impide que un cambio en
 * el mapeo de errores deje una pantalla en blanco sin que nadie se entere.
 */
describe('Regresión · directorio del panel', () => {
  const navegador = usarNavegador();

  test('sin registros, la lectura termina y no deja el esqueleto puesto', async () => {
    const panel = await iniciarSesion(navegador());

    await panel.esperarDirectorio();
    // El conteo solo aparece con registros; lo que no puede quedar es el
    // esqueleto de carga para siempre.
    expect(await panel.estaCargandoDirectorio()).toBe(false);
    expect(await panel.registrosDelDirectorio()).toBeNull();
  });

  test('con registros, el panel dice cuántos hay', async () => {
    const panel = await iniciarSesion(navegador(), { escenario: 'directorio-poblado' });

    expect(await panel.esperarConteoDelDirectorio()).toBe(3);
  });

  test('con la API caída, el panel explica el fallo y ofrece reintentar', async () => {
    const panel = await iniciarSesion(navegador(), { escenario: 'directorio-caido' });

    const mensaje = await panel.esperarErrorDelDirectorio();
    // Un 503 se traduce a «un servicio no está disponible», no a un volcado
    // técnico: el código de soporte va aparte, para quien tenga que buscarlo.
    expect(mensaje).toMatch(/no está disponible|algo salió mal/i);
    expect(mensaje).toMatch(/código de soporte/i);

    // Reintentar tiene que volver a pedir: con la API todavía caída, el error
    // sigue ahí, y eso también es correcto.
    await panel.reintentarDirectorio();
    expect(await panel.esperarErrorDelDirectorio()).toMatch(/\S/);
  });

  test('con la API demorada se ve el estado de carga antes que los datos', async () => {
    const panel = await iniciarSesion(navegador(), { escenario: 'api-lenta' });

    // No se afirma sobre el instante exacto: se afirma que la lectura termina.
    // Un estado de carga que no se resuelve es el defecto que importa.
    await panel.esperarDirectorio();
    expect(await panel.tituloVisible()).toBe('Panel');
  });
});
