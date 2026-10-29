/* ============================================================================
    Intención de hover: tiempos de apertura y cierre de la tarjeta de detalle
    (CONTRATO-PLANO §5.6, «Disparadores y tiempos») y regla del toque.

    Es una máquina sin DOM: los temporizadores y el reloj se inyectan, así que
    la prueba recorre cada transición con un reloj falso. Cumple WCAG 2.1 SC
    1.4.13: la tarjeta es descartable (`dismiss`), persistente mientras el
    puntero esté sobre el espacio **o sobre la tarjeta** (`hoverable`) y no se
    cierra sola por tiempo.
    ========================================================================== */

/** Permanencia del puntero antes de abrir. */
export const PLAN_HOVER_OPEN_MS = 300;
/** Si ya había una tarjeta abierta (o cerrada hace menos de esto), la siguiente abre sin espera. */
export const PLAN_HOVER_WARM_MS = 400;
/** Puente entre el espacio y la tarjeta: tiempo para llegar a ella sin que se cierre. */
export const PLAN_HOVER_CLOSE_MS = 200;
/** Anti-rebote del foco por teclado cuando se mantiene una flecha. */
export const PLAN_FOCUS_OPEN_MS = 120;
/** Permanencia del puntero/foco para pedir el nombre del paciente. */
export const PLAN_PATIENT_FETCH_MS = 350;

export interface HoverScheduler {
  now(): number;
  setTimer(callback: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const REAL_SCHEDULER: HoverScheduler = {
  now: () => Date.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type HoverSource = 'pointer' | 'focus';

export interface HoverIntentOptions {
  readonly openMs?: number;
  readonly warmMs?: number;
  readonly closeMs?: number;
  readonly focusOpenMs?: number;
}

/**
 * Controla qué espacio tiene la tarjeta abierta. **Singleton por construcción**:
 * hay un solo `active`; abrir otro lo reemplaza.
 */
export class HoverIntent {
  private readonly openMs: number;
  private readonly warmMs: number;
  private readonly closeMs: number;
  private readonly focusOpenMs: number;

  private active: string | null = null;
  private source: HoverSource | null = null;
  private lastClosedAt = Number.NEGATIVE_INFINITY;
  private openTimer: unknown = null;
  private closeTimer: unknown = null;
  private pendingId: string | null = null;
  private overCard = false;
  /** Espacio descartado con Escape: no se reabre hasta que el puntero salga y vuelva a entrar. */
  private dismissedId: string | null = null;

  constructor(
    private readonly onChange: (id: string | null, source: HoverSource | null) => void,
    private readonly scheduler: HoverScheduler = REAL_SCHEDULER,
    options: HoverIntentOptions = {},
  ) {
    this.openMs = options.openMs ?? PLAN_HOVER_OPEN_MS;
    this.warmMs = options.warmMs ?? PLAN_HOVER_WARM_MS;
    this.closeMs = options.closeMs ?? PLAN_HOVER_CLOSE_MS;
    this.focusOpenMs = options.focusOpenMs ?? PLAN_FOCUS_OPEN_MS;
  }

  get activeId(): string | null {
    return this.active;
  }

  /** El puntero entró a un espacio. */
  pointerEnter(id: string): void {
    this.cancelClose();
    if (this.dismissedId === id) return;
    this.dismissedId = null;
    if (this.active === id) {
      this.cancelOpen();
      return;
    }
    const warm = this.active !== null || this.scheduler.now() - this.lastClosedAt < this.warmMs;
    this.scheduleOpen(id, 'pointer', warm ? 0 : this.openMs);
  }

  /** El puntero salió del espacio (puede estar yendo a la tarjeta). */
  pointerLeave(id: string): void {
    if (this.dismissedId === id) this.dismissedId = null;
    if (this.pendingId === id) this.cancelOpen();
    if (this.active === id && this.source === 'pointer') this.scheduleClose();
  }

  /** El puntero entró a la tarjeta: se queda abierta (hoverable). */
  cardEnter(): void {
    this.overCard = true;
    this.cancelClose();
  }

  cardLeave(): void {
    this.overCard = false;
    if (this.active !== null && this.source === 'pointer') this.scheduleClose();
  }

  /** El foco de teclado llegó a un espacio. */
  focus(id: string): void {
    this.cancelClose();
    if (this.dismissedId === id) return;
    this.dismissedId = null;
    if (this.active === id) {
      this.source = 'focus';
      return;
    }
    this.scheduleOpen(id, 'focus', this.focusOpenMs);
  }

  /** El foco salió del lienzo. */
  blur(): void {
    this.cancelOpen();
    this.close();
  }

  /** Escape: descarta sin mover el foco ni el puntero (1.4.13, «descartable»). */
  dismiss(): void {
    this.cancelOpen();
    const id = this.active ?? this.pendingId;
    if (this.active !== null) {
      this.dismissedId = this.active;
      this.close();
    } else if (id !== null) {
      this.dismissedId = id;
    }
  }

  /** Cierre inmediato (clic en el fondo, otro espacio seleccionado, destrucción). */
  closeNow(): void {
    this.cancelOpen();
    this.close();
  }

  destroy(): void {
    this.cancelOpen();
    this.cancelClose();
    this.active = null;
    this.source = null;
  }

  private scheduleOpen(id: string, source: HoverSource, delay: number): void {
    this.cancelOpen();
    const open = (): void => {
      this.openTimer = null;
      this.pendingId = null;
      this.active = id;
      this.source = source;
      this.onChange(id, source);
    };
    if (delay <= 0) {
      open();
      return;
    }
    this.pendingId = id;
    this.openTimer = this.scheduler.setTimer(open, delay);
  }

  private scheduleClose(): void {
    this.cancelClose();
    this.closeTimer = this.scheduler.setTimer(() => {
      this.closeTimer = null;
      if (!this.overCard) this.close();
    }, this.closeMs);
  }

  private close(): void {
    this.cancelClose();
    if (this.active === null) return;
    this.active = null;
    this.source = null;
    this.overCard = false;
    this.lastClosedAt = this.scheduler.now();
    this.onChange(null, null);
  }

  private cancelOpen(): void {
    if (this.openTimer !== null) {
      this.scheduler.clearTimer(this.openTimer);
      this.openTimer = null;
    }
    this.pendingId = null;
  }

  private cancelClose(): void {
    if (this.closeTimer !== null) {
      this.scheduler.clearTimer(this.closeTimer);
      this.closeTimer = null;
    }
  }
}

/* ---- toque ----------------------------------------------------------------- */

export interface TouchState {
  /** Espacio con la tarjeta abierta por un primer toque. */
  readonly openId: string | null;
}

export type TouchOutcome =
  | { readonly action: 'open-card'; readonly id: string }
  | { readonly action: 'open-file'; readonly id: string }
  | { readonly action: 'close' }
  | { readonly action: 'none' };

/**
 * Regla táctil (decisión del contrato, no un patrón del W3C): el primer toque
 * abre la tarjeta y deja el espacio seleccionado; el segundo toque sobre el
 * mismo espacio abre la ficha; tocar otro espacio cambia la tarjeta; tocar el
 * fondo la cierra. No existe el doble toque.
 */
export function reduceTouch(state: TouchState, tappedId: string | null): { state: TouchState; outcome: TouchOutcome } {
  if (tappedId === null) {
    return state.openId === null
      ? { state, outcome: { action: 'none' } }
      : { state: { openId: null }, outcome: { action: 'close' } };
  }
  if (state.openId === tappedId) {
    return { state, outcome: { action: 'open-file', id: tappedId } };
  }
  return { state: { openId: tappedId }, outcome: { action: 'open-card', id: tappedId } };
}
