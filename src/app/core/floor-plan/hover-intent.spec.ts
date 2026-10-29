import {
  HoverIntent,
  PLAN_FOCUS_OPEN_MS,
  PLAN_HOVER_CLOSE_MS,
  PLAN_HOVER_OPEN_MS,
  PLAN_HOVER_WARM_MS,
  reduceTouch,
  type HoverScheduler,
} from './hover-intent';

/** Reloj y temporizadores falsos: la máquina se recorre sin esperar. */
class FakeClock implements HoverScheduler {
  time = 0;
  private nextHandle = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();
  now(): number {
    return this.time;
  }
  setTimer(callback: () => void, ms: number): unknown {
    const handle = this.nextHandle++;
    this.timers.set(handle, { at: this.time + ms, run: callback });
    return handle;
  }
  clearTimer(handle: unknown): void {
    this.timers.delete(handle as number);
  }
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined) break;
      this.time = due[1].at;
      this.timers.delete(due[0]);
      due[1].run();
    }
    this.time = target;
  }
}

describe('intención de hover (CONTRATO-PLANO §5.6)', () => {
  let clock: FakeClock;
  let log: (string | null)[];
  let intent: HoverIntent;

  beforeEach(() => {
    clock = new FakeClock();
    log = [];
    intent = new HoverIntent((id) => log.push(id), clock);
  });

  it('abre tras 300 ms de permanencia y no antes', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS - 1);
    expect(log).toEqual([]);
    clock.advance(1);
    expect(log).toEqual(['a']);
  });

  it('pasar de largo (salir antes de 300 ms) no abre nada', () => {
    intent.pointerEnter('a');
    clock.advance(100);
    intent.pointerLeave('a');
    clock.advance(1000);
    expect(log).toEqual([]);
  });

  it('cierra 200 ms después de salir del espacio', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.pointerLeave('a');
    clock.advance(PLAN_HOVER_CLOSE_MS - 1);
    expect(intent.activeId).toBe('a');
    clock.advance(1);
    expect(intent.activeId).toBeNull();
    expect(log).toEqual(['a', null]);
  });

  it('es hoverable: llegar a la tarjeta dentro del puente la mantiene abierta, y salir de ella la cierra', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.pointerLeave('a');
    clock.advance(PLAN_HOVER_CLOSE_MS / 2);
    intent.cardEnter();
    clock.advance(5000);
    expect(intent.activeId).toBe('a');
    intent.cardLeave();
    clock.advance(PLAN_HOVER_CLOSE_MS);
    expect(intent.activeId).toBeNull();
  });

  it('con una tarjeta abierta, pasar a otro espacio abre la nueva sin espera (singleton)', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.pointerLeave('a');
    clock.advance(50);
    intent.pointerEnter('b');
    expect(intent.activeId).toBe('b');
    expect(log).toEqual(['a', 'b']);
  });

  it('si la anterior se cerró hace menos de 400 ms, la siguiente también abre sin espera', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.pointerLeave('a');
    clock.advance(PLAN_HOVER_CLOSE_MS);
    clock.advance(PLAN_HOVER_WARM_MS - PLAN_HOVER_CLOSE_MS - 50);
    intent.pointerEnter('b');
    expect(intent.activeId).toBe('b');
  });

  it('pasados 400 ms desde el cierre vuelve a esperar los 300 ms', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.pointerLeave('a');
    clock.advance(PLAN_HOVER_CLOSE_MS + PLAN_HOVER_WARM_MS + 10);
    intent.pointerEnter('b');
    expect(intent.activeId).toBeNull();
    clock.advance(PLAN_HOVER_OPEN_MS);
    expect(intent.activeId).toBe('b');
  });

  it('Escape la descarta y no reaparece mientras el puntero siga sobre el mismo espacio', () => {
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    intent.dismiss();
    expect(intent.activeId).toBeNull();
    intent.pointerEnter('a');
    clock.advance(5000);
    expect(intent.activeId).toBeNull();
    // Salir y volver a entrar sí la reabre.
    intent.pointerLeave('a');
    intent.pointerEnter('a');
    clock.advance(PLAN_HOVER_OPEN_MS);
    expect(intent.activeId).toBe('a');
  });

  it('el foco abre con 120 ms de anti-rebote y mantener una flecha no abre las intermedias', () => {
    intent.focus('a');
    clock.advance(PLAN_FOCUS_OPEN_MS - 20);
    intent.focus('b');
    clock.advance(PLAN_FOCUS_OPEN_MS - 20);
    intent.focus('c');
    clock.advance(PLAN_FOCUS_OPEN_MS);
    expect(log).toEqual(['c']);
  });

  it('perder el foco la cierra al instante', () => {
    intent.focus('a');
    clock.advance(PLAN_FOCUS_OPEN_MS);
    intent.blur();
    expect(intent.activeId).toBeNull();
  });

  it('una tarjeta abierta por foco no se cierra porque el puntero pase y salga de otro espacio', () => {
    intent.focus('a');
    clock.advance(PLAN_FOCUS_OPEN_MS);
    intent.pointerLeave('b');
    clock.advance(1000);
    expect(intent.activeId).toBe('a');
  });

  it('destruir cancela los temporizadores pendientes', () => {
    intent.pointerEnter('a');
    intent.destroy();
    clock.advance(1000);
    expect(log).toEqual([]);
  });
});

describe('regla táctil', () => {
  it('primer toque abre la tarjeta; segundo toque sobre el mismo abre la ficha', () => {
    const first = reduceTouch({ openId: null }, 'a');
    expect(first.outcome).toEqual({ action: 'open-card', id: 'a' });
    const second = reduceTouch(first.state, 'a');
    expect(second.outcome).toEqual({ action: 'open-file', id: 'a' });
  });

  it('tocar otro espacio cambia la tarjeta en vez de abrir la ficha', () => {
    const next = reduceTouch({ openId: 'a' }, 'b');
    expect(next.outcome).toEqual({ action: 'open-card', id: 'b' });
    expect(next.state.openId).toBe('b');
  });

  it('tocar el fondo la cierra; sin tarjeta no hace nada', () => {
    expect(reduceTouch({ openId: 'a' }, null).outcome).toEqual({ action: 'close' });
    expect(reduceTouch({ openId: null }, null).outcome).toEqual({ action: 'none' });
  });
});
