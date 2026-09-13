import { TestBed } from '@angular/core/testing';

import { PractitionerActivity } from './practitioner-activity';

/**
 * Los contadores de «Actividad», que el cliente pidió como tarjetas el
 * 13/09/2026.
 *
 * Lo que se fija acá es lo que el pedido tiene de observable: que cada cuenta
 * tenga su caja, que el rótulo y el valor sean dos textos distintos y que el
 * orden sea el que trae el modelo. El tamaño de la cifra es CSS y se mira en la
 * evidencia de navegador, no acá.
 */
describe('PractitionerActivity', () => {
  const ACTIVIDAD = [
    { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: 312 },
    { clave: 'recetas', rotulo: 'Recetas emitidas', valor: 208 },
  ] as const;

  function montar(actividad: readonly { clave: string; rotulo: string; valor: number }[]) {
    TestBed.configureTestingModule({ imports: [PractitionerActivity] });
    const fixture = TestBed.createComponent(PractitionerActivity);
    fixture.componentRef.setInput('actividad', actividad);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('cada cuenta es una tarjeta, en el orden que trae el modelo', () => {
    const raiz = montar(ACTIVIDAD);

    const tarjetas = [...raiz.querySelectorAll('app-card')];
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas.map((t) => t.getAttribute('data-testid'))).toEqual([
      'actividad-encuentros',
      'actividad-recetas',
    ]);
    expect([...raiz.querySelectorAll('.actividad__rotulo')].map((r) => r.textContent?.trim())).toEqual(
      ['Encuentros atendidos', 'Recetas emitidas'],
    );
    expect([...raiz.querySelectorAll('.actividad__valor')].map((v) => v.textContent?.trim())).toEqual(
      ['312', '208'],
    );
  });

  /**
   * Sin cuentas no se dibuja una caja vacía: la pestaña queda con su nota, que
   * es la que explica de dónde salen los números.
   */
  it('sin cuentas no dibuja ninguna tarjeta', () => {
    expect(montar([]).querySelectorAll('app-card')).toHaveLength(0);
  });
});
