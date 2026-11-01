import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { MENU_PARENT } from '../menu.types';
import { MenuItem } from './menu-item';

/**
 * Un ítem de menú: rol `menuitem`, se activa con clic, Enter o Espacio, y al
 * activarse emite `selected` y le pide al menú que se cierre. Deshabilitado no
 * hace ninguna de las dos cosas.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuItem],
  template: `<app-menu-item [disabled]="apagado()" [destructive]="peligroso()" (selected)="elegidos = elegidos + 1">Borrar</app-menu-item>`,
})
class Host {
  readonly apagado = signal(false);
  readonly peligroso = signal(false);
  elegidos = 0;
}

describe('MenuItem', () => {
  let fixture: ComponentFixture<Host>;
  let close: ReturnType<typeof vi.fn>;

  const item = (): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector('app-menu-item')!;

  beforeEach(() => {
    close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MENU_PARENT, useValue: { close } }] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('se anuncia como menuitem, fuera del orden de tabulación, con su texto', () => {
    expect(item().getAttribute('role')).toBe('menuitem');
    expect(item().getAttribute('tabindex')).toBe('-1');
    expect(item().querySelector('.menu-item__label')?.textContent?.trim()).toBe('Borrar');
    expect(item().hasAttribute('aria-disabled')).toBe(false);
  });

  it('un clic emite selected y cierra el menú', () => {
    item().click();
    expect(fixture.componentInstance.elegidos).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' '])('la tecla «%s» lo activa y no deja pasar el evento', (key) => {
    const evento = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    item().dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.elegidos).toBe(1);
  });

  it('otra tecla no hace nada', () => {
    item().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));
    expect(fixture.componentInstance.elegidos).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('deshabilitado: aria-disabled, sin emitir ni cerrar', () => {
    fixture.componentInstance.apagado.set(true);
    fixture.detectChanges();

    expect(item().getAttribute('aria-disabled')).toBe('true');
    expect(item().classList.contains('menu-item--disabled')).toBe(true);
    item().click();
    expect(fixture.componentInstance.elegidos).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('destructivo lleva su clase', () => {
    fixture.componentInstance.peligroso.set(true);
    fixture.detectChanges();
    expect(item().classList.contains('menu-item--destructive')).toBe(true);
  });
});
