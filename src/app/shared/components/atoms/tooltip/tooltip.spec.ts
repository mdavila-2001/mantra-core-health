import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Tooltip } from './tooltip';
import { TOOLTIP_HOVER_DELAY_MS, type TooltipPosition } from './tooltip.types';

@Component({
  imports: [Tooltip],
  template: `
    <button
      type="button"
      [appTooltip]="texto()"
      [appTooltipPosition]="posicion()"
      [attr.aria-describedby]="descripcionPrevia()"
    >
      Imprimir
    </button>
  `,
})
class HostComponent {
  readonly texto = signal('Imprimir receta');
  readonly posicion = signal<TooltipPosition>('top');
  readonly descripcionPrevia = signal<string | null>(null);
}

/** Host sin foco ni texto: el caso que la directiva debe denunciar en dev. */
@Component({
  imports: [Tooltip],
  template: `<span appTooltip="Ayuda inalcanzable"></span>`,
})
class HostMudo {}

describe('Tooltip', () => {
  let fixture: ComponentFixture<HostComponent>;

  function host(): HTMLButtonElement {
    const element = fixture.nativeElement.querySelector('button');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el host del tooltip no está en el DOM');
    }
    return element;
  }

  function globo(): HTMLElement | null {
    return document.body.querySelector('app-tooltip-panel');
  }

  /** jsdom no hace layout: el rectángulo del host se dicta para poder aseverar. */
  function fijarRectangulo(rect: Partial<DOMRect>): void {
    const completo = { top: 300, bottom: 340, left: 200, right: 260, width: 60, height: 40 };
    const valores = { ...completo, ...rect };
    host().getBoundingClientRect = (): DOMRect => ({
      ...valores,
      x: valores.left,
      y: valores.top,
      toJSON: () => valores,
    });
  }

  async function abrirConFoco(): Promise<void> {
    host().dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    fijarRectangulo({});
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  describe('apertura', () => {
    it('el foco lo muestra sin espera: el teclado no aguarda', async () => {
      await abrirConFoco();

      expect(globo()?.textContent?.trim()).toBe('Imprimir receta');
    });

    it('el puntero espera antes de abrir', async () => {
      vi.useFakeTimers();

      host().dispatchEvent(new MouseEvent('mouseenter'));
      expect(globo()).toBeNull();

      vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
      await fixture.whenStable();

      expect(globo()).not.toBeNull();
    });

    it('salir antes de tiempo cancela la apertura', async () => {
      vi.useFakeTimers();

      host().dispatchEvent(new MouseEvent('mouseenter'));
      host().dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS * 2);
      await fixture.whenStable();

      expect(globo()).toBeNull();
    });

    it('sin texto no hay globo: un globo vacío es ruido', async () => {
      fixture.componentInstance.texto.set('   ');
      await fixture.whenStable();
      await abrirConFoco();

      expect(globo()).toBeNull();
    });

    it('abrir dos veces no duplica el nodo', async () => {
      await abrirConFoco();
      await abrirConFoco();

      expect(document.body.querySelectorAll('app-tooltip-panel')).toHaveLength(1);
    });
  });

  describe('cierre', () => {
    it('el blur lo oculta', async () => {
      await abrirConFoco();
      host().dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(globo()).toBeNull();
    });

    it('Escape lo oculta sin mover el foco', async () => {
      await abrirConFoco();
      host().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(globo()).toBeNull();
    });

    it('destruir la directiva no deja el globo colgado del body', async () => {
      await abrirConFoco();
      expect(globo()).not.toBeNull();

      fixture.destroy();

      expect(globo()).toBeNull();
    });
  });

  describe('nombre accesible', () => {
    it('describe al host mientras está visible y lo limpia al cerrar', async () => {
      await abrirConFoco();

      const id = host().getAttribute('aria-describedby');
      expect(id).toBeTruthy();
      expect(globo()?.id).toBe(id);
      expect(globo()?.getAttribute('role')).toBe('tooltip');

      host().dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(host().hasAttribute('aria-describedby')).toBe(false);
    });

    it('no pisa la descripción que el host ya tenía', async () => {
      fixture.componentInstance.descripcionPrevia.set('ayuda-existente');
      await fixture.whenStable();

      await abrirConFoco();
      expect(host().getAttribute('aria-describedby')).not.toBe('ayuda-existente');

      host().dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(host().getAttribute('aria-describedby')).toBe('ayuda-existente');
    });

    it('avisa en desarrollo si el host no es alcanzable con teclado', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostMudo] }).compileComponents();
      const mudo = TestBed.createComponent(HostMudo);
      await mudo.whenStable();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('no es enfocable ni tiene texto visible'),
        expect.anything(),
      );
      warn.mockRestore();
      mudo.destroy();
    });
  });

  describe('posicionamiento', () => {
    it('respeta el lado pedido cuando entra', async () => {
      fijarRectangulo({ top: 300, bottom: 340 });
      await abrirConFoco();

      expect(globo()?.classList.contains('tooltip--top')).toBe(true);
    });

    it('voltea al opuesto cuando el lado pedido no entra en el viewport', async () => {
      // Pegado al borde superior: arriba no hay lugar ni para la separación.
      fijarRectangulo({ top: 4, bottom: 44 });
      await abrirConFoco();

      expect(globo()?.classList.contains('tooltip--bottom')).toBe(true);
      expect(globo()?.classList.contains('tooltip--top')).toBe(false);
    });

    it('voltea también en el eje horizontal', async () => {
      fixture.componentInstance.posicion.set('left');
      await fixture.whenStable();
      fijarRectangulo({ left: 2, right: 62 });
      await abrirConFoco();

      expect(globo()?.classList.contains('tooltip--right')).toBe(true);
    });

    it('se coloca con coordenadas de viewport (position: fixed)', async () => {
      fijarRectangulo({ top: 300, bottom: 340, left: 200, right: 260, width: 60 });
      await abrirConFoco();

      // globo de alto 0 en jsdom: arriba del host, menos la separación de 8 px.
      expect(globo()?.style.top).toBe('292px');
      // centrado sobre el host: 200 + 60/2 - 0/2
      expect(globo()?.style.left).toBe('230px');
    });

    /**
     * jsdom no hace layout: el globo mide lo que dicta su texto YA pintado. Si
     * la directiva midiera antes de renderizarlo, mediría la caja vacía.
     */
    function globoQueMideSuTexto(): () => void {
      const original = HTMLElement.prototype.getBoundingClientRect;
      const spy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          if (this.tagName !== 'APP-TOOLTIP-PANEL') {
            return original.call(this);
          }
          const conTexto = (this.textContent ?? '').trim().length > 0;
          const valores = conTexto
            ? { top: 0, left: 0, bottom: 44, right: 200, width: 200, height: 44 }
            : { top: 0, left: 0, bottom: 16, right: 24, width: 24, height: 16 };
          return { ...valores, x: 0, y: 0, toJSON: () => valores };
        });
      return () => spy.mockRestore();
    }

    it('mide el globo con el texto ya pintado: no se monta sobre el host', async () => {
      const restaurar = globoQueMideSuTexto();
      fijarRectangulo({ top: 300, bottom: 340, left: 200, right: 260, width: 60 });
      await abrirConFoco();

      // 300 - 44 - 8: el borde inferior queda 8 px por encima del host.
      expect(globo()?.style.top).toBe('248px');
      // 200 + 60/2 - 200/2: centrado con su ancho real.
      expect(globo()?.style.left).toBe('130px');
      restaurar();
    });

    it('con el globo abierto, un texto nuevo se reescribe y se vuelve a ubicar', async () => {
      const restaurar = globoQueMideSuTexto();
      fixture.componentInstance.texto.set('Buscando…');
      await fixture.whenStable();
      await abrirConFoco();

      fixture.componentInstance.texto.set('Diego · Última consulta: 4 sept 2026 · Chequeo anual');
      await fixture.whenStable();

      expect(globo()?.textContent).toContain('Última consulta');
      expect(globo()?.style.top).toBe('248px');
      restaurar();
    });

    it('si el texto se vacía con el globo abierto, el globo se va', async () => {
      await abrirConFoco();
      fixture.componentInstance.texto.set('');
      await fixture.whenStable();

      expect(globo()).toBeNull();
    });
  });

  describe('SSR', () => {
    it('en el servidor no toca el DOM ni revienta', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      }).compileComponents();

      const servidor = TestBed.createComponent(HostComponent);
      await servidor.whenStable();
      const boton = servidor.nativeElement.querySelector('button') as HTMLButtonElement;

      expect(() => {
        boton.dispatchEvent(new FocusEvent('focus'));
        boton.dispatchEvent(new MouseEvent('mouseenter'));
      }).not.toThrow();

      await servidor.whenStable();
      expect(document.body.querySelector('app-tooltip-panel')).toBeNull();
      expect(boton.hasAttribute('aria-describedby')).toBe(false);
      servidor.destroy();
    });
  });
});
