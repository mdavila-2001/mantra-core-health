import { Tabla } from '../../support/components/data-table.component';
import { DesignSystemPage } from '../../support/pages/design-system.page';

/**
 * Tabla de datos.
 *
 * Todavía ninguna pantalla de producto la usa: la única instancia con datos vive
 * en la vitrina. Probarla igual es deliberado — el día que se escriba el primer
 * listado clínico, el contrato ya está fijado y con pruebas que lo sostienen, en
 * vez de tener que inventarlo con la pantalla a medio hacer.
 *
 * Lo que se afirma es el contrato **observable**, no la implementación: cuántas
 * filas hay, cómo se anuncia el orden y qué ofrece la paginación por cursor.
 */
describe('Regresión · tabla de datos', () => {
  beforeEach(() => {
    DesignSystemPage.abrir();
    DesignSystemPage.irALaTabla();
    Tabla.esperarCargada();
  });

  it('la tabla se pinta con sus filas', () => {
    Tabla.cantidadDeFilas().should('be.greaterThan', 0);
  });

  it('el orden se anuncia con aria-sort, y no solo con una flecha', () => {
    Tabla.columnasOrdenables().then((columnas) => {
      const primera = columnas[0];
      expect(primera, 'la tabla ofrece al menos una columna ordenable').to.not.equal(undefined);

      Tabla.ordenarPor(primera as string);

      // `aria-sort` es lo que oye un lector de pantalla. Sin él, saber por dónde
      // está ordenada la tabla depende de ver la flechita.
      Tabla.esperarOrdenado(primera as string);
    });
  });

  it('volver a pulsar la misma columna invierte el orden', () => {
    Tabla.columnasOrdenables().then((columnas) => {
      const columna = columnas[0] as string;

      Tabla.ordenarPor(columna);
      Tabla.esperarOrdenado(columna).then((primero) => {
        Tabla.ordenarPor(columna);
        Tabla.esperarOrdenDistintoDe(columna, primero);
      });
    });
  });

  it('la paginación por cursor solo ofrece anterior y siguiente', () => {
    // En la primera página no hay anterior. No hay «página 7 de 42» porque un
    // cursor no conoce el total: prometerlo sería mentir.
    Tabla.esperarPuedeIrAlAnterior(false);
    Tabla.esperarPuedeIrAlSiguiente(true);
  });

  it('avanzar con el cursor habilita el botón de volver', () => {
    Tabla.irAlSiguiente();

    Tabla.esperarPuedeIrAlAnterior(true);
  });

  it('seleccionar una fila no altera las demás', () => {
    Tabla.cantidadDeFilas().then((antes) => {
      Tabla.seleccionarFila(0);

      // Seleccionar es un estado de la fila, no un filtro: la tabla no puede
      // encogerse ni reordenarse por marcar una casilla.
      Tabla.esperarFilas(antes);
      Tabla.filasSeleccionadas().should('equal', 1);
    });
  });
});
