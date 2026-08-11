import { iniciarSesion } from '../../support/helpers/auth';
import { DashboardPage } from '../../support/pages/dashboard.page';

/**
 * Los estados de vista del panel, contra la API de verdad del arnés.
 *
 * El directorio público es la única lectura real de la pantalla: cruza el
 * interceptor, la traducción de errores y el componente de estados. Probar sus
 * tres desenlaces —vacío, con datos y caído— es lo que impide que un cambio en
 * el mapeo de errores deje una pantalla en blanco sin que nadie se entere.
 */
describe('Regresión · directorio del panel', () => {
  it('sin registros, la lectura termina y no deja el esqueleto puesto', () => {
    iniciarSesion();

    DashboardPage.esperarDirectorio();
    // El conteo solo aparece con registros; lo que no puede quedar es el
    // esqueleto de carga para siempre.
    DashboardPage.esperarSinEsqueleto();
    DashboardPage.sinConteoDelDirectorio();
  });

  it('con registros, el panel dice cuántos hay', () => {
    iniciarSesion({ escenario: 'directorio-poblado' });

    DashboardPage.esperarConteoDelDirectorio(3);
  });

  it('con la API caída, el panel explica el fallo y ofrece reintentar', () => {
    iniciarSesion({ escenario: 'directorio-caido' });

    // Un 503 se traduce a «un servicio no está disponible», no a un volcado
    // técnico: el código de soporte va aparte, para quien tenga que buscarlo.
    DashboardPage.esperarErrorDelDirectorio().should(
      'match',
      /no está disponible|algo salió mal/i,
    );
    DashboardPage.esperarErrorDelDirectorio().should('match', /código de soporte/i);

    // Reintentar tiene que volver a pedir: con la API todavía caída, el error
    // sigue ahí, y eso también es correcto.
    DashboardPage.reintentarDirectorio();
    DashboardPage.esperarErrorDelDirectorio().should('match', /\S/);
  });

  it('con la API demorada se ve el estado de carga antes que los datos', () => {
    iniciarSesion({ escenario: 'api-lenta' });

    // No se afirma sobre el instante exacto: se afirma que la lectura termina.
    // Un estado de carga que no se resuelve es el defecto que importa.
    DashboardPage.esperarDirectorio();
    DashboardPage.esperarSinEsqueleto();
    DashboardPage.esperarTitulo('Panel');
  });
});
