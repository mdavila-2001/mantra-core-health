import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { DropVerdict } from './agenda-actions';
import { AgendaDragController, DRAG_THRESHOLD_PX, type DragHost } from './agenda-drag';

function puntero(tipo: string, x: number, y: number, extra: PointerEventInit = {}): PointerEvent {
  const e = new Event(tipo, { bubbles: true }) as unknown as Record<string, unknown>;
  Object.assign(e, { clientX: x, clientY: y, button: 0, pointerType: 'mouse', ...extra });
  return e as unknown as PointerEvent;
}

describe('arrastre de una cita', () => {
  let bajo: string | null;
  let veredicto: DropVerdict;
  let drop: Mock<(source: string, target: string) => void>;
  let rejected: Mock<(source: string, reason: string | null) => void>;
  let host: DragHost;
  let ctrl: AgendaDragController;

  beforeEach(() => {
    bajo = null;
    veredicto = { ok: true, warnings: [] };
    drop = vi.fn<(source: string, target: string) => void>();
    rejected = vi.fn<(source: string, reason: string | null) => void>();
    host = {
      hit: () => bajo,
      canStart: (id) => id === 'cita',
      verdict: () => veredicto,
      label: () => '10:00 · Rosa M.',
      drop: (source, target) => drop(source, target),
      rejected: (source, reason) => rejected(source, reason),
    };
    ctrl = new AgendaDragController(host, document);
  });

  afterEach(() => ctrl.destroy());

  const mover = (x: number, y: number): void => {
    document.dispatchEvent(puntero('pointermove', x, y));
  };
  const soltar = (): void => {
    document.dispatchEvent(puntero('pointerup', 0, 0));
  };

  it('un clic sin moverse no es un arrastre ni traga el clic', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    mover(10 + DRAG_THRESHOLD_PX - 2, 10);
    expect(ctrl.state()).toBeNull();
    soltar();
    expect(drop).not.toHaveBeenCalled();
    expect(ctrl.consumeClick()).toBe(false);
  });

  it('al pasar el umbral empieza y dice qué hay debajo y si sirve', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = 'libre';
    mover(80, 80);
    expect(ctrl.state()).toMatchObject({ sourceId: 'cita', overId: 'libre', verdict: { ok: true }, label: '10:00 · Rosa M.' });
  });

  it('soltar sobre un horario que sirve reprograma, y el clic que sigue se descarta', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = 'libre';
    mover(80, 80);
    soltar();
    expect(drop).toHaveBeenCalledWith('cita', 'libre');
    expect(ctrl.state()).toBeNull();
    expect(ctrl.consumeClick()).toBe(true);
    expect(ctrl.consumeClick()).toBe(false);
  });

  it('soltar sobre uno que no sirve no mueve nada y avisa por qué', () => {
    veredicto = { ok: false, reason: 'Ese horario ya pasó.' };
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = 'pasado';
    mover(80, 80);
    soltar();
    expect(drop).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledWith('cita', 'Ese horario ya pasó.');
  });

  it('soltar sobre nada no mueve nada y no molesta con un aviso', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = null;
    mover(80, 80);
    soltar();
    expect(drop).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledWith('cita', null);
  });

  it('pasar sobre sí misma no cuenta como destino', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = 'cita';
    mover(80, 80);
    expect(ctrl.state()!.overId).toBeNull();
  });

  it('Escape cancela el arrastre', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'cita');
    bajo = 'libre';
    mover(80, 80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ctrl.state()).toBeNull();
    soltar();
    expect(drop).not.toHaveBeenCalled();
  });

  it('solo se arrastra con el botón principal, y no con el dedo (el dedo desliza la grilla)', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10, { button: 2 }), 'cita');
    mover(80, 80);
    expect(ctrl.state()).toBeNull();
    ctrl.pointerDown(puntero('pointerdown', 10, 10, { pointerType: 'touch' }), 'cita');
    mover(80, 80);
    expect(ctrl.state()).toBeNull();
  });

  it('no arranca sobre algo que no se puede arrastrar', () => {
    ctrl.pointerDown(puntero('pointerdown', 10, 10), 'otra');
    mover(80, 80);
    expect(ctrl.state()).toBeNull();
  });
});
