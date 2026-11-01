import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

import { METRIC_CATALOG } from '../domain/metric-catalog';

const GROUPS: readonly { kind: string; label: string }[] = [
  { kind: 'volume', label: 'Volumen' },
  { kind: 'rate', label: 'Tasas' },
  { kind: 'cost', label: 'Costos' },
  { kind: 'ratio', label: 'Razones' },
  { kind: 'duration', label: 'Duración' },
  { kind: 'curve', label: 'Curvas' },
];

/** Glosario: las métricas del catálogo, con qué dicen y qué decisión permiten. */
@Component({
  selector: 'app-ins-glossary',
  templateUrl: './glossary-drawer.html',
  styleUrl: './glossary-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryDrawer {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly metrics = Object.values(METRIC_CATALOG);
  protected readonly groups = GROUPS.map((g) => ({ ...g, items: this.metrics.filter((m) => m.kind === g.kind) })).filter((g) => g.items.length > 0);
  protected readonly others = this.metrics.filter((m) => !GROUPS.some((g) => g.kind === m.kind));
  private readonly sync = effect(() => {
    const dialogEl = this.dialog()?.nativeElement;
    if (!dialogEl) return;
    if (this.open() && !dialogEl.open) dialogEl.showModal();
    if (!this.open() && dialogEl.open) dialogEl.close();
  });
}
