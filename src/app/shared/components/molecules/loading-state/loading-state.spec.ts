import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { LoadingState } from './loading-state';
import type { LoadingStateSize } from './loading-state.types';

@Component({
  imports: [LoadingState],
  template: `
    <app-loading-state
      [message]="message()"
      [detail]="detail()"
      [lines]="lines()"
      [size]="size()"
    />
  `,
})
class HostComponent {
  readonly message = signal('Revisando si esta consulta ya tiene formulario…');
  readonly detail = signal('');
  readonly lines = signal(0);
  readonly size = signal<LoadingStateSize>('inline');
}

describe('LoadingState', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function estado(): HTMLElement {
    const element = fixture.nativeElement.querySelector('app-loading-state');
    if (!(element instanceof HTMLElement)) {
      throw new Error('el estado de carga no está en el DOM');
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('el host es la única región viva y su texto es el mensaje', () => {
    expect(estado().getAttribute('role')).toBe('status');
    expect(estado().getAttribute('aria-live')).toBe('polite');
    expect(estado().textContent).toContain('Revisando si esta consulta ya tiene formulario…');
    expect(estado().querySelectorAll('[role="status"]').length).toBe(0);
  });

  it('el aro no se anuncia: la espera ya la dice el host', () => {
    const aro = estado().querySelector('app-spinner');
    expect(aro?.getAttribute('aria-hidden')).toBe('true');
    expect(aro?.hasAttribute('role')).toBe(false);
  });

  it('el detalle solo aparece cuando hay', async () => {
    expect(estado().querySelector('.loading-state__detalle')).toBeNull();
    host.detail.set('Así no se registra dos veces.');
    await fixture.whenStable();
    expect(estado().querySelector('.loading-state__detalle')?.textContent).toContain(
      'Así no se registra dos veces.',
    );
  });

  it('la silueta es opcional y respeta la cantidad de líneas', async () => {
    expect(estado().querySelector('app-skeleton')).toBeNull();
    host.lines.set(3);
    await fixture.whenStable();
    expect(estado().querySelectorAll('app-skeleton .skeleton__line').length).toBe(3);
  });

  it('el tamaño se refleja en la clase del host', async () => {
    expect(estado().classList).toContain('loading-state--inline');
    host.size.set('block');
    await fixture.whenStable();
    expect(estado().classList).toContain('loading-state--block');
  });
});
