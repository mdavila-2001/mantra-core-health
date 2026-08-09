import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Card } from './card';
import { CARD_PADDINGS, CARD_VARIANTS } from './card.types';

/** Host con los tres huecos, para ejercer la proyección de verdad. */
@Component({
  imports: [Card],
  template: `
    <app-card
      [variant]="variant()"
      [padding]="padding()"
      [interactive]="interactive()"
      (activated)="activaciones.push($event)"
    >
      @if (conHeader()) {
        <h3 card-header>Signos vitales</h3>
      }
      Frecuencia cardíaca 72 lpm
      @if (conFooter()) {
        <div card-footer>Actualizado hace 3 minutos</div>
      }
      @if (conBoton()) {
        <button type="button">Ver histórico</button>
      }
    </app-card>
  `,
})
class HostComponent {
  readonly variant = signal<'elevated' | 'outlined' | 'flat'>('outlined');
  readonly padding = signal<'none' | 'sm' | 'md' | 'lg'>('md');
  readonly interactive = signal(false);
  readonly conHeader = signal(false);
  readonly conFooter = signal(false);
  readonly conBoton = signal(false);
  readonly activaciones: Event[] = [];
}

describe('Card', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function card(): HTMLElement {
    const element = fixture.nativeElement.querySelector('app-card');
    if (!(element instanceof HTMLElement)) {
      throw new Error('la card no está en el DOM');
    }
    return element;
  }

  function hueco(nombre: 'header' | 'body' | 'footer'): HTMLElement {
    const element = card().querySelector<HTMLElement>(`.card__${nombre}`);
    if (element === null) {
      throw new Error(`el hueco ${nombre} no está en la plantilla`);
    }
    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('variantes y densidad', () => {
    it('por defecto es outlined con padding md', () => {
      expect([...card().classList].sort()).toEqual([
        'card',
        'card--outlined',
        'card--padding-md',
      ]);
    });

    it('cada variante y densidad genera su modificador BEM', async () => {
      for (const variant of CARD_VARIANTS) {
        for (const padding of CARD_PADDINGS) {
          host.variant.set(variant);
          host.padding.set(padding);
          await fixture.whenStable();

          expect(card().classList.contains(`card--${variant}`)).toBe(true);
          expect(card().classList.contains(`card--padding-${padding}`)).toBe(true);
        }
      }
    });
  });

  describe('huecos proyectados', () => {
    /**
     * Un `@if` del consumidor proyecta su nodo ancla —un comentario— aunque la
     * condición sea falsa. CSS ignora los comentarios para `:empty`, así que el
     * hueco igual se apaga; lo que hay que verificar es que no llegue ningún
     * elemento ni texto.
     */
    it('sin contenido, encabezado y pie quedan vacíos y el CSS los apaga', () => {
      for (const nombre of ['header', 'footer'] as const) {
        expect(hueco(nombre).children).toHaveLength(0);
        expect(hueco(nombre).textContent?.trim()).toBe('');
      }
      expect(hueco('body').textContent).toContain('Frecuencia cardíaca');
    });

    it('con contenido, cada hueco recibe lo suyo', async () => {
      host.conHeader.set(true);
      host.conFooter.set(true);
      await fixture.whenStable();

      expect(hueco('header').textContent).toContain('Signos vitales');
      expect(hueco('footer').textContent).toContain('Actualizado hace 3 minutos');
      // el contenido por defecto no se mezcla con los extremos
      expect(hueco('header').textContent).not.toContain('Frecuencia');
    });
  });

  describe('modo estático', () => {
    it('no se anuncia como control ni es enfocable', () => {
      expect(card().hasAttribute('role')).toBe(false);
      expect(card().hasAttribute('tabindex')).toBe(false);
    });

    it('el click no emite nada', () => {
      card().click();

      expect(host.activaciones).toHaveLength(0);
    });
  });

  describe('modo interactivo', () => {
    beforeEach(async () => {
      host.interactive.set(true);
      await fixture.whenStable();
    });

    it('se anuncia como botón y entra en el orden de tabulación', () => {
      expect(card().getAttribute('role')).toBe('button');
      expect(card().getAttribute('tabindex')).toBe('0');
    });

    it('el click la activa', () => {
      card().click();

      expect(host.activaciones).toHaveLength(1);
    });

    it('Enter la activa', async () => {
      card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await fixture.whenStable();

      expect(host.activaciones).toHaveLength(1);
    });

    it('Espacio la activa y no desplaza la página', async () => {
      const evento = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      card().dispatchEvent(evento);
      await fixture.whenStable();

      expect(host.activaciones).toHaveLength(1);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('otras teclas no la activan', async () => {
      card().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await fixture.whenStable();

      expect(host.activaciones).toHaveLength(0);
    });

    it('avisa en desarrollo si contiene controles enfocables', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const conTrampa = TestBed.createComponent(HostComponent);
      conTrampa.componentInstance.interactive.set(true);
      conTrampa.componentInstance.conBoton.set(true);
      await conTrampa.whenStable();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('controles enfocables adentro'),
        expect.anything(),
      );
      warn.mockRestore();
      conTrampa.destroy();
    });

    it('no avisa si no hay controles adentro', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const limpia = TestBed.createComponent(HostComponent);
      limpia.componentInstance.interactive.set(true);
      await limpia.whenStable();

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      limpia.destroy();
    });
  });
});
