import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DataQualityClient } from '../../../../../core/data-access/admin-portal/data-quality.client';
import {
  QUALITY_NOTE_MAX_LENGTH,
  QUALITY_NOTE_MIN_LENGTH,
  type QualityIssue,
  type QualityResolutionAction,
} from '../../../../../core/data-access/admin-portal/data-quality.types';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { FilterForm, type FilterField } from '../../governance/filter-form';
import { dateTime } from '../../governance/governance-labels';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { SEVERITY_OPTIONS, issueStatusLabel, severityLabel } from '../quality-labels';
import {
  ISSUE_FILTER_KEYS,
  ISSUE_TABS,
  ISSUE_URL_KEYS,
  hasIssueFilters,
  issueQuery,
  resolutionFailure,
  tabOf,
} from './issues.model';

const PAGE_SIZE = 25;
const SCREEN = portalUrl('data-quality/issues');
const RULES_URL = portalUrl('data-quality/rules');

/** Cómo se llama cada acción en el diálogo, en el aviso y en el botón. */
const ACTIONS: Readonly<
  Record<QualityResolutionAction, { title: string; confirm: string; message: string; done: string; destructive: boolean }>
> = {
  RESOLVE: {
    title: 'Resolver la incidencia',
    confirm: 'Resolver',
    message: 'Queda como resuelta, con su motivo. Si el dato sigue mal, el próximo análisis abrirá otra.',
    done: 'La incidencia quedó resuelta.',
    destructive: false,
  },
  DISMISS: {
    title: 'Descartar la incidencia',
    confirm: 'Descartar',
    message: 'Queda como descartada (por ejemplo, un falso positivo), con su motivo. No se corrige ningún dato.',
    done: 'La incidencia quedó descartada.',
    destructive: true,
  },
};

/**
 * Incidencias de calidad de datos: las que el análisis detectó, con el estado en que está cada
 * una. Resolver o descartar pide un motivo, se hace una sola vez por incidencia y la API lo
 * hace idempotente: repetirlo no cambia nada y si otra persona la cerró distinto, se avisa.
 * La pestaña y los filtros viven en la URL.
 */
@Component({
  selector: 'app-portal-quality-issues-page',
  imports: [NgTemplateOutlet, RouterLink, AppButton, Badge, Link, Alert, Card, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './issues-page.html',
  styleUrl: './issues-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssuesPage {
  private readonly client = inject(DataQualityClient);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), ISSUE_URL_KEYS);
  protected readonly tab = computed(() => tabOf(this.values()));
  protected readonly tabIndex = computed(() => ISSUE_TABS.indexOf(this.tab()));
  protected readonly rulesUrl = RULES_URL;

  protected readonly severity = severityLabel;
  protected readonly status = issueStatusLabel;
  protected readonly when = dateTime;

  /** Aviso de lo último que se cerró (o por qué no se pudo). */
  protected readonly notice = signal<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);
  /** La incidencia que se está cerrando: sus botones quedan apagados (no hay doble envío). */
  protected readonly closing = signal<string | null>(null);

  protected readonly fields = computed<readonly FilterField[]>(() => [
    { key: 'severity', label: 'Severidad', kind: 'select', options: SEVERITY_OPTIONS },
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Campo, código o nombre de la regla' },
  ]);

  protected readonly list = pagedList<QualityIssue>(
    (cursor) => this.client.listIssues({ ...issueQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    () => this.whenEmpty(),
  );

  private readonly severityCell = viewChild.required<TemplateRef<{ $implicit: QualityIssue }>>('severityCell');
  private readonly issueCell = viewChild.required<TemplateRef<{ $implicit: QualityIssue }>>('issueCell');
  private readonly detectedCell = viewChild.required<TemplateRef<{ $implicit: QualityIssue }>>('detectedCell');
  private readonly outcomeCell = viewChild.required<TemplateRef<{ $implicit: QualityIssue }>>('outcomeCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: QualityIssue }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<QualityIssue>[]>(() => [
    { key: 'severity', header: 'Severidad y estado', priority: 1, cell: this.severityCell() },
    { key: 'issue', header: 'Regla y campo', priority: 1, cell: this.issueCell() },
    { key: 'createdAt', header: 'Detectada', priority: 2, cell: this.detectedCell() },
    { key: 'outcome', header: 'Desenlace', priority: 2, cell: this.outcomeCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
  ]);

  protected readonly byId = (row: QualityIssue): string => row.id;
  protected readonly rowName = (row: QualityIssue): string => `${row.ruleCode} · ${row.fieldPath}`;
  protected readonly ruleUrl = (id: string): string => `${RULES_URL}/${encodeURIComponent(id)}`;

  constructor() {
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected selectTab(index: number): void {
    this.notice.set(null);
    void patchQuery(this.router, this.route, { status: index === 0 ? null : ISSUE_TABS[index]! });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    void patchQuery(this.router, this.route, Object.fromEntries(ISSUE_FILTER_KEYS.map((k) => [k, null])));
  }

  protected clearRule(): void {
    void patchQuery(this.router, this.route, { ruleId: null });
  }

  protected async close(issue: QualityIssue, action: QualityResolutionAction): Promise<void> {
    if (this.closing() !== null) return;
    const copy = ACTIONS[action];
    const note = await this.dialogs.confirmWithReason(
      {
        title: copy.title,
        message: `${issue.ruleCode} · ${issue.fieldPath}. ${copy.message}`,
        confirmLabel: copy.confirm,
        cancelLabel: 'Volver',
        destructive: copy.destructive,
      },
      { label: 'Motivo', minLength: QUALITY_NOTE_MIN_LENGTH, maxLength: QUALITY_NOTE_MAX_LENGTH },
    );
    if (note === null) return;
    this.closing.set(issue.id);
    this.notice.set(null);
    this.client
      .resolveIssue(issue.id, { action, note })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (result) => {
        this.closing.set(null);
        this.notice.set(
          result.alreadyApplied
            ? { tone: 'info', text: 'La incidencia ya estaba en ese estado: no se cambió nada.' }
            : { tone: 'success', text: copy.done },
        );
        this.list.reload();
      },
      error: (e: unknown) => {
        this.closing.set(null);
        const failure = resolutionFailure(e instanceof HttpErrorResponse ? e.status : null);
        this.notice.set({ tone: 'error', text: failure.message });
        if (failure.reload) this.list.reload();
      },
    });
  }

  private whenEmpty(): EmptyViewState {
    const values = this.values();
    if (hasIssueFilters(values)) {
      return empty(
        { label: 'Quitar los filtros', route: SCREEN, queryParams: values.status ? { status: values.status } : {} },
        'Ninguna incidencia coincide con los filtros elegidos.',
      );
    }
    switch (this.tab()) {
      case 'OPEN':
        return empty(
          { label: 'Ver todas las incidencias', route: SCREEN, queryParams: { status: 'ALL' } },
          'No hay incidencias abiertas. Si el análisis no corrió, tampoco habrá ninguna: revise las corridas en la ficha de cada regla.',
        );
      case 'RESOLVED':
        return empty({ label: 'Ver las abiertas', route: SCREEN }, 'Todavía no se resolvió ninguna incidencia.');
      case 'DISMISSED':
        return empty({ label: 'Ver las abiertas', route: SCREEN }, 'Todavía no se descartó ninguna incidencia.');
      default:
        return empty({ label: 'Ver las reglas', route: RULES_URL }, 'El análisis no detectó ninguna incidencia.');
    }
  }
}
