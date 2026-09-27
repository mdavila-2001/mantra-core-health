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

  /* -- La serie y los indicadores (pedido del 19/09/2026) ----------------- */

  it('sin serie ni indicadores no dibuja el gráfico ni el bloque de calidad', () => {
    // Un gráfico de doce meses en cero, o un «0 %» sobre cero citas, dicen
    // menos que el silencio y encima mienten.
    const raiz = montar(ACTIVIDAD);

    expect(raiz.querySelector('app-activity-chart')).toBeNull();
    expect(raiz.querySelector('app-quality-indicators')).toBeNull();
  });

  it('sin serie ni indicadores lo dice con palabras y no muestra ninguna cifra inventada (ID-14)', () => {
    const raiz = montar(ACTIVIDAD);

    expect(raiz.querySelector('[data-testid="actividad-sin-metricas"]')?.textContent?.trim()).toBe(
      'Todavía no hay indicadores de calidad ni evolución mensual para mostrar.',
    );
  });

  it('con serie el aviso de «sin métricas» no aparece', () => {
    TestBed.configureTestingModule({ imports: [PractitionerActivity] });
    const fixture = TestBed.createComponent(PractitionerActivity);
    fixture.componentRef.setInput('actividad', ACTIVIDAD);
    fixture.componentRef.setInput('mensual', [
      { clave: '2026-09', etiqueta: 'sep', etiquetaLarga: 'septiembre de 2026', valor: 33 },
    ]);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="actividad-sin-metricas"]'),
    ).toBeNull();
  });

  it('con serie e indicadores los monta, y el pie dice qué cuenta cada cifra', () => {
    TestBed.configureTestingModule({ imports: [PractitionerActivity] });
    const fixture = TestBed.createComponent(PractitionerActivity);
    fixture.componentRef.setInput('actividad', [
      { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: 312, pie: 'Consultas cerradas.' },
    ]);
    fixture.componentRef.setInput('mensual', [
      { clave: '2026-08', etiqueta: 'ago', etiquetaLarga: 'agosto de 2026', valor: 31 },
      { clave: '2026-09', etiqueta: 'sep', etiquetaLarga: 'septiembre de 2026', valor: 33 },
    ]);
    fixture.componentRef.setInput('calidad', [
      {
        clave: 'asistencia',
        rotulo: 'Asistencia de pacientes',
        valor: '91 %',
        detalle: '312 de 341 citas agendadas',
        proporcion: 312 / 341,
      },
    ]);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('app-activity-chart')).not.toBeNull();
    expect(raiz.querySelector('app-quality-indicators')).not.toBeNull();
    expect(raiz.querySelector('.actividad__pie')?.textContent?.trim()).toBe('Consultas cerradas.');
  });
});
