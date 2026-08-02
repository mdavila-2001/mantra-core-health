import { describe, expect, test } from 'vitest';

import { DataTableComponent } from '../../components/data-table.component';
import { usarNavegador } from '../../core/test.lifecycle';
import { DesignSystemPage } from '../../pages/design-system.page';

/**
 * Tabla de datos.
 *
 * Todavía ninguna pantalla de producto la usa: la única instancia con datos
 * vive en la vitrina. Probarla igual es deliberado — el día que se escriba el
 * primer listado clínico, el contrato ya está fijado y con pruebas que lo
 * sostienen, en vez de tener que inventarlo con la pantalla a medio hacer.
 *
 * Lo que se afirma es el contrato **observable**, no la implementación: cuántas
 * filas hay, cómo se anuncia el orden y qué ofrece la paginación por cursor.
 */
describe('Regresión · tabla de datos', () => {
  const navegador = usarNavegador();

  test('la tabla se pinta con sus filas', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();

    expect(await tabla.cantidadDeFilas()).toBeGreaterThan(0);
  });

  test('el orden se anuncia con aria-sort, y no solo con una flecha', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();

    const columnas = await tabla.columnasOrdenables();
    const primera = columnas[0];
    expect(primera).toBeDefined();

    await tabla.ordenarPor(primera!);

    // `aria-sort` es lo que oye un lector de pantalla. Sin él, saber por dónde
    // está ordenada la tabla depende de ver la flechita.
    expect(await tabla.esperarOrdenAnunciado(primera!, null)).toMatch(/ascending|descending/);
  });

  test('volver a pulsar la misma columna invierte el orden', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();
    const columna = (await tabla.columnasOrdenables())[0]!;

    await tabla.ordenarPor(columna);
    const primero = await tabla.esperarOrdenAnunciado(columna, null);

    await tabla.ordenarPor(columna);

    expect(await tabla.esperarOrdenAnunciado(columna, primero)).not.toBe(primero);
  });

  test('la paginación por cursor solo ofrece anterior y siguiente', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();

    // En la primera página no hay anterior. No hay «página 7 de 42» porque un
    // cursor no conoce el total: prometerlo sería mentir.
    expect(await tabla.puedeIrAlAnterior()).toBe(false);
    expect(await tabla.puedeIrAlSiguiente()).toBe(true);
  });

  test('avanzar con el cursor habilita el botón de volver', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();

    await tabla.irAlSiguiente();

    expect(await tabla.esperarPuedaVolver()).toBe(true);
  });

  test('seleccionar una fila no altera las demás', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.irALaTabla();

    const tabla = new DataTableComponent(navegador());
    await tabla.esperarCargada();
    const antes = await tabla.cantidadDeFilas();

    await tabla.seleccionarFila(0);

    // Seleccionar es un estado de la fila, no un filtro: la tabla no puede
    // encogerse ni reordenarse por marcar una casilla.
    expect(await tabla.cantidadDeFilas()).toBe(antes);
    expect(await tabla.filasSeleccionadas()).toBe(1);
  });
});
