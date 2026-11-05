import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Badge } from '@shared/components/atoms/badge/badge';
import { SpecialtyIcon } from '@shared/components/atoms/specialty-icon/specialty-icon';
import { SpecialtyImages } from '../../../core/data-access/terminology/specialty-images.service';
import { explain, type Recommendation } from '../symptoms';

/**
 * Manual carousel of recommended specialties. The next card always peeks past
 * the edge and the arrows plus the "n of m" counter say there is more to see.
 */
@Component({
  selector: 'app-symptom-recommendations',
  imports: [Badge, SpecialtyIcon],
  templateUrl: './symptom-recommendations.html',
  styleUrls: ['../../../shared/styles/card-grid.css', './symptom-recommendations.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SymptomRecommendations {
  readonly recomendaciones = input.required<readonly Recommendation[]>();
  readonly elegir = output<string>();

  protected readonly explicacionDe = explain;
  protected readonly fotoDe = inject(SpecialtyImages).of;

  private readonly pista = viewChild.required<ElementRef<HTMLElement>>('pista');
  protected readonly alInicio = signal(true);
  protected readonly alFinal = signal(false);
  protected readonly visible = signal(1);

  /** Recomputes edge state and the first visible card from the scroll position. */
  protected medir(): void {
    const el = this.pista().nativeElement;
    const resto = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    this.alInicio.set(pos <= 2);
    this.alFinal.set(pos >= resto - 2);
    const paso = this.paso(el);
    this.visible.set(paso > 0 ? Math.min(Math.round(pos / paso) + 1, this.recomendaciones().length) : 1);
  }

  protected mover(sentido: 1 | -1): void {
    const el = this.pista().nativeElement;
    el.scrollBy({ left: sentido * this.paso(el), behavior: 'smooth' });
  }

  /** One card width plus the gap: the distance between two snap points. */
  private paso(el: HTMLElement): number {
    const [a, b] = Array.from(el.children) as HTMLElement[];
    if (a === undefined) return 0;
    return b === undefined ? a.offsetWidth : b.offsetLeft - a.offsetLeft;
  }
}
