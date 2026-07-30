import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AppButtonComponent } from './app-button';
import type { ButtonSize, ButtonType, ButtonVariant } from './button.types';
import { BUTTON_SIZES, BUTTON_VARIANTS } from './button.types';

/** Host real: el selector es de atributo, el componente vive EN un <button>. */
@Component({
  imports: [AppButtonComponent],
  template: `
    <button
      app-button
      [variant]="variant()"
      [size]="size()"
      [isLoading]="isLoading()"
      [disabled]="disabled()"
      [type]="type()"
      [iconOnly]="iconOnly()"
      (clicked)="clicks.push($event)"
    >
      @if (withIcon()) {
        <svg viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      }
      @if (!iconOnly()) {
        Agendar cita
      }
    </button>
  `,
})
class HostComponent {
  readonly variant = signal<ButtonVariant>('primary');
  readonly size = signal<ButtonSize>('md');
  readonly isLoading = signal(false);
  readonly disabled = signal(false);
  readonly type = signal<ButtonType>('button');
  readonly iconOnly = signal(false);
  readonly withIcon = signal(false);
  readonly clicks: MouseEvent[] = [];
}

describe('AppButtonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function button(): HTMLButtonElement {
    const element = fixture.nativeElement.querySelector('button');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el host <button> no está en el DOM');
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('clases BEM', () => {
    it('por defecto: primary md interactivo', () => {
      // el orden del atributo class no está garantizado: se compara el conjunto
      expect([...button().classList].sort()).toEqual(['btn', 'btn--md', 'btn--primary']);
    });

    it('cada variante y tamaño generan su modificador', async () => {
      for (const variant of BUTTON_VARIANTS) {
        for (const size of BUTTON_SIZES) {
          host.variant.set(variant);
          host.size.set(size);
          await fixture.whenStable();
          expect(button().classList.contains(`btn--${variant}`)).toBe(true);
          expect(button().classList.contains(`btn--${size}`)).toBe(true);
        }
      }
    });

    it('loading y disabled agregan sus modificadores', async () => {
      host.isLoading.set(true);
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button().classList.contains('btn--loading')).toBe(true);
      expect(button().classList.contains('btn--disabled')).toBe(true);
    });
  });

  describe('interacción', () => {
    it('interactivo: el click se emite con el MouseEvent original', () => {
      const event = new MouseEvent('click', { cancelable: true });
      button().dispatchEvent(event);

      expect(host.clicks).toEqual([event]);
      expect(event.defaultPrevented).toBe(false);
    });

    it('disabled: no emite y frena el evento (preventDefault + stopPropagation)', async () => {
      host.disabled.set(true);
      await fixture.whenStable();
      const event = new MouseEvent('click', { cancelable: true, bubbles: true });
      const propagacion = vi.spyOn(event, 'stopPropagation');

      button().dispatchEvent(event);

      expect(host.clicks).toEqual([]);
      expect(event.defaultPrevented).toBe(true);
      expect(propagacion).toHaveBeenCalled();
    });

    it('loading: tampoco emite', async () => {
      host.isLoading.set(true);
      await fixture.whenStable();
      const event = new MouseEvent('click', { cancelable: true });

      button().dispatchEvent(event);

      expect(host.clicks).toEqual([]);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('accesibilidad y semántica', () => {
    it('type=button por defecto: no dispara submits por accidente', () => {
      expect(button().getAttribute('type')).toBe('button');
    });

    it('acepta type=submit explícito', async () => {
      host.type.set('submit');
      await fixture.whenStable();
      expect(button().getAttribute('type')).toBe('submit');
    });

    it('aria-disabled y aria-busy reflejan el estado', async () => {
      expect(button().getAttribute('aria-disabled')).toBe('false');
      expect(button().getAttribute('aria-busy')).toBe('false');

      host.disabled.set(true);
      host.isLoading.set(true);
      await fixture.whenStable();

      expect(button().getAttribute('aria-disabled')).toBe('true');
      expect(button().getAttribute('aria-busy')).toBe('true');
    });

    it('disabled sigue enfocable: no usa el atributo nativo', async () => {
      host.disabled.set(true);
      await fixture.whenStable();

      expect(button().hasAttribute('disabled')).toBe(false);
      button().focus();
      expect(document.activeElement).toBe(button());
    });
  });

  describe('spinner de carga', () => {
    it('no existe en reposo', () => {
      expect(button().querySelector('.btn__spinner')).toBeNull();
    });

    it('aparece oculto para lectores de pantalla durante la carga', async () => {
      host.isLoading.set(true);
      await fixture.whenStable();

      const spinner = button().querySelector('.btn__spinner');
      expect(spinner).not.toBeNull();
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    });

    it('el contenido proyectado sigue en el DOM (conserva el ancho)', async () => {
      host.isLoading.set(true);
      await fixture.whenStable();

      expect(button().textContent).toContain('Agendar cita');
    });
  });

  describe('íconos', () => {
    it('proyecta el SVG junto al texto sin envolverlo', async () => {
      host.withIcon.set(true);
      await fixture.whenStable();

      expect(button().querySelector('svg')).not.toBeNull();
      expect(button().textContent).toContain('Agendar cita');
    });

    it('iconOnly agrega su modificador de geometría, no de color', async () => {
      host.iconOnly.set(true);
      host.withIcon.set(true);
      host.variant.set('neutral');
      await fixture.whenStable();

      expect(button().classList.contains('btn--icon-only')).toBe(true);
      expect(button().classList.contains('btn--neutral')).toBe(true);
    });

    it('el ícono convive con la carga: spinner y SVG a la vez', async () => {
      host.iconOnly.set(true);
      host.withIcon.set(true);
      host.isLoading.set(true);
      await fixture.whenStable();

      // el SVG no se desmonta (usa currentColor y se apaga por CSS)
      expect(button().querySelector('svg')).not.toBeNull();
      expect(button().querySelector('.btn__spinner')).not.toBeNull();
      expect(button().getAttribute('aria-busy')).toBe('true');
    });

    it('avisa en desarrollo si un iconOnly no tiene nombre accesible', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      host.iconOnly.set(true);
      host.withIcon.set(true);

      const nuevo = TestBed.createComponent(HostComponent);
      nuevo.componentInstance.iconOnly.set(true);
      await nuevo.whenStable();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('iconOnly sin nombre accesible'),
        expect.anything(),
      );
      warn.mockRestore();
    });
  });
});
