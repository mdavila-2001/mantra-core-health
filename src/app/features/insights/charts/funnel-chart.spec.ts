import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FunnelChart, type FunnelStage } from './funnel-chart';

/**
 * El embudo de Insights. La primera etapa es la entrada (otra magnitud: no se
 * dibuja a escala); cada etapa siguiente es un botón con su tasa respecto de
 * la anterior, cuántos se pierden y su brecha con el benchmark; la peor brecha
 * (< −5 %) se señala en texto, no sólo con color.
 */

const ETAPAS: readonly FunnelStage[] = [
  { id: 'imp', label: 'Impresiones', value: 100000 },
  { id: 'vis', label: 'Visitas', value: 1000, benchmarkRate: 0.01 },
  { id: 'reg', label: 'Registros', value: 200, benchmarkRate: 0.4 },
  { id: 'cita', label: 'Citas', value: 150, benchmarkRate: 0.7, changeVsPrevious: 0.1 },
];

describe('FunnelChart', () => {
  let fixture: ComponentFixture<FunnelChart>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const filas = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('.fc__row'));

  function pintar(selectedId: string | null = null): void {
    fixture = TestBed.createComponent(FunnelChart);
    fixture.componentRef.setInput('stages', ETAPAS);
    fixture.componentRef.setInput('ariaLabel', 'Embudo de conversión');
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
  }

  it('la entrada va aparte y no se dibuja a escala', () => {
    pintar();
    expect(root().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Embudo de conversión');
    expect(root().querySelector('.fc__head-name')?.textContent).toBe('Impresiones');
    expect(filas()).toHaveLength(3);
  });

  it('el ancho es relativo a la primera etapa dibujada y cada una dice cuántos se pierden', () => {
    pintar();
    const anchos = filas().map((f) => f.querySelector<HTMLElement>('.fc__bar')!.style.inlineSize);
    expect(anchos).toEqual(['100%', '20%', '15%']);
    expect(filas()[1]!.querySelector('.fc__drop')?.textContent).toContain('se pierden');
  });

  it('señala en texto la etapa con la peor brecha contra el benchmark', () => {
    pintar();
    const peor = filas().filter((f) => f.classList.contains('fc__row--worst'));
    expect(peor).toHaveLength(1);
    expect(peor[0]!.querySelector('.fc__name')?.textContent).toBe('Registros');
    expect(peor[0]!.querySelector('.fc__flag')?.textContent).toBe('Mayor pérdida frente al benchmark');
  });

  it('cada etapa es un botón que emite su id y se anuncia presionado al elegirla', () => {
    pintar('cita');
    const elegidas: string[] = [];
    fixture.componentInstance.picked.subscribe((id) => elegidas.push(id));
    const botones = Array.from(root().querySelectorAll<HTMLButtonElement>('.fc__btn'));
    expect(botones[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(botones[0]!.getAttribute('aria-label')).toMatch(/^Visitas: /);
    botones[1]!.click();
    expect(elegidas).toEqual(['reg']);
  });
});
