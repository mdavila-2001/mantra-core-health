import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { UnplacedSpace } from '../../../core/data-access/floor-plan/floor-plan.types';
import { AppButton } from '../../../shared/components/atoms/button/button';

/**
 * Paleta de espacios sin ubicar (CONTRATO-PLANO §5.3): se elige uno y se lo
 * dibuja con la herramienta, o se lo ubica con su tamaño habitual en el centro
 * de lo que se ve. Sin arrastrar: funciona igual con teclado y con toque.
 */
@Component({
  selector: 'app-plan-editor-palette',
  imports: [AppButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pal" aria-label="Espacios sin ubicar" data-testid="editor-palette">
      <h2 class="pal__title">Sin ubicar <span class="pal__count">{{ entries().length }}</span></h2>
      <label class="pal__filter">
        <span class="pal__filter-label">Buscar en la lista</span>
        <input type="search" class="pal__input" [value]="filter()" (input)="filter.set($any($event.target).value)" placeholder="Código o nombre" autocomplete="off" />
      </label>
      @if (visible().length === 0) {
        <p class="pal__empty">{{ entries().length === 0 ? 'Todos los espacios del alcance ya están dibujados.' : 'Ningún espacio coincide con la búsqueda.' }}</p>
      } @else {
        <ul class="pal__list">
          @for (entry of visible(); track entry.spaceId) {
            <li>
              <button
                type="button"
                class="pal__item"
                [class.is-armed]="entry.spaceId === armedId()"
                [attr.aria-pressed]="entry.spaceId === armedId()"
                [disabled]="!entry.placeable"
                [attr.data-testid]="'editor-palette-' + entry.code"
                [style.padding-left.px]="8 + entry.depth * 8"
                (click)="arm.emit(entry.spaceId === armedId() ? null : entry.spaceId)"
              >
                <strong>{{ entry.code }}</strong> {{ entry.name }}
                <span class="pal__meta">{{ entry.placeable ? formLabel(entry.form) : (entry.reason ?? 'No se puede dibujar aquí') }}</span>
              </button>
            </li>
          }
        </ul>
      }
      @if (armedId()) {
        <button app-button size="sm" variant="secondary" type="button" data-testid="editor-place-center" (clicked)="placeCenter.emit()">Ubicar en el centro de la vista</button>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .pal { display: grid; gap: var(--sp-2); min-width: 0; padding: var(--sp-3); background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-lg); }
    .pal__title { margin: 0; font-size: var(--fs-body); font-weight: 700; color: var(--text-primary); }
    .pal__count { margin-left: var(--sp-1); font-variant-numeric: tabular-nums; color: var(--text-secondary); font-weight: 600; }
    .pal__filter { display: grid; gap: 2px; font-size: var(--fs-caption); color: var(--text-secondary); font-weight: 600; }
    .pal__input { box-sizing: border-box; width: 100%; min-height: 40px; padding: 0 var(--sp-2); border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--bg-surface); color: var(--text-primary); font: inherit; }
    .pal__input:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 1px; }
    .pal__list { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; max-height: 320px; overflow: auto; }
    .pal__item { display: grid; width: 100%; gap: 2px; padding: var(--sp-2); min-height: 44px; border: 1px solid transparent; border-radius: var(--r-sm); background: transparent; color: var(--text-primary); font: inherit; font-size: var(--fs-caption); text-align: left; cursor: pointer; }
    .pal__item:hover:not(:disabled) { background: var(--bg-hover); }
    .pal__item:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 1px; }
    .pal__item.is-armed { border-color: var(--brand-primary); background: color-mix(in srgb, var(--brand-primary) 10%, transparent); }
    .pal__item:disabled { color: var(--text-secondary); cursor: not-allowed; }
    .pal__meta { color: var(--text-secondary); }
    .pal__empty { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
})
export class PlanEditorPalette {
  readonly entries = input.required<readonly UnplacedSpace[]>();
  readonly armedId = input<string | null>(null);
  readonly arm = output<string | null>();
  readonly placeCenter = output<void>();

  protected readonly filter = signal('');
  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return q === '' ? this.entries() : this.entries().filter((e) => `${e.code} ${e.name}`.toLowerCase().includes(q));
  });

  protected formLabel(form: string): string {
    const labels: Record<string, string> = { ROOM: 'Local', BED: 'Cama', AREA: 'Área', WARD: 'Pabellón', LEVEL: 'Nivel', BUILDING: 'Edificio' };
    return labels[form] ?? form;
  }
}
