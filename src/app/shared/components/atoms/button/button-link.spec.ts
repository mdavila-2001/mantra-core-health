import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AppButtonLink } from './button-link';
import type { ButtonSize, ButtonVariant } from './button.types';
import { BUTTON_SIZES, BUTTON_VARIANTS } from './button.types';

/** Host real: el selector es de atributo, el componente vive EN un <a>. */
@Component({
  imports: [AppButtonLink],
  template: `
    <a
      app-button
      href="/pacientes/nuevo"
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled()"
      [iconOnly]="iconOnly()"
    >
      Nuevo paciente
    </a>
  `,
})
class Host {
  readonly variant = signal<ButtonVariant>('primary');
  readonly size = signal<ButtonSize>('md');
  readonly disabled = signal(false);
  readonly iconOnly = signal(false);
}

describe('AppButtonLink', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function anchor(): HTMLAnchorElement {
    const element = fixture.nativeElement.querySelector('a');
    if (!(element instanceof HTMLAnchorElement)) {
      throw new Error('el host <a> no está en el DOM');
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('es un ancla de verdad, con su destino intacto', () => {
    // Es la razón de existir de la pieza: sobre un <button> se pierden el
    // clic-medio, «abrir en pestaña nueva» y el destino en la barra de estado.
    expect(anchor().tagName).toBe('A');
    expect(anchor().getAttribute('href')).toBe('/pacientes/nuevo');
  });

  it('viste el ancla con las mismas clases que el botón', () => {
    expect(anchor().className).toContain('btn');
    expect(anchor().className).toContain('btn--primary');
    expect(anchor().className).toContain('btn--md');
  });

  it.each(BUTTON_VARIANTS)('refleja la variante %s', (variant) => {
    host.variant.set(variant);
    fixture.detectChanges();

    expect(anchor().className).toContain(`btn--${variant}`);
  });

  it.each(BUTTON_SIZES)('refleja el tamaño %s', (size) => {
    host.size.set(size);
    fixture.detectChanges();

    expect(anchor().className).toContain(`btn--${size}`);
  });

  it('marca el modo solo-ícono', () => {
    host.iconOnly.set(true);
    fixture.detectChanges();

    expect(anchor().className).toContain('btn--icon-only');
  });

  it('no anuncia deshabilitado cuando no lo está', () => {
    // `aria-disabled="false"` es ruido para el lector de pantalla.
    expect(anchor().hasAttribute('aria-disabled')).toBe(false);
  });

  it('anuncia el deshabilitado sin dejar de ser enfocable', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    expect(anchor().getAttribute('aria-disabled')).toBe('true');
    expect(anchor().className).toContain('btn--disabled');
    // Sigue en el orden de tabulación: el lector anuncia el estado en vez de
    // que el control desaparezca de golpe.
    expect(anchor().getAttribute('tabindex')).not.toBe('-1');
  });

  it('corta la navegación mientras está deshabilitado', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    anchor().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('deja pasar el clic cuando está habilitado', () => {
    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    anchor().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
