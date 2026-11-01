import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DataQualityClient } from '../../../../../core/data-access/admin-portal/data-quality.client';
import {
  QUALITY_SEVERITIES,
  type QualityRule,
  type QualityRulesQuery,
} from '../../../../../core/data-access/admin-portal/data-quality.types';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { FilterForm, type FilterField } from '../../governance/filter-form';
import { dateOnly } from '../../governance/governance-labels';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { conceptText, severityLabel } from '../quality-labels';

const PAGE_SIZE = 25;
const SCREEN = portalUrl('data-quality/rules');
const ISSUES_URL = portalUrl('data-quality/issues');
const URL_KEYS = ['severity', 'q'] as const;
const MAX_SEARCH = 120;

/** La consulta, con lo que la API rechazaría ya descartado. */
function rulesQuery(values: Readonly<Record<(typeof URL_KEYS)[number], string>>): QualityRulesQuery {
  const q = values.q.trim();
  return {
    ...((QUALITY_SEVERITIES as readonly string[]).includes(values.severity)
      ? { severity: values.severity as (typeof QUALITY_SEVERITIES)[number] }
      : {}),
    ...(q !== '' && q.length <= MAX_SEARCH ? { q } : {}),
  };
}

/**
 * Reglas de calidad de datos: qué se comprueba, con qué severidad y cuántas incidencias
 * abiertas tiene cada una. Los filtros viven en la URL; cada regla abre su ficha.
 */
@Component({
  selector: 'app-portal-quality-rules-page',
  imports: [NgTemplateOutlet, RouterLink, Badge, Link, Alert, Card, MetricCard, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './rules-page.html',
  styleUrl: './rules-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPage {
  private readonly client = inject(DataQualityClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  protected readonly severity = severityLabel;
  /** La severidad se elige con las pestañas (viven en la URL como `severity`). */
  protected readonly tabs = [
    { value: '', label: 'Todas' },
    ...QUALITY_SEVERITIES.map((value) => ({ value, label: severityLabel(value).label })),
  ];
  protected readonly tabIndex = computed(() =>
    Math.max(0, this.tabs.findIndex((t) => t.value === (rulesQuery(this.values()).severity ?? ''))),
  );
  protected readonly concept = conceptText;
  protected readonly day = dateOnly;

  protected readonly fields = computed<readonly FilterField[]>(() => [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Código o nombre de la regla' },
  ]);

  protected readonly list = pagedList<QualityRule>(
    (cursor) => this.client.listRules({ ...rulesQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    () => this.whenEmpty(),
  );

  /**
   * Cifras de arriba: sólo cuando la respuesta ya pedida trae TODAS las reglas (sin búsqueda ni
   * pestaña, una sola página). Si no, no se muestran: contar sobre una página sería inventar.
   */
  protected readonly metrics = computed(() => {
    const s = this.list.state();
    const total = this.list.total();
    const v = this.values();
    if (s.status !== 'ready' || total === null || s.data.length !== total) return null;
    if (v.q.trim() !== '' || this.tabIndex() !== 0) return null;
    const rows = s.data;
    return {
      total,
      withOpen: rows.filter((r) => r.openIssues > 0).length,
      open: rows.reduce((n, r) => n + r.openIssues, 0),
      serious: rows.filter((r) => r.severity === 'FATAL' || r.severity === 'ERROR').length,
    };
  });

  private readonly ruleCell = viewChild.required<TemplateRef<{ $implicit: QualityRule }>>('ruleCell');
  private readonly severityCell = viewChild.required<TemplateRef<{ $implicit: QualityRule }>>('severityCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: QualityRule }>>('kindCell');
  private readonly issuesCell = viewChild.required<TemplateRef<{ $implicit: QualityRule }>>('issuesCell');

  protected readonly columns = computed<readonly ColumnDef<QualityRule>[]>(() => [
    { key: 'rule', header: 'Regla', priority: 1, cell: this.ruleCell() },
    { key: 'severity', header: 'Severidad', priority: 1, cell: this.severityCell() },
    { key: 'kind', header: 'Dimensión y estado', priority: 2, cell: this.kindCell() },
    { key: 'issues', header: 'Incidencias abiertas', priority: 1, cell: this.issuesCell() },
  ]);

  protected readonly byId = (row: QualityRule): string => row.id;
  protected readonly rowName = (row: QualityRule): string => `${row.ruleCode} · ${row.name}`;
  protected readonly ruleUrl = (id: string): string => `${SCREEN}/${encodeURIComponent(id)}`;
  protected readonly issuesUrl = ISSUES_URL;

  constructor() {
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { severity: this.tabs[index]?.value || null });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, { q: filters['q'] || null });
  }

  /** Quita la búsqueda; la pestaña (la severidad) se queda. */
  protected clear(): void {
    void patchQuery(this.router, this.route, { q: null });
  }

  private whenEmpty(): EmptyViewState {
    const v = this.values();
    if (v.severity !== '' || v.q !== '') {
      return empty({ label: 'Quitar los filtros', route: SCREEN }, 'Ninguna regla coincide con los filtros elegidos.');
    }
    return empty(
      { label: 'Ver las incidencias', route: ISSUES_URL },
      'No hay reglas de calidad de datos cargadas. Sin reglas el análisis no comprueba nada.',
    );
  }
}
