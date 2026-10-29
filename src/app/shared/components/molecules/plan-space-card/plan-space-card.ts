import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { PlanCardModel } from '../../../../core/floor-plan/card-model';
import { AppButton } from '../../atoms/button/button';
import { placeFloating, type Placement } from '../../atoms/tooltip/floating-placement';
import type { CanvasHover } from '../../../../core/floor-plan/canvas.types';
import { PlanGlyphIcon } from '../../atoms/plan-glyph/plan-glyph-icon';

/** Separación entre el espacio y la tarjeta, y margen con el borde del lienzo (`--sp-2`). */
export const PLAN_CARD_GAP_PX = 10;
export const PLAN_CARD_MARGIN_PX = 8;

/**
 * Tarjeta de detalle de un espacio (CONTRATO-PLANO §5.6). Presentacional: no
 * pide nada; todo viene en `model`, armado con datos que ya están en el cliente.
 *
 * Se pinta en una capa HTML **fuera del SVG** (no se escala con el zoom ni la
 * recorta el `viewBox`), `position: fixed`, con el mismo motor *flip + shift*
 * de la directiva `Tooltip` (`placeFloating`). Si el espacio es bastante más
 * grande que la tarjeta, se ancla al cursor.
 *
 * - Por puntero o teclado es un *tooltip* de solo lectura (`role="tooltip"`),
 *   *hoverable* y descartable con `Escape` (WCAG 1.4.13); no recibe foco.
 * - Por toque (`source === 'touch'`) lleva controles —«Abrir ficha», «Cerrar»—,
 *   así que se expone como diálogo no modal, y en pantallas angostas se ancla
 *   abajo como hoja (máx. 40 % de la altura).
 */
@Component({
  selector: 'app-plan-space-card',
  imports: [AppButton, PlanGlyphIcon],
  templateUrl: './plan-space-card.html',
  styleUrl: './plan-space-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.id]': 'cardId()',
    '[attr.role]': 'inline() ? "region" : interactive() ? "dialog" : "tooltip"',
    '[attr.aria-modal]': 'interactive() ? "false" : null',
    '[attr.aria-label]': 'inline() || interactive() ? model().title : null',
    '[class.is-sheet]': 'sheet()',
    '[class.is-inline]': 'inline()',
    '[class.is-ready]': 'ready()',
    '[class.is-stale]': 'model().stale',
    '[attr.data-side]': 'placement().side',
    '[style.left.px]': 'sheet() || inline() ? null : placement().left',
    '[style.top.px]': 'sheet() || inline() ? null : placement().top',
    '[style.--arrow]': 'placement().arrowOffset + "px"',
    '(mouseenter)': 'enter.emit()',
    '(mouseleave)': 'leave.emit()',
    'data-testid': 'plan-card',
  },
})
export class PlanSpaceCard {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly model = input.required<PlanCardModel>();
  /** Dónde está el espacio; sin él (modo `inline`) la tarjeta no flota. */
  readonly hover = input<CanvasHover | null>(null);
  /** En el panel de selección: misma información, sin flotar ni tooltip. */
  readonly inline = input(false);
  readonly cardId = input('plan-card');
  /** Pantalla angosta (< 768 px): hoja inferior en vez de capa flotante. */
  readonly narrow = input(false);
  readonly canOpenFile = input(true);
  /** Tamaño en pantalla del espacio, para decidir si se ancla al cursor. */
  readonly spaceSizePx = input<{ width: number; height: number } | null>(null);

  readonly openFile = output<void>();
  readonly closed = output<void>();
  readonly enter = output<void>();
  readonly leave = output<void>();

  private readonly size = signal<{ width: number; height: number }>({ width: 320, height: 200 });
  protected readonly ready = signal(false);

  /** Por toque lleva controles; por puntero o teclado es solo lectura. */
  protected readonly interactive = computed(() => !this.inline() && this.hover()?.source === 'touch');
  protected readonly sheet = computed(() => this.narrow() && this.interactive());

  protected readonly placement = computed<Placement>(() => {
    const hover = this.hover();
    const size = this.size();
    if (hover === null) return { side: 'top', left: 0, top: 0, arrowOffset: 0, clipped: false };
    let anchor = hover.anchor;
    const space = this.spaceSizePx();
    const largeSpace = space !== null && space.width > size.width * 1.5 && space.height > size.height * 1.5;
    if (largeSpace && hover.pointer && hover.source === 'pointer') {
      anchor = { left: hover.pointer.x - 4, top: hover.pointer.y - 4, width: 8, height: 8 };
    }
    return placeFloating(anchor, size, {
      preferred: 'top',
      gap: PLAN_CARD_GAP_PX,
      margin: PLAN_CARD_MARGIN_PX,
      bounds: hover.bounds,
      shift: true,
    });
  });

  constructor() {
    afterNextRender(() => {
      const element = this.host.nativeElement;
      const measure = (): void => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const current = this.size();
        const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
        if (current.width !== next.width || current.height !== next.height) this.size.set(next);
        this.ready.set(true);
      };
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
