import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Panel } from './panel';

/**
 * El panel de un módulo de Insights: título como encabezado de sección, la
 * pregunta que responde (si se da), herramientas proyectadas arriba y el
 * contenido abajo.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Panel],
  template: `
    <app-ins-panel title="Conversión" question="¿Dónde se pierde la gente?">
      <button panel-tools class="herramienta">Exportar</button>
      <p class="cuerpo">Gráfico</p>
    </app-ins-panel>
    <app-ins-panel title="Sin pregunta"><p>x</p></app-ins-panel>
  `,
})
class Host {}

describe('Panel', () => {
  it('pinta título h2, pregunta, herramientas y contenido en su lugar', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const [panel, sinPregunta] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-ins-panel'));

    expect(panel!.querySelector('h2.pn__title')?.textContent).toBe('Conversión');
    expect(panel!.querySelector('.pn__q')?.textContent).toBe('¿Dónde se pierde la gente?');
    expect(panel!.querySelector('.pn__tools .herramienta')?.textContent).toBe('Exportar');
    expect(panel!.querySelector('.cuerpo')?.closest('.pn__tools')).toBeNull();
    expect(sinPregunta!.querySelector('.pn__q')).toBeNull();
  });
});
