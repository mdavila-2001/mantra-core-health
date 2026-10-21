import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ReactionType } from '@core/data-access/community/community.types';

import { ReactionButton } from './reaction-button';
import { REACCIONES_OFRECIDAS, reaccionOfrecida } from './reaction-button.types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactionButton],
  template: `<app-reaction-button
    [actual]="actual()"
    [ocupado]="ocupado()"
    (elegida)="elegidas.push($event)"
    (quitada)="quitadas = quitadas + 1"
  />`,
})
class Host {
  readonly actual = signal<ReactionType | null | undefined>(null);
  readonly ocupado = signal(false);
  readonly elegidas: ReactionType[] = [];
  quitadas = 0;
}

describe('ReactionButton', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const hecho = async (): Promise<void> => {
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await hecho();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
  });

  it('ofrece las cinco reacciones del contrato, con LIKE primero', () => {
    expect(REACCIONES_OFRECIDAS.map((r) => r.tipo)).toEqual(['LIKE', 'LOVE', 'INSIGHTFUL', 'CELEBRATE', 'SUPPORT']);
    expect(reaccionOfrecida('INSIGHTFUL').rotulo).toBe('Interesante');
  });

  describe('el toque simple', () => {
    it('mientras la reacción propia no se sabe, el toque corto no emite (no pisa una que ya existía)', async () => {
      host.actual.set(undefined);
      await hecho();

      q('post-action-like')?.click();

      expect(host.elegidas).toEqual([]);
      expect(host.quitadas).toBe(0);
      expect(q('post-action-like')?.getAttribute('aria-busy')).toBe('true');
      expect(q('post-action-like')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('elegir una reacción concreta del selector sí vale aunque no se sepa la propia: es explícita', async () => {
      host.actual.set(undefined);
      await hecho();

      q('reaction-picker-toggle')?.click();
      await hecho();
      q('reaction-LOVE')?.click();

      expect(host.elegidas).toEqual(['LOVE']);
    });

    it('sin reacción deja LIKE', async () => {
      q('post-action-like')?.click();

      expect(host.elegidas).toEqual(['LIKE']);
      expect(host.quitadas).toBe(0);
    });

    it('con reacción la quita, no manda otra', async () => {
      host.actual.set('LOVE');
      await hecho();

      q('post-action-like')?.click();

      expect(host.quitadas).toBe(1);
      expect(host.elegidas).toEqual([]);
    });

    it('con una escritura en vuelo no acepta otro toque (sin doble envío)', async () => {
      host.ocupado.set(true);
      await hecho();

      q('post-action-like')?.click();

      expect(host.elegidas).toEqual([]);
      expect(q('post-action-like')?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('lo que dice al lector de pantalla', () => {
    it('presionado sólo cuando hay reacción; sin atributo cuando no se sabe', async () => {
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('false');

      host.actual.set('LIKE');
      await hecho();
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('true');

      host.actual.set(undefined);
      await hecho();
      expect(q('post-action-like')?.hasAttribute('aria-pressed')).toBe(false);
    });

    it('el botón muestra el rótulo de la reacción propia', async () => {
      host.actual.set('SUPPORT');
      await hecho();

      expect(q('post-action-like-label')?.textContent?.trim()).toBe('Apoyo');
    });

    it('el chevron tiene nombre accesible y declara si está expandido', async () => {
      const mas = q('reaction-picker-toggle');
      expect(mas?.getAttribute('aria-label')).toBe('Elegir otra reacción');
      expect(mas?.getAttribute('aria-expanded')).toBe('false');

      mas?.click();
      await hecho();

      expect(mas?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('el selector', () => {
    it('el chevron lo abre y lo cierra', async () => {
      q('reaction-picker-toggle')?.click();
      await hecho();
      expect(q('reaction-picker')).not.toBeNull();

      q('reaction-picker-toggle')?.click();
      await hecho();
      expect(q('reaction-picker')).toBeNull();
    });

    it('elegir una emite el tipo y lo cierra', async () => {
      q('reaction-picker-toggle')?.click();
      await hecho();

      q('reaction-CELEBRATE')?.click();
      await hecho();

      expect(host.elegidas).toEqual(['CELEBRATE']);
      expect(q('reaction-picker')).toBeNull();
    });

    it('marca como presionada la reacción actual', async () => {
      host.actual.set('LOVE');
      q('reaction-picker-toggle')?.click();
      await hecho();

      expect(q('reaction-LOVE')?.getAttribute('aria-pressed')).toBe('true');
      expect(q('reaction-LIKE')?.getAttribute('aria-pressed')).toBe('false');
    });

    it('↑ sobre el botón lo abre y manda el foco a la primera opción', async () => {
      q('post-action-like')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await hecho();

      expect(q('reaction-picker')).not.toBeNull();
      expect(document.activeElement).toBe(q('reaction-LIKE'));
    });

    it('← → se mueven entre opciones, con vuelta al extremo', async () => {
      q('post-action-like')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await hecho();

      q('reaction-LIKE')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(document.activeElement).toBe(q('reaction-LOVE'));

      q('reaction-LIKE')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(document.activeElement).toBe(q('reaction-SUPPORT'));
    });

    it('Esc lo cierra y devuelve el foco al botón', async () => {
      q('reaction-picker-toggle')?.click();
      await hecho();

      q('reaction-LIKE')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await hecho();

      expect(q('reaction-picker')).toBeNull();
      expect(document.activeElement).toBe(q('post-action-like'));
    });

    it('un clic fuera lo cierra', async () => {
      q('reaction-picker-toggle')?.click();
      await hecho();

      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await hecho();

      expect(q('reaction-picker')).toBeNull();
    });

    it('con una escritura en vuelo no se abre ni deja elegir', async () => {
      host.ocupado.set(true);
      await hecho();

      q('reaction-picker-toggle')?.click();
      await hecho();

      expect(q('reaction-picker')).toBeNull();
    });
  });

  describe('puntero', () => {
    const evento = (tipo: string, pointerType: string): Event => {
      const e = new Event(tipo, { bubbles: true });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      return e;
    };

    it('con el mouse, mantener el puntero encima abre el selector tras una demora', async () => {
      vi.useFakeTimers();
      (fixture.nativeElement.querySelector('app-reaction-button') as HTMLElement).dispatchEvent(evento('pointerenter', 'mouse'));

      vi.advanceTimersByTime(200);
      await hecho();
      expect(q('reaction-picker')).toBeNull();

      vi.advanceTimersByTime(300);
      await hecho();
      expect(q('reaction-picker')).not.toBeNull();
    });

    it('pasar el mouse de largo no lo abre', async () => {
      vi.useFakeTimers();
      const contenedor = fixture.nativeElement.querySelector('app-reaction-button') as HTMLElement;
      contenedor.dispatchEvent(evento('pointerenter', 'mouse'));
      vi.advanceTimersByTime(100);
      contenedor.dispatchEvent(evento('pointerleave', 'mouse'));
      vi.advanceTimersByTime(1000);
      await hecho();

      expect(q('reaction-picker')).toBeNull();
    });

    it('con el dedo, la pulsación larga lo abre y el clic que la sigue no cuenta como toque', async () => {
      vi.useFakeTimers();
      const boton = q('post-action-like');
      boton?.dispatchEvent(evento('pointerdown', 'touch'));
      vi.advanceTimersByTime(600);
      await hecho();
      expect(q('reaction-picker')).not.toBeNull();

      boton?.click();
      expect(host.elegidas).toEqual([]);
    });

    it('un toque corto con el dedo no abre el selector', async () => {
      vi.useFakeTimers();
      const boton = q('post-action-like');
      boton?.dispatchEvent(evento('pointerdown', 'touch'));
      vi.advanceTimersByTime(100);
      boton?.dispatchEvent(evento('pointerup', 'touch'));
      vi.advanceTimersByTime(1000);
      await hecho();

      expect(q('reaction-picker')).toBeNull();
    });
  });
});
