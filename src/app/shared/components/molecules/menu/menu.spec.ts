import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { MenuItem } from './menu-item/menu-item';
import { MenuTrigger } from './menu-trigger/menu-trigger';
import { Menu } from './menu';

@Component({
  imports: [Menu, MenuItem, MenuTrigger],
  template: `
    <button type="button" [appMenuTrigger]="acciones">Acciones</button>
    <app-menu #acciones>
      <app-menu-item (selected)="elegidos.push('imprimir')">Imprimir receta</app-menu-item>
      <app-menu-item [disabled]="sinFirma()" (selected)="elegidos.push('firmar')">
        Firmar digitalmente
      </app-menu-item>
      <app-menu-item destructive (selected)="elegidos.push('anular')">Anular orden</app-menu-item>
    </app-menu>
  `,
})
class HostComponent {
  readonly sinFirma = signal(true);
  readonly elegidos: string[] = [];
}

describe('Menu', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(): HTMLButtonElement {
    const element = root().querySelector('button');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el disparador no está en el DOM');
    }
    return element;
  }

  function panel(): HTMLElement | null {
    return document.querySelector('app-menu');
  }

  function items(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  }

  async function abrir(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  async function teclearEnPanel(key: string): Promise<KeyboardEvent> {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? panel())?.dispatchEvent(evento);
    await fixture.whenStable();
    return evento;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('contrato ARIA del disparador', () => {
    it('declara que abre un menú y a cuál', () => {
      expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger().getAttribute('aria-controls')).toBe(panel()?.id);
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('aria-expanded sigue al estado real', async () => {
      await abrir();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');

      await abrir();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('el panel se anuncia como menú y sus ítems como acciones', async () => {
      await abrir();

      expect(panel()?.getAttribute('role')).toBe('menu');
      expect(items()).toHaveLength(3);
    });
  });

  describe('apertura', () => {
    it('cerrado no renderiza los ítems', () => {
      expect(items()).toHaveLength(0);
      expect(panel()?.getAttribute('aria-hidden')).toBe('true');
    });

    it('el panel se muda al <body> para que no lo recorte ningún overflow', async () => {
      await abrir();

      expect(panel()?.parentElement).toBe(document.body);
    });

    it('al abrir, el foco entra en el primer ítem utilizable', async () => {
      await abrir();

      expect(document.activeElement).toBe(items()[0]);
    });

    it('la flecha abajo también abre', async () => {
      trigger().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();

      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('navegación por teclado', () => {
    beforeEach(async () => {
      await abrir();
    });

    it('la flecha abajo saltea los deshabilitados', async () => {
      await teclearEnPanel('ArrowDown');

      // del 1.º al 3.º: el 2.º está deshabilitado
      expect(document.activeElement).toBe(items()[2]);
    });

    it('da la vuelta al llegar al final', async () => {
      await teclearEnPanel('ArrowDown');
      await teclearEnPanel('ArrowDown');

      expect(document.activeElement).toBe(items()[0]);
    });

    it('la flecha arriba recorre al revés', async () => {
      await teclearEnPanel('ArrowUp');

      expect(document.activeElement).toBe(items()[2]);
    });

    it('Home y End van a los extremos utilizables', async () => {
      await teclearEnPanel('End');
      expect(document.activeElement).toBe(items()[2]);

      await teclearEnPanel('Home');
      expect(document.activeElement).toBe(items()[0]);
    });

    it('las flechas no desplazan la página', async () => {
      const evento = await teclearEnPanel('ArrowDown');

      expect(evento.defaultPrevented).toBe(true);
    });
  });

  describe('elección', () => {
    it('el click emite y cierra', async () => {
      await abrir();
      items()[0].click();
      await fixture.whenStable();

      expect(host.elegidos).toEqual(['imprimir']);
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('Enter emite y cierra', async () => {
      await abrir();
      await teclearEnPanel('Enter');

      expect(host.elegidos).toEqual(['imprimir']);
      expect(items()).toHaveLength(0);
    });

    it('un ítem deshabilitado no emite nada', async () => {
      await abrir();
      items()[1].click();
      await fixture.whenStable();

      expect(host.elegidos).toEqual([]);
      expect(items()[1].getAttribute('aria-disabled')).toBe('true');
    });

    it('el destructivo lleva su modificador, no un color a mano', async () => {
      await abrir();

      expect(items()[2].classList.contains('menu-item--destructive')).toBe(true);
    });
  });

  describe('cierre', () => {
    it('Escape cierra y devuelve el foco al disparador', async () => {
      await abrir();
      await teclearEnPanel('Escape');

      expect(items()).toHaveLength(0);
      expect(document.activeElement).toBe(trigger());
    });

    it('Tab cierra en vez de dejar el panel abierto sin foco', async () => {
      await abrir();
      const evento = await teclearEnPanel('Tab');

      expect(items()).toHaveLength(0);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('un click afuera cierra', async () => {
      await abrir();

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();

      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('un click adentro NO cierra', async () => {
      await abrir();

      items()[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await fixture.whenStable();

      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    });

    it('al cerrar, el panel vuelve a su lugar de origen', async () => {
      const padreOriginal = panel()?.parentElement;

      await abrir();
      expect(panel()?.parentElement).toBe(document.body);

      await teclearEnPanel('Escape');
      expect(panel()?.parentElement).toBe(padreOriginal);
    });
  });

  describe('limpieza', () => {
    it('destruir el componente no deja el panel colgado del body', async () => {
      await abrir();
      // abierto, el panel es hijo directo del <body>
      expect([...document.body.children]).toContain(panel());

      fixture.destroy();

      expect(document.body.querySelector('app-menu')).toBeNull();
    });
  });

  describe('SSR', () => {
    it('en el servidor no abre ni toca el DOM', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      }).compileComponents();

      const servidor = TestBed.createComponent(HostComponent);
      await servidor.whenStable();
      const boton = (servidor.nativeElement as HTMLElement).querySelector('button');

      expect(() => boton?.click()).not.toThrow();
      await servidor.whenStable();

      expect(boton?.getAttribute('aria-expanded')).toBe('false');
      // el panel sigue donde lo declaró la plantilla: nadie lo mudó al <body>
      const panelServidor = (servidor.nativeElement as HTMLElement).querySelector('app-menu');
      expect(panelServidor).not.toBeNull();
      expect(panelServidor?.parentElement).not.toBe(document.body);
      servidor.destroy();
    });
  });
});
