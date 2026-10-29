import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output } from '@angular/core';

import type { BBox, Point } from '../../../../core/floor-plan/geometry';
import type { SpaceView } from '../../../../core/floor-plan/plan-view';

/**
 * Minimapa (CONTRATO-PLANO §5.2): siluetas de todo el lienzo y el rectángulo de
 * la ventana visible; arrastrarlo (o tocar un punto) desplaza la vista.
 * Presentacional: avisa el nuevo centro en metros con `centerChange`.
 */
@Component({
  selector: 'app-floor-plan-minimap',
  templateUrl: './floor-plan-minimap.html',
  styleUrl: './floor-plan-minimap.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'minimap' },
})
export class FloorPlanMinimap {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly widthM = input.required<number>();
  readonly heightM = input.required<number>();
  readonly spaces = input.required<readonly SpaceView[]>();
  readonly visible = input.required<BBox>();

  readonly centerChange = output<Point>();

  protected readonly viewBox = computed(() => `0 0 ${this.widthM()} ${this.heightM()}`);
  protected readonly windowRect = computed(() => {
    const [x0, y0, x1, y1] = this.visible();
    const left = Math.max(0, x0);
    const top = Math.max(0, y0);
    return { x: left, y: top, width: Math.max(0.5, Math.min(this.widthM(), x1) - left), height: Math.max(0.5, Math.min(this.heightM(), y1) - top) };
  });
  protected readonly shapes = computed(() => this.spaces().filter((s) => s.band !== 'bed'));
  private dragging = false;

  protected down(event: PointerEvent): void {
    this.dragging = true;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.emit(event);
  }

  protected move(event: PointerEvent): void {
    if (this.dragging) this.emit(event);
  }

  protected up(event: PointerEvent): void {
    this.dragging = false;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }

  private emit(event: PointerEvent): void {
    const svg = this.host.nativeElement.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const x = ((event.clientX - rect.left) / rect.width) * this.widthM();
    const y = ((event.clientY - rect.top) / rect.height) * this.heightM();
    this.centerChange.emit([Math.max(0, Math.min(this.widthM(), x)), Math.max(0, Math.min(this.heightM(), y))]);
  }
}
