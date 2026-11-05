import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import { ACCORDION_PARENT } from '../accordion.types';
import { AccordionPanel } from './accordion-panel';

/**
 * Un panel de acordeón: el encabezado es un `<button>` real dentro del nivel de
 * título pedido, anuncia `aria-expanded`/`aria-controls`, y plegado es
 * **ausente** (el contenido no está en el DOM). Al abrirse avisa al acordeón
 * padre, que decide si cierra los demás.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionPanel],
  template: `
    <app-accordion-panel heading="Alergias" [level]="nivel()" [(expanded)]="abierto" [disabled]="apagado()">
      <p class="contenido">Penicilina</p>
    </app-accordion-panel>
  `,
})
class Host {
  readonly nivel = signal<2 | 3 | 4 | 5 | 6>(3);
  readonly abierto = signal(false);
  readonly apagado = signal(false);
}

describe('AccordionPanel', () => {
  let fixture: ComponentFixture<Host>;
  let panelOpened: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boton = (): HTMLButtonElement => root().querySelector('.accordion-panel__trigger')!;

  beforeEach(() => {
    panelOpened = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ACCORDION_PARENT, useValue: { panelOpened } }] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('plegado: el contenido no está en el DOM y el botón lo anuncia', () => {
    expect(root().querySelector('.contenido')).toBeNull();
    expect(boton().getAttribute('aria-expanded')).toBe('false');
    expect(boton().textContent).toContain('Alergias');
    expect(root().querySelector('h3 > .accordion-panel__trigger')).not.toBeNull();
  });

  it('tocar el encabezado lo abre, sincroniza el modelo y avisa al acordeón', () => {
    boton().click();
    fixture.detectChanges();

    const region = root().querySelector('[role="region"]')!;
    expect(region.querySelector('.contenido')?.textContent).toBe('Penicilina');
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    expect(boton().getAttribute('aria-controls')).toBe(region.id);
    expect(region.getAttribute('aria-labelledby')).toBe(boton().id);
    expect(fixture.componentInstance.abierto()).toBe(true);
    expect(panelOpened).toHaveBeenCalledTimes(1);
  });

  it('cerrarlo no avisa al acordeón', () => {
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    boton().click();
    fixture.detectChanges();

    expect(root().querySelector('.contenido')).toBeNull();
    expect(panelOpened).not.toHaveBeenCalled();
  });

  it('deshabilitado no se abre', () => {
    fixture.componentInstance.apagado.set(true);
    fixture.detectChanges();
    boton().click();
    fixture.detectChanges();

    expect(boton().disabled).toBe(true);
    expect(fixture.componentInstance.abierto()).toBe(false);
  });

  it.each([2, 4, 5, 6] as const)('respeta el nivel de título h%s', (nivel) => {
    fixture.componentInstance.nivel.set(nivel);
    fixture.detectChanges();
    expect(root().querySelector(`h${nivel} > .accordion-panel__trigger`)).not.toBeNull();
  });

  it('collapse() lo pliega desde afuera', () => {
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    (fixture.debugElement.children[0]!.componentInstance as AccordionPanel).collapse();
    fixture.detectChanges();

    expect(fixture.componentInstance.abierto()).toBe(false);
  });
});
