import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, model, signal,
} from '@angular/core';

import { Chip } from '../../../../shared/components/atoms/chip/chip';
import type { StudyArea } from '../study-filter';

/** How many areas show before «+N áreas»: about two rows on a phone. */
const VISIBLE_AREAS = 3;

/**
 * Chips to narrow the studies by area. Picking the open area again clears it.
 * Long lists fold behind «+N áreas» so the first study stays near the top.
 */
@Component({
  selector: 'app-lab-area-filter',
  imports: [Chip],
  templateUrl: './area-filter.html',
  styleUrl: './area-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabAreaFilter {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly areas = input.required<readonly StudyArea[]>();
  readonly total = input.required<number>();
  readonly selected = model<string | null>(null);

  protected readonly expanded = signal(false);

  /** The visible chips; the selected area is never folded away. */
  protected readonly shown = computed(() => {
    const areas = this.areas();
    if (this.expanded() || areas.length <= VISIBLE_AREAS + 1) return areas;
    const head = areas.slice(0, VISIBLE_AREAS);
    const picked = areas.find((area) => area.name === this.selected());
    return picked && !head.includes(picked) ? [...head, picked] : head;
  });

  protected readonly hidden = computed(() => this.areas().length - this.shown().length);
  protected readonly foldable = computed(() => this.areas().length > VISIBLE_AREAS + 1);

  /**
   * «Todas» cannot be switched off: the chip flips its own value on click, and
   * when the filter was already clear the binding does not change, so the
   * chip is put back by hand instead of staying unpressed with nothing picked.
   */
  protected pickAll(chip: Chip): void {
    chip.selected.set(true);
    this.selected.set(null);
  }

  /** Folds back, or unfolds and focuses the first area revealed. */
  protected toggle(): void {
    if (this.expanded()) {
      this.expanded.set(false);
      return;
    }
    const first = this.shown().length + 1; // +1: «Todas» comes first.
    this.expanded.set(true);
    afterNextRender(() => this.host.nativeElement.querySelectorAll<HTMLElement>('app-chip')[first]?.focus(), {
      injector: this.injector,
    });
  }

  protected pick(area: string): void {
    this.selected.update((current) => (current === area ? null : area));
  }
}
