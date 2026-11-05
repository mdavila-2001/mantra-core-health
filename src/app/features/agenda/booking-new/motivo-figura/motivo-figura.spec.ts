import { Component, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

import { ESPERAR_IMAGEN_DE_VISTA } from '../../../../shared/components/organisms/body-map/body-map';
import { MotivoFigura } from './motivo-figura';

@Component({
  imports: [MotivoFigura],
  template: `<app-motivo-figura [control]="motivo" [maximo]="40" [editable]="editable()" />`,
})
class Anfitrion {
  readonly motivo = new FormControl('', { nonNullable: true });
  readonly editable = signal(true);
}

describe('MotivoFigura', () => {
  function montar() {
    TestBed.configureTestingModule({
      providers: [{ provide: ESPERAR_IMAGEN_DE_VISTA, useValue: false }],
    });
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('ilumina la zona de lo que se escribió en el motivo y lo nombra', () => {
    const { fixture, host, el } = montar();
    host.motivo.setValue('me duele la cabeza desde ayer');
    fixture.detectChanges();

    const cabeza = el.querySelector('[data-testid="reserva-figura-cabeza"]');
    expect(cabeza?.parentElement?.classList.contains('body-map__zona--marcada')).toBe(true);
    expect(el.querySelector('[data-testid="reserva-figura-reconocidos"]')?.textContent).toContain(
      'dolor de cabeza',
    );
  });

  it('al tocar una zona ofrece sus síntomas y elegir uno lo suma al motivo', () => {
    const { fixture, host, el } = montar();
    (el.querySelector('[data-testid="reserva-figura-cabeza"]') as SVGElement).dispatchEvent(
      new MouseEvent('click'),
    );
    fixture.detectChanges();

    const opciones = [
      ...el.querySelectorAll<HTMLButtonElement>('[data-testid="reserva-figura-opciones"] button'),
    ];
    const mareo = opciones.find((b) => b.textContent?.trim() === 'mareo');
    expect(mareo).toBeDefined();
    host.motivo.setValue('Me duele la cabeza');
    fixture.detectChanges();
    mareo!.click();
    expect(host.motivo.value).toBe('Me duele la cabeza, mareo');
  });

  it('no repite lo que el motivo ya dice', () => {
    const { fixture, host, el } = montar();
    host.motivo.setValue('tengo dolor de cabeza');
    fixture.detectChanges();
    (el.querySelector('[data-testid="reserva-figura-cabeza"]') as SVGElement).dispatchEvent(
      new MouseEvent('click'),
    );
    fixture.detectChanges();

    const dolor = [
      ...el.querySelectorAll<HTMLButtonElement>('[data-testid="reserva-figura-opciones"] button'),
    ].find((b) => b.textContent?.trim() === 'dolor de cabeza');
    expect(dolor?.getAttribute('aria-pressed')).toBe('true');
    dolor!.click();
    expect(host.motivo.value).toBe('tengo dolor de cabeza');
  });

  it('no agrega a medias lo que no entra en el tope', () => {
    const { fixture, host, el } = montar();
    host.motivo.setValue('x'.repeat(38));
    (el.querySelector('[data-testid="reserva-figura-cabeza"]') as SVGElement).dispatchEvent(
      new MouseEvent('click'),
    );
    fixture.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('[data-testid="reserva-figura-opciones"] button')]
      .find((b) => b.textContent?.trim() === 'mareo')!
      .click();
    expect(host.motivo.value).toBe('x'.repeat(38));
  });

  it('frente a una alarma dice que no espere al turno', () => {
    const { fixture, host, el } = montar();
    host.motivo.setValue('me duele el pecho y no puedo respirar');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="reserva-figura-alarma"]')).not.toBeNull();
  });

  it('sin edición no ofrece síntomas para agregar', () => {
    const { fixture, host, el } = montar();
    host.editable.set(false);
    fixture.detectChanges();
    (el.querySelector('[data-testid="reserva-figura-cabeza"]') as SVGElement).dispatchEvent(
      new MouseEvent('click'),
    );
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="reserva-figura-opciones"]')).toBeNull();
  });
});
