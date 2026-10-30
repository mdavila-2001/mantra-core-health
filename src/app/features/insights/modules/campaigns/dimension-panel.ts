import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { Panel } from '../../components/panel';
import { breakdownByDimension, DIMENSION_LABELS, type DimensionId, type DimensionRow } from '../../domain/dimensions';
import { formatInt, formatMoney, formatPercent } from '../../domain/format';
import type { InsightsFilter } from '../../domain/insights.types';

type SortKey = 'label' | 'impressions' | 'ctr' | 'conversions' | 'cpa' | 'roas';

/**
 * Rendimiento por creativo, formato, audiencia y llamado a la acción. La
 * pregunta es «¿qué pieza de la campaña funciona?». Un corte con muestra
 * insuficiente muestra «—» y no un valor engañoso.
 */
@Component({
  selector: 'ins-dimension-panel',
  imports: [Panel, SegmentedControl],
  templateUrl: './dimension-panel.html',
  styleUrl: './dimension-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DimensionPanel {
  readonly filter = input.required<InsightsFilter>();
  protected readonly dimension = signal<DimensionId>('creative');
  protected readonly sortKey = signal<SortKey>('roas');
  protected readonly desc = signal(true);
  protected readonly picked = signal<string | null>(null);

  protected readonly options = (Object.keys(DIMENSION_LABELS) as DimensionId[]).map((id) => ({ value: id, label: DIMENSION_LABELS[id] }));
  protected readonly dimLabel = computed(() => DIMENSION_LABELS[this.dimension()]);

  protected readonly rows = computed(() => {
    const rows = breakdownByDimension(this.filter(), this.dimension());
    const key = this.sortKey();
    const dir = this.desc() ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (key === 'label') return dir * a.label.localeCompare(b.label);
      const av = a[key];
      const bv = b[key];
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir * (av - bv);
    });
  });

  protected readonly maxRoas = computed(() => Math.max(...this.rows().map((r) => r.roas ?? 0), 0.0001));
  protected readonly selected = computed(() => this.rows().find((r) => r.id === this.picked()) ?? null);

  protected setDimension(v: string): void {
    this.dimension.set(v as DimensionId);
    this.picked.set(null);
  }
  protected sort(key: SortKey): void {
    if (this.sortKey() === key) this.desc.set(!this.desc());
    else {
      this.sortKey.set(key);
      this.desc.set(key !== 'label' && key !== 'cpa');
    }
  }
  protected ariaSort(key: SortKey): string {
    return this.sortKey() === key ? (this.desc() ? 'descending' : 'ascending') : 'none';
  }
  protected int(n: number): string { return formatInt(n); }
  protected pct(n: number | null): string { return n === null ? '—' : formatPercent(n); }
  protected money(n: number | null): string { return n === null ? '—' : formatMoney(n); }
  protected ratio(n: number | null): string { return n === null ? '—' : `${n.toFixed(2).replace('.', ',')}×`; }
  protected share(r: DimensionRow): string { return formatPercent(r.spendCents / Math.max(1, this.rows().reduce((s, x) => s + x.spendCents, 0))); }
  protected pick(id: string): void { this.picked.set(this.picked() === id ? null : id); }
}
