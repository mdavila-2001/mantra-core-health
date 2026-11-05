import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Panel } from '../../components/panel';
import { campaignName } from '../../domain/campaigns.data';
import { downloadCsv } from '../../export-csv';
import { formatInt, formatMoney, formatPercent } from '../../domain/format';
import type { Channel, InsightsFilter } from '../../domain/insights.types';
import { CHANNEL_LABELS } from '../../domain/insights.types';
import { buildScope, selectFacts } from '../../domain/kpi';

type Key = 'campaign' | 'channel' | 'impressions' | 'clicks' | 'ctr' | 'spend' | 'conversions' | 'cpa' | 'roas';

interface Row {
  readonly id: string;
  readonly campaign: string;
  readonly channel: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly ctr: number | null;
  readonly spend: number;
  readonly conversions: number;
  readonly cpa: number | null;
  readonly roas: number | null;
}

const PAGE = 8;

/**
 * Nivel 3, exploración: el detalle por campaña y canal. Busca, ordena, pagina y
 * exporta. Las columnas sin base suficiente dicen «—».
 */
@Component({
  selector: 'app-ins-detail-table',
  imports: [Panel],
  templateUrl: './detail-table.html',
  styleUrl: './detail-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailTable {
  readonly filter = input.required<InsightsFilter>();

  protected readonly query = signal('');
  protected readonly key = signal<Key>('conversions');
  protected readonly desc = signal(true);
  protected readonly page = signal(0);

  private readonly all = computed<Row[]>(() => {
    const groups = new Map<string, { campaignId: string; channel: Channel }>();
    const facts = selectFacts(this.filter());
    for (const f of facts) groups.set(`${f.campaignId}|${f.channel}`, { campaignId: f.campaignId, channel: f.channel });
    return [...groups.entries()].map(([id, g]) => {
      const s = buildScope(facts.filter((f) => f.campaignId === g.campaignId && f.channel === g.channel)).all;
      return {
        id,
        campaign: campaignName(g.campaignId),
        channel: CHANNEL_LABELS[g.channel],
        impressions: s.impressions,
        clicks: s.clicks,
        ctr: s.impressions >= 5000 ? s.clicks / s.impressions : null,
        spend: s.spendCents,
        conversions: s.conversions,
        cpa: s.spendCents > 0 && s.conversions >= 10 ? s.spendCents / s.conversions : null,
        roas: s.spendCents > 0 && s.conversions >= 10 ? s.revenueCents / s.spendCents : null,
      };
    });
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = q ? this.all().filter((r) => `${r.campaign} ${r.channel}`.toLowerCase().includes(q)) : this.all();
    const k = this.key();
    const dir = this.desc() ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (av === null) return 1;
      if (bv === null) return -1;
      return typeof av === 'string' ? dir * av.localeCompare(String(bv)) : dir * (av - Number(bv));
    });
  });

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE)));
  protected readonly visible = computed(() => this.filtered().slice(this.page() * PAGE, this.page() * PAGE + PAGE));

  protected sort(k: Key): void {
    if (this.key() === k) this.desc.set(!this.desc());
    else { this.key.set(k); this.desc.set(k !== 'campaign' && k !== 'channel'); }
    this.page.set(0);
  }
  protected ariaSort(k: Key): string { return this.key() === k ? (this.desc() ? 'descending' : 'ascending') : 'none'; }
  protected search(event: Event): void { this.query.set((event.target as HTMLInputElement).value); this.page.set(0); }
  protected go(delta: number): void { this.page.set(Math.min(this.pages() - 1, Math.max(0, this.page() + delta))); }
  protected int(n: number): string { return formatInt(n); }
  protected pct(n: number | null): string { return n === null ? '—' : formatPercent(n); }
  protected money(n: number | null): string { return n === null ? '—' : formatMoney(n); }
  protected ratio(n: number | null): string { return n === null ? '—' : `${n.toFixed(2).replace('.', ',')}×`; }

  protected exportCsv(): void {
    downloadCsv(
      'alovida-insights-detalle.csv',
      ['Campaña', 'Canal', 'Impresiones', 'Clics', 'CTR', 'Inversión (Bs)', 'Conversiones', 'CPA (Bs)', 'ROAS'],
      this.filtered().map((r) => [r.campaign, r.channel, r.impressions, r.clicks, r.ctr === null ? null : (r.ctr * 100).toFixed(2), (r.spend / 100).toFixed(2), r.conversions, r.cpa === null ? null : (r.cpa / 100).toFixed(2), r.roas === null ? null : r.roas.toFixed(2)]),
    );
  }
}
