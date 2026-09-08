import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FactSection } from './fact-section';
import { BLOQUES_POR_PAGINA, type BloqueDeFicha } from './fact-section.types';

/**
 * La sección de ficha.
 *
 * Se prueba lo que decide **qué se ve**: cuándo aparece cada control, qué
 * queda tras buscar y acotar, y que paginar no deje a nadie mirando un hueco.
 * El dibujo lo prueban `FactList` y `Pagination`, cada uno en el suyo.
 */
describe('FactSection', () => {
  let fixture: ComponentFixture<FactSection>;

  function bloques(cuantos: number, etiqueta?: (i: number) => string): BloqueDeFicha[] {
    return Array.from({ length: cuantos }, (_, i) => ({
      id: `b-${i}`,
      titulo: `Equipo ${i}`,
      hechos: [{ etiqueta: 'Modelo', valor: `Modelo ${i}` }],
      ...(etiqueta === undefined ? {} : { etiquetas: [etiqueta(i)] }),
    }));
  }

  function montar(lista: readonly BloqueDeFicha[]): HTMLElement {
    fixture = TestBed.createComponent(FactSection);
    fixture.componentRef.setInput('icono', 'scan');
    fixture.componentRef.setInput('titulo', 'Equipos');
    fixture.componentRef.setInput('bloques', lista);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function titulos(host: HTMLElement): string[] {
    return [...host.querySelectorAll('.seccion-ficha__bloque-titulo')].map(
      (t) => t.textContent?.trim() ?? '',
    );
  }

  /* -- cuándo aparece cada control ----------------------------------------- */

  it('con pocos bloques no dibuja buscador ni paginador', () => {
    // Un buscador sobre lo que ya está entero en pantalla no ahorra nada, y
    // sugiere que hay algo escondido.
    const host = montar(bloques(3));

    expect(host.querySelector('app-search-field')).toBeNull();
    expect(host.querySelector('app-pagination')).toBeNull();
    expect(titulos(host)).toHaveLength(3);
  });

  it('a partir del umbral aparece el buscador', () => {
    const host = montar(bloques(7));

    expect(host.querySelector('app-search-field')).not.toBeNull();
  });

  it('pagina cuando no entran en una página', () => {
    const host = montar(bloques(BLOQUES_POR_PAGINA + 3));

    expect(host.querySelector('app-pagination')).not.toBeNull();
    expect(titulos(host)).toHaveLength(BLOQUES_POR_PAGINA);
  });

  it('no dibuja chips cuando todas las etiquetas son la misma', () => {
    // Con una sola etiqueta el chip seleccionado muestra «todo» y sin
    // seleccionar también: dos estados que se ven distintos y hacen lo mismo.
    const host = montar(bloques(4, () => 'Operativo'));

    expect(host.querySelectorAll('app-chip')).toHaveLength(0);
  });

  it('dibuja un chip por etiqueta distinta, con su recuento', () => {
    const host = montar(bloques(4, (i) => (i === 0 ? 'En mantenimiento' : 'Operativo')));

    const chips = [...host.querySelectorAll('app-chip')].map((c) => c.textContent?.trim());
    // Ordenados por cuántos hay detrás: el que más tiene, primero.
    expect(chips).toEqual(['Operativo · 3', 'En mantenimiento · 1']);
  });

  /* -- buscar y acotar ------------------------------------------------------ */

  it('busca también por los valores de la tabla, no sólo por el título', () => {
    // Quien escribe «Sysmex» busca un modelo, que es un valor. Un buscador que
    // sólo mirara el nombre no lo encontraría y parecería roto.
    const host = montar([
      { id: 'a', titulo: 'Analizador hematológico', hechos: [{ etiqueta: 'Modelo', valor: 'Sysmex XN-550' }] },
      { id: 'b', titulo: 'Centrífuga', hechos: [{ etiqueta: 'Modelo', valor: 'Hettich Rotina' }] },
    ]);

    fixture.componentInstance['termino'].set('sysmex');
    fixture.detectChanges();

    expect(titulos(host)).toEqual(['Analizador hematológico']);
  });

  it('la búsqueda ignora tildes y mayúsculas', () => {
    const host = montar([
      { id: 'a', titulo: 'Centrífuga refrigerada', hechos: [] },
      { id: 'b', titulo: 'Microscopio', hechos: [] },
    ]);

    fixture.componentInstance['termino'].set('CENTRIFUGA');
    fixture.detectChanges();

    expect(titulos(host)).toEqual(['Centrífuga refrigerada']);
  });

  it('pulsar dos veces el mismo chip lo apaga', () => {
    // Es un interruptor, no un grupo de radios: sin la vuelta atrás no habría
    // forma de decir «ya no quiero filtrar» sin elegir otro.
    const host = montar(bloques(4, (i) => (i === 0 ? 'Averiado' : 'Operativo')));
    const componente = fixture.componentInstance;

    componente['alternarEtiqueta']('Averiado');
    fixture.detectChanges();
    expect(titulos(host)).toHaveLength(1);

    componente['alternarEtiqueta']('Averiado');
    fixture.detectChanges();
    expect(titulos(host)).toHaveLength(4);
  });

  it('el recuento dice los dos números cuando hay filtro puesto', () => {
    // «3» solo haría creer que la sección tiene tres; «de 12» solo escondería
    // que hay un filtro activo.
    const host = montar(bloques(4, (i) => (i === 0 ? 'Averiado' : 'Operativo')));

    expect(host.querySelector('.seccion-ficha__leyenda')?.textContent?.trim()).toBe('4');

    fixture.componentInstance['alternarEtiqueta']('Averiado');
    fixture.detectChanges();

    expect(host.querySelector('.seccion-ficha__leyenda')?.textContent?.trim()).toBe('1 de 4');
  });

  /* -- el cruce entre filtrar y paginar ------------------------------------- */

  it('filtrar devuelve a la página 1 en vez de dejar un hueco', () => {
    // El defecto clásico: estar en la página 3 y escribir algo que deja dos
    // resultados deja a quien filtró mirando una página que no existe.
    const host = montar(bloques(20));
    const componente = fixture.componentInstance;

    componente['pagina'].set(3);
    fixture.detectChanges();
    expect(titulos(host)[0]).toBe('Equipo 12');

    componente['termino'].set('equipo 1');
    fixture.detectChanges();

    expect(componente['paginaActual']()).toBe(1);
    expect(titulos(host).length).toBeGreaterThan(0);
  });

  it('dice que no hay coincidencias y ofrece quitar los filtros', () => {
    const host = montar(bloques(8));

    fixture.componentInstance['termino'].set('no existe nada así');
    fixture.detectChanges();

    expect(host.querySelector('.seccion-ficha__vacio')).not.toBeNull();
    expect(titulos(host)).toHaveLength(0);

    host.querySelector<HTMLButtonElement>('.seccion-ficha__limpiar')?.click();
    fixture.detectChanges();

    expect(titulos(host)).toHaveLength(BLOQUES_POR_PAGINA);
  });
});
