import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';

import { InsightsWorkspaceClient } from '../../../../core/data-access/insights/insights-workspace.client';
import type { InsightsReportRecord } from '../../../../core/data-access/insights/insights.types';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { FilterBar } from '../../components/filter-bar';
import { Panel } from '../../components/panel';
import {
  OPTIONAL_SECTIONS, REPORT_AUDIENCES, REPORT_TYPES, SECTION_LABELS, buildReport, defaultSections,
  type OptionalSection, type ReportAudience, type ReportType,
} from '../../domain/report';
import { downloadCsv } from '../../export-csv';
import { InsightsContext } from '../../insights-context';

/**
 * Módulo 06 · Generador de informes.
 *
 * Cuatro pasos: tipo y audiencia, alcance (filtros globales), secciones (con su orden) y salida.
 * El informe se calcula con las mismas funciones que las pantallas. Portada, resumen, método y
 * limitaciones no se pueden quitar. Para un cliente o un aliado se ocultan los costos y las
 * secciones internas. «Guardar» deja el informe en el historial del API (12 como máximo).
 * PDF se obtiene con «Imprimir»; PowerPoint y Excel no existen y se dice, en vez de ofrecer un
 * botón que no hace nada.
 */
@Component({
  selector: 'app-insights-reports',
  imports: [FilterBar, Panel, SegmentedControl, Checkbox],
  templateUrl: './reports-page.html',
  styleUrls: ['./reports-page.css', './reports-print.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly ctx = inject(InsightsContext);
  private readonly client = inject(InsightsWorkspaceClient);

  protected readonly type = signal<ReportType>('executive');
  protected readonly audience = signal<ReportAudience>('direction');
  protected readonly title = signal('');
  private readonly picked = signal<readonly OptionalSection[] | null>(null);

  protected readonly history = signal<readonly InsightsReportRecord[]>([]);
  protected readonly historyState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly notice = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly typeOptions = (Object.keys(REPORT_TYPES) as ReportType[]).map((t) => ({ value: t, label: REPORT_TYPES[t].label }));
  protected readonly audienceOptions = (Object.keys(REPORT_AUDIENCES) as ReportAudience[]).map((a) => ({ value: a, label: REPORT_AUDIENCES[a].label }));
  protected readonly typeHint = computed(() => REPORT_TYPES[this.type()].description);
  protected readonly external = computed(() => REPORT_AUDIENCES[this.audience()].external);

  /** Contenido elegido, en orden: si la persona no tocó nada, el preset del tipo y la audiencia. */
  protected readonly sections = computed(() => (this.picked() ?? defaultSections(this.type(), this.audience())).filter((s) => REPORT_AUDIENCES[this.audience()].allowed.includes(s)));

  /** Primero las elegidas (en su orden, con ↑↓) y luego las que quedan fuera. */
  protected readonly choices = computed(() => {
    const on = this.sections();
    const allowed = REPORT_AUDIENCES[this.audience()].allowed;
    const rest = OPTIONAL_SECTIONS.filter((id) => !on.includes(id));
    return [...on, ...rest].map((id, i) => ({ id, label: SECTION_LABELS[id], on: on.includes(id), allowed: allowed.includes(id), first: i === 0, last: i === on.length - 1 }));
  });

  protected readonly doc = computed(() => buildReport({ type: this.type(), audience: this.audience(), sections: this.sections(), title: this.title() }, this.ctx.filter()));

  constructor() {
    this.loadHistory();
  }

  protected setType(v: string): void { this.type.set(v as ReportType); if (v !== 'custom') this.picked.set(null); }
  protected setAudience(v: string): void { this.audience.set(v as ReportAudience); this.picked.set(null); }
  protected setTitle(e: Event): void { this.title.set((e.target as HTMLInputElement).value.slice(0, 90)); }
  protected toggle(id: OptionalSection, on: boolean): void {
    const current = this.sections();
    this.picked.set(on ? [...current, id] : current.filter((s) => s !== id));
  }
  protected move(id: OptionalSection, delta: -1 | 1): void {
    const list = [...this.sections()];
    const i = list.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    this.picked.set(list);
  }
  protected reset(): void { this.picked.set(null); }

  protected print(): void {
    if (typeof window === 'undefined') return;
    document.body.classList.add('ins-printing');
    window.addEventListener('afterprint', () => document.body.classList.remove('ins-printing'), { once: true });
    window.print();
  }

  protected exportCsv(): void {
    const rows: (string | number | null)[][] = [];
    for (const s of this.doc().sections) {
      if (s.table) for (const r of s.table.rows) rows.push([s.title, ...r]);
      for (const b of s.bullets) rows.push([s.title, b]);
    }
    downloadCsv('alovida-insights-informe.csv', ['Sección', 'Dato 1', 'Dato 2', 'Dato 3', 'Dato 4', 'Dato 5', 'Dato 6'], rows);
  }

  /* ----------------------------------------------------------- historial */

  protected loadHistory(): void {
    this.historyState.set('loading');
    this.client.listReports().subscribe({
      next: (res) => { this.history.set(res.data); this.historyState.set('ready'); },
      error: () => this.historyState.set('error'),
    });
  }

  protected save(): void {
    const f = this.ctx.filter();
    const title = this.title().trim() || this.doc().title;
    this.saving.set(true);
    this.notice.set(null);
    this.client
      .putReport(crypto.randomUUID(), { title: title.slice(0, 90), type: this.type(), audience: this.audience(), periodFrom: f.range.from, periodTo: f.range.to, campaignIds: f.campaignIds, channels: f.channels, sections: this.sections() })
      .subscribe({
        next: () => { this.saving.set(false); this.notice.set('Informe guardado en el historial.'); this.loadHistory(); },
        error: () => { this.saving.set(false); this.notice.set('No se pudo guardar el informe. Nada se modificó; inténtelo de nuevo.'); },
      });
  }

  /** Vuelve a armar el informe guardado: tipo, audiencia, secciones y alcance. */
  protected open(r: InsightsReportRecord): void {
    this.type.set(r.type as ReportType);
    this.audience.set(r.audience as ReportAudience);
    this.title.set(r.title);
    this.picked.set(r.sections as OptionalSection[]);
    this.ctx.update({ c: r.campaignIds.join(','), p: 'custom', from: r.periodFrom, to: r.periodTo, ch: r.channels.length ? r.channels.join(',') : null });
  }

  protected remove(r: InsightsReportRecord): void {
    this.client.deleteReport(r.id).subscribe({
      next: () => this.loadHistory(),
      error: () => this.notice.set('No se pudo borrar el informe. Inténtelo de nuevo.'),
    });
  }

  protected labelOf(r: InsightsReportRecord): string {
    return `${REPORT_TYPES[r.type as ReportType]?.label ?? r.type} · ${REPORT_AUDIENCES[r.audience as ReportAudience]?.label ?? r.audience}`;
  }
}
