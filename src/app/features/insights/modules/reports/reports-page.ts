import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';

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
 * Cinco decisiones, de arriba abajo: tipo, alcance (filtros globales),
 * audiencia, contenido y vista previa. El informe se calcula con las mismas
 * funciones que las pantallas. Portada, resumen, método y limitaciones no se
 * pueden quitar. PDF se obtiene con «Imprimir»; PowerPoint aún no existe y se
 * dice, en vez de ofrecer un botón que no hace nada.
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

  protected readonly type = signal<ReportType>('executive');
  protected readonly audience = signal<ReportAudience>('direction');
  private readonly picked = signal<readonly OptionalSection[] | null>(null);

  protected readonly typeOptions = (Object.keys(REPORT_TYPES) as ReportType[]).map((t) => ({ value: t, label: REPORT_TYPES[t].label }));
  protected readonly audienceOptions = (Object.keys(REPORT_AUDIENCES) as ReportAudience[]).map((a) => ({ value: a, label: REPORT_AUDIENCES[a].label }));
  protected readonly typeHint = computed(() => REPORT_TYPES[this.type()].description);

  /** Contenido elegido: si la persona no tocó nada, el preset del tipo y la audiencia. */
  protected readonly sections = computed(() => this.picked() ?? defaultSections(this.type(), this.audience()));
  protected readonly choices = computed(() => OPTIONAL_SECTIONS.map((id) => ({ id, label: SECTION_LABELS[id], on: this.sections().includes(id), allowed: REPORT_AUDIENCES[this.audience()].allowed.includes(id) })));

  protected readonly doc = computed(() => buildReport({ type: this.type(), audience: this.audience(), sections: this.sections() }, this.ctx.filter()));

  protected setType(v: string): void { this.type.set(v as ReportType); this.picked.set(null); }
  protected setAudience(v: string): void { this.audience.set(v as ReportAudience); this.picked.set(null); }
  protected toggle(id: OptionalSection, on: boolean): void {
    const current = this.sections();
    this.picked.set(on ? [...current, id] : current.filter((s) => s !== id));
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
}
