import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';

import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';

export interface MultiOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

/**
 * Selector de varios valores en un desplegable. No existe una primitiva de
 * selección múltiple en el sistema (solo `app-select` de valor único); se arma
 * sobre `app-checkbox`. Foco, Escape y clic fuera cierran el panel.
 */
@Component({
  selector: 'ins-multi-select',
  imports: [Checkbox],
  templateUrl: './multi-select.html',
  styleUrl: './multi-select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(keydown.escape)': 'close(true)' },
})
export class MultiSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly label = input.required<string>();
  readonly options = input.required<readonly MultiOption[]>();
  readonly selected = input.required<readonly string[]>();
  readonly min = input(1);
  readonly allLabel = input('Todas');
  readonly changed = output<readonly string[]>();

  protected readonly isOpen = signal(false);
  protected readonly summary = computed(() => {
    const sel = this.selected();
    const all = this.options();
    if (sel.length === all.length) return this.allLabel();
    if (sel.length === 1) return all.find((o) => o.value === sel[0])?.label ?? sel[0] ?? '';
    return `${sel.length} seleccionados`;
  });

  protected toggle(value: string, checked: boolean): void {
    const next = checked ? [...this.selected(), value] : this.selected().filter((v) => v !== value);
    if (next.length < this.min()) return;
    this.changed.emit(this.options().map((o) => o.value).filter((v) => next.includes(v)));
  }

  protected selectAll(): void {
    this.changed.emit(this.options().map((o) => o.value));
  }

  protected isChecked(value: string): boolean {
    return this.selected().includes(value);
  }

  protected outside(event: Event): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  protected close(restoreFocus: boolean): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    if (restoreFocus) this.host.nativeElement.querySelector<HTMLButtonElement>('.ms__btn')?.focus();
  }
}
