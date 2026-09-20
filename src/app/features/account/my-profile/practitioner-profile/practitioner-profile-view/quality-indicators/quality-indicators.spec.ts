import { TestBed } from '@angular/core/testing';

import { QualityIndicators } from './quality-indicators';
import type { IndicadorDeCalidad } from '../practitioner-profile-view.types';

/**
 * Los indicadores de calidad de la atención.
 *
 * Lo que se fija acá: que cada indicador muestre su denominador, que sólo los
 * que SON una proporción dibujen barra, y que el logro se diga además de
 * pintarse —el color no comunica solo—.
 */
describe('QualityIndicators', () => {
  const ASISTENCIA: IndicadorDeCalidad = {
    clave: 'asistencia',
    rotulo: 'Asistencia de pacientes',
    valor: '91 %',
    detalle: '312 de 341 citas agendadas',
    proporcion: 312 / 341,
  };

  const VALORACION: IndicadorDeCalidad = {
    clave: 'valoracion',
    rotulo: 'Valoración de pacientes',
    valor: '4,7 / 5',
    detalle: '128 valoraciones',
    proporcion: null,
  };

  function montar(indicadores: readonly IndicadorDeCalidad[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [QualityIndicators] });
    const fixture = TestBed.createComponent(QualityIndicators);
    fixture.componentRef.setInput('indicadores', indicadores);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('cada indicador muestra su cifra Y de dónde sale', () => {
    const raiz = montar([ASISTENCIA]);

    expect(raiz.querySelector('.calidad__valor')?.textContent?.trim()).toBe('91 %');
    // El denominador no es un adorno: «91 %» no distingue 10 de 11 de 910 de
    // 1 000, y es la diferencia entre un dato y un titular.
    expect(raiz.querySelector('.calidad__detalle')?.textContent?.trim()).toBe(
      '312 de 341 citas agendadas',
    );
  });

  it('lo que no es una proporción no dibuja barra', () => {
    const raiz = montar([ASISTENCIA, VALORACION]);

    const items = [...raiz.querySelectorAll('.calidad__item')];
    expect(items[0]?.querySelector('.calidad__pista')).not.toBeNull();
    expect(items[1]?.querySelector('.calidad__pista')).toBeNull();
  });

  it('el ancho de la barra es el porcentaje, no un valor cualquiera', () => {
    const raiz = montar([{ ...ASISTENCIA, proporcion: 0.75 }]);

    expect(raiz.querySelector<HTMLElement>('.calidad__barra')?.style.width).toBe('75%');
  });

  it('a partir del 90 % el indicador se marca como logrado', () => {
    const bajo = montar([{ ...ASISTENCIA, proporcion: 0.89 }]);
    expect(bajo.querySelector('.calidad__valor')?.classList.contains('is-logrado')).toBe(false);

    // Segundo montaje: el módulo ya está instanciado, así que hay que
    // reiniciarlo antes de volver a configurarlo.
    TestBed.resetTestingModule();
    const alto = montar([{ ...ASISTENCIA, proporcion: 0.9 }]);
    expect(alto.querySelector('.calidad__valor')?.classList.contains('is-logrado')).toBe(true);
  });

  it('la barra no se lee en voz alta: el dato está en el texto', () => {
    const raiz = montar([ASISTENCIA]);

    expect(raiz.querySelector('.calidad__pista')?.getAttribute('aria-hidden')).toBe('true');
  });
});
