import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { PerformerSelectionCode } from '../../../../core/data-access/diagnostics/service-request-performer.types';
import { OrderPerformerSummary } from './order-performer-summary';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrderPerformerSummary],
  template: `<app-order-performer-summary [mode]="mode()" [siteName]="siteName()" />`,
})
class Anfitrion {
  readonly mode = signal<PerformerSelectionCode | null>(null);
  readonly siteName = signal<string | null>(null);
}

describe('OrderPerformerSummary', () => {
  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const buscar = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
    return { fixture, texto, buscar };
  }

  it('sin modo no pinta nada', () => {
    const { fixture, buscar } = montar();
    fixture.componentInstance.siteName.set('Centro Médico Sur');
    fixture.detectChanges();

    expect(buscar('order-performer-summary')).toBeNull();
  });

  it('ORGANIZATION pinta el modo, la sede por su nombre y el aviso de recomendación', () => {
    const { fixture, buscar } = montar();
    fixture.componentInstance.mode.set('ORGANIZATION');
    fixture.componentInstance.siteName.set('Centro Médico Sur — Sede Central');
    fixture.detectChanges();

    expect(buscar('order-performer-mode')?.textContent).toContain('Su médico sugirió un centro');
    expect(buscar('order-performer-site')?.textContent).toContain('Centro Médico Sur — Sede Central');
    expect(buscar('order-performer-recommendation')?.textContent).toContain(
      'Es una recomendación: puede elegir otro centro.',
    );
  });

  it('SELF también avisa que es una recomendación', () => {
    const { fixture, buscar } = montar();
    fixture.componentInstance.mode.set('SELF');
    fixture.detectChanges();

    expect(buscar('order-performer-mode')?.textContent).toContain('Su médico se ofreció a hacerlo');
    expect(buscar('order-performer-recommendation')).not.toBeNull();
    expect(buscar('order-performer-site')).toBeNull();
  });

  it('PATIENT_CHOICE dice que puede elegir y no recomienda nada', () => {
    const { fixture, buscar } = montar();
    fixture.componentInstance.mode.set('PATIENT_CHOICE');
    fixture.detectChanges();

    expect(buscar('order-performer-mode')?.textContent).toContain('Puede elegir dónde hacérselo');
    expect(buscar('order-performer-recommendation')).toBeNull();
    expect(buscar('order-performer-site')).toBeNull();
  });
});
