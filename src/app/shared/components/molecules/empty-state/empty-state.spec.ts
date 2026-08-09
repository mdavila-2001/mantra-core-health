import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { EmptyState } from './empty-state';
import { EMPTY_STATE_VARIANTS, type EmptyStateVariant } from './empty-state.types';

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state [title]="title()" [description]="description()" [variant]="variant()">
      @if (conIcono()) {
        <svg empty-icon viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>
      }
      @if (conAcciones()) {
        <button empty-actions type="button">Limpiar filtros</button>
      }
    </app-empty-state>
  `,
})
class HostComponent {
  readonly title = signal('Sin resultados');
  readonly description = signal('');
  readonly variant = signal<EmptyStateVariant>('empty');
  readonly conIcono = signal(false);
  readonly conAcciones = signal(false);
}

describe('EmptyState', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function estado(): HTMLElement {
    const element = fixture.nativeElement.querySelector('app-empty-state');
    if (!(element instanceof HTMLElement)) {
      throw new Error('el estado vacío no está en el DOM');
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('región viva', () => {
    it('`no-results` se anuncia: es la respuesta a una búsqueda', async () => {
      host.variant.set('no-results');
      await fixture.whenStable();

      expect(estado().getAttribute('role')).toBe('status');
      expect(estado().getAttribute('aria-live')).toBe('polite');
    });

    it('`empty` y `error` no son regiones vivas: hablarían de más', async () => {
      for (const variant of ['empty', 'error'] as const) {
        host.variant.set(variant);
        await fixture.whenStable();

        expect(estado().hasAttribute('role')).toBe(false);
        expect(estado().hasAttribute('aria-live')).toBe(false);
      }
    });
  });

  describe('contenido', () => {
    it('el título siempre está', () => {
      expect(estado().querySelector('.empty-state__title')?.textContent?.trim()).toBe(
        'Sin resultados',
      );
    });

    it('la descripción es opcional', async () => {
      expect(estado().querySelector('.empty-state__description')).toBeNull();

      host.description.set('Probá con otro documento o apellido.');
      await fixture.whenStable();

      expect(estado().querySelector('.empty-state__description')?.textContent?.trim()).toBe(
        'Probá con otro documento o apellido.',
      );
    });

    it('cada variante genera su modificador BEM', async () => {
      for (const variant of EMPTY_STATE_VARIANTS) {
        host.variant.set(variant);
        await fixture.whenStable();

        expect(estado().classList.contains(`empty-state--${variant}`)).toBe(true);
      }
    });
  });

  describe('huecos', () => {
    /** El `@if` del consumidor deja un comentario; CSS lo ignora para `:empty`. */
    it('sin proyección quedan vacíos y el CSS los apaga', () => {
      for (const hueco of ['.empty-state__icon', '.empty-state__actions']) {
        const elemento = estado().querySelector(hueco);
        expect(elemento?.children).toHaveLength(0);
        expect(elemento?.textContent?.trim()).toBe('');
      }
    });

    it('la ilustración se proyecta y nunca se anuncia', async () => {
      host.conIcono.set(true);
      await fixture.whenStable();

      const hueco = estado().querySelector('.empty-state__icon');
      expect(hueco?.querySelector('svg')).not.toBeNull();
      expect(hueco?.getAttribute('aria-hidden')).toBe('true');
    });

    it('las acciones se proyectan en su hueco', async () => {
      host.conAcciones.set(true);
      await fixture.whenStable();

      expect(
        estado().querySelector('.empty-state__actions')?.querySelector('button'),
      ).not.toBeNull();
    });
  });
});
