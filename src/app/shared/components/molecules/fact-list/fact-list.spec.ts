import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FactList } from './fact-list';
import type { Hecho } from './fact-list.types';

/**
 * La tabla campo → valor.
 *
 * Lo que se prueba es lo que **puede fallar en silencio**: que una fila sin
 * valor se cuele, que la lista entera se dibuje vacía, o que el modo no llegue
 * al host —que fue el defecto real: con la clase del modo escrita como
 * selector suelto, la encapsulación de Angular la dejaba sin casar y los pares
 * salían apilados en vez de en dos columnas, sin un error en ninguna parte.
 */
describe('FactList', () => {
  let fixture: ComponentFixture<FactList>;

  function montar(hechos: readonly Hecho[], disposicion?: 'filas' | 'columnas'): HTMLElement {
    fixture = TestBed.createComponent(FactList);
    fixture.componentRef.setInput('hechos', hechos);
    if (disposicion !== undefined) {
      fixture.componentRef.setInput('disposicion', disposicion);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja cada par como campo y valor', () => {
    const host = montar([
      { etiqueta: 'Código', valor: 'LAB-OLIVOS' },
      { etiqueta: 'Sedes', valor: '1' },
    ]);

    const campos = [...host.querySelectorAll('dt')].map((dt) => dt.textContent?.trim());
    const valores = [...host.querySelectorAll('dd')].map((dd) => dd.textContent?.trim());
    expect(campos).toEqual(['Código', 'Sedes']);
    expect(valores).toEqual(['LAB-OLIVOS', '1']);
  });

  it('descarta las filas sin valor en vez de escribir un hueco', () => {
    // Es lo que deja al llamador declarar todos los campos posibles de la ficha
    // de corrido, sin un `@if` por campo, y lo que evita el «Sede: —» repetido.
    const host = montar([
      { etiqueta: 'Código', valor: 'LAB-OLIVOS' },
      { etiqueta: 'Sede', valor: null },
      { etiqueta: 'Modelo', valor: '' },
    ]);

    expect(host.querySelectorAll('dt')).toHaveLength(1);
    expect(host.textContent).not.toContain('Sede');
    expect(host.textContent).not.toContain('Modelo');
  });

  it('no dibuja nada cuando ningún par tiene valor', () => {
    // Una `<dl>` vacía dentro de una card deja un hueco con su separación y su
    // borde: parece un dato que no cargó.
    const host = montar([{ etiqueta: 'Sede', valor: null }]);

    expect(host.querySelector('dl')).toBeNull();
  });

  it('pone el modo en el host, que es de donde cuelga su distribución', () => {
    // El defecto que motivó la prueba: si la clase no llega al host, el CSS de
    // `:host(.lista-hechos--filas)` no aplica y la tabla se apila.
    const host = montar([{ etiqueta: 'Código', valor: 'X' }], 'columnas');

    expect(host.classList).toContain('lista-hechos');
    expect(host.classList).toContain('lista-hechos--columnas');
  });

  it('por omisión va en filas', () => {
    const host = montar([{ etiqueta: 'Código', valor: 'X' }]);

    expect(host.classList).toContain('lista-hechos--filas');
  });

  it('marca el valor con su tono sólo cuando lo trae', () => {
    // El tono es para valores que son un estado. Un código o una fecha van sin
    // él: pintar de verde un número de serie no dice nada.
    const host = montar([
      { etiqueta: 'Estado', valor: 'Operativo', tono: 'ok' },
      { etiqueta: 'Código', valor: 'LAB-1' },
    ]);

    const valores = [...host.querySelectorAll('dd')];
    expect(valores[0]?.getAttribute('data-tono')).toBe('ok');
    expect(valores[1]?.getAttribute('data-tono')).toBeNull();
  });

  it('dibuja el ícono del campo sólo cuando lo declara', () => {
    const host = montar([
      { etiqueta: 'Código', valor: 'X', icono: 'tag' },
      { etiqueta: 'Rol', valor: 'Principal' },
    ]);

    expect(host.querySelectorAll('app-nav-icon')).toHaveLength(1);
  });
});
