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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuditClient } from '../../../../../core/data-access/audit/audit.client';
import {
  AUDIT_MAX_PAGE_SIZE,
  AUDIT_METHODS,
  AUDIT_RESULT_FILTERS,
  DATA_OPERATIONS,
  type AuditLogEntry,
  type DataAccessEntry,
} from '../../../../../core/data-access/audit/audit.types';
import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { FilterForm, type FilterField } from '../filter-form';
import {
  accessPurpose,
  auditResult,
  dataOperation,
  dateOnly,
  dateTime,
  healthRisk,
  httpMethod,
  optionsFrom,
  pathSegments,
  resourceKind,
  timeOnly,
} from '../governance-labels';
import { patchQuery, queryParamsSignal, queryFilters } from '../../support/route-query';
import {
  AUDIT_URL_KEYS,
  AUDIT_VIEWS,
  DATA_ACCESS_FILTER_KEYS,
  LOG_FILTER_KEYS,
  actionHeadline,
  businessAction,
  dataAccessQuery,
  hasFilters,
  logQuery,
  viewOf,
  type AuditUrlValues,
} from './audit.model';

const PAGE_SIZE = 50;

/** Una celda que dibuja las dos tablas con los campos que tienen en común. */
function shared<Row>(cell: TemplateRef<unknown>): TemplateRef<{ $implicit: Row }> {
  return cell as TemplateRef<{ $implicit: Row }>;
}
const SCREEN = portalUrl('governance/audit');
/** Cuántos usuarios internos se leen para poner nombre a los actores. */
const ACTOR_NAMES_LIMIT = AUDIT_MAX_PAGE_SIZE;

/**
 * Auditoría: la bitácora de acciones que mutaron algo, con su riesgo para la
 * seguridad de la salud, y los accesos a datos sensibles. Filtros, pestaña y
 * página viven en la URL. Leer la bitácora queda, a su vez, auditado.
 */
@Component({
  selector: 'app-portal-audit-page',
  imports: [RouterLink, Badge, Link, Card, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  private readonly audit = inject(AuditClient);
  private readonly authz = inject(AuthzAdminClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), AUDIT_URL_KEYS);
  protected readonly view = computed(() => viewOf(this.values()));
  protected readonly tabIndex = computed(() => AUDIT_VIEWS.indexOf(this.view()));

  protected readonly risk = healthRisk;
  protected readonly result = auditResult;
  protected readonly method = httpMethod;
  protected readonly operation = dataOperation;
  protected readonly resource = resourceKind;
  protected readonly purpose = accessPurpose;
  protected readonly day = dateOnly;
  protected readonly hour = timeOnly;
  protected readonly headline = actionHeadline;
  protected readonly business = businessAction;
  protected readonly segments = pathSegments;

  /** Nombre de cada usuario interno; los demás actores quedan sin nombre (la bitácora sólo trae su id). */
  private readonly actorNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly actorNamesUnavailable = signal(false);

  protected readonly logFields = computed<readonly FilterField[]>(() => [
    this.actorField(),
    { key: 'from', label: 'Desde', kind: 'date' },
    { key: 'to', label: 'Hasta (incluido)', kind: 'date' },
    {
      key: 'result',
      label: 'Resultado',
      kind: 'select',
      options: [{ value: '', label: 'Cualquier resultado' }, ...optionsFrom(auditResult, AUDIT_RESULT_FILTERS)],
    },
    {
      key: 'method',
      label: 'Verbo',
      kind: 'select',
      advanced: true,
      options: [{ value: '', label: 'Cualquier verbo' }, ...optionsFrom(httpMethod, AUDIT_METHODS)],
    },
    { key: 'action', label: 'Acción exacta', kind: 'text', placeholder: 'Código exacto', advanced: true },
    { key: 'route', label: 'Ruta exacta', kind: 'text', placeholder: 'Con sus :parámetros', advanced: true },
    { key: 'entity', label: 'Entidad', kind: 'text', placeholder: 'Nombre exacto', advanced: true },
  ]);

  protected readonly dataAccessFields = computed<readonly FilterField[]>(() => [
    this.actorField(),
    { key: 'from', label: 'Desde', kind: 'date' },
    { key: 'to', label: 'Hasta (incluido)', kind: 'date' },
    {
      key: 'operation',
      label: 'Operación',
      kind: 'select',
      options: [{ value: '', label: 'Cualquier operación' }, ...optionsFrom(dataOperation, DATA_OPERATIONS)],
    },
    { key: 'resourceType', label: 'Tipo de recurso', kind: 'text', placeholder: 'Código exacto', advanced: true },
  ]);

  protected readonly log = pagedList<AuditLogEntry>(
    (cursor) => this.audit.log({ ...logQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    () => this.whenEmpty('Ninguna acción coincide con los filtros elegidos.', 'No hay acciones registradas en los últimos 30 días.'),
  );

  protected readonly access = pagedList<DataAccessEntry>(
    (cursor) =>
      this.audit.dataAccess({ ...dataAccessQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    () =>
      this.whenEmpty(
        'Ningún acceso a datos sensibles coincide con los filtros elegidos.',
        'No hay accesos a datos sensibles registrados en los últimos 30 días.',
      ),
  );

  // La celda de «Quién» sirve a las dos tablas: sólo lee `userId`.
  private readonly actorCell = viewChild.required<TemplateRef<unknown>>('actorCell');
  private readonly actionCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('actionCell');
  private readonly logWhenCell = viewChild.required<TemplateRef<{ $implicit: AuditLogEntry }>>('logWhenCell');
  private readonly accessWhenCell = viewChild.required<TemplateRef<{ $implicit: DataAccessEntry }>>('accessWhenCell');
  private readonly resourceCell = viewChild.required<TemplateRef<{ $implicit: DataAccessEntry }>>('resourceCell');

  protected readonly logColumns = computed<readonly ColumnDef<AuditLogEntry>[]>(() => [
    // Dos columnas imprescindibles: con el marco del portal, a 1024 px la tabla mide
    // menos de 30rem y una tercera empujaba el detalle (y «Quién») fuera de la vista.
    { key: 'recordedAt', header: 'Cuándo y riesgo', priority: 1, cell: this.logWhenCell() },
    { key: 'action', header: 'Acción', priority: 1, cell: this.actionCell() },
    { key: 'userId', header: 'Quién', priority: 2, cell: shared<AuditLogEntry>(this.actorCell()) },
  ]);

  protected readonly accessColumns = computed<readonly ColumnDef<DataAccessEntry>[]>(() => [
    { key: 'recordedAt', header: 'Cuándo y riesgo', priority: 1, cell: this.accessWhenCell() },
    { key: 'resourceType', header: 'Qué se tocó', priority: 1, cell: this.resourceCell() },
    { key: 'userId', header: 'Quién', priority: 2, cell: shared<DataAccessEntry>(this.actorCell()) },
  ]);

  protected readonly byId = (row: { id: string }): string => row.id;
  protected readonly logRowName = (row: AuditLogEntry): string => `${actionHeadline(row)} · ${dateTime(row.recordedAt)}`;
  protected readonly accessRowName = (row: DataAccessEntry): string =>
    `${dataOperation(row.operation).label} · ${dateTime(row.recordedAt)}`;

  constructor() {
    this.loadActorNames();
    effect(() => {
      const values = this.values();
      untracked(() => (viewOf(values) === 'log' ? this.log.restart() : this.access.restart()));
    });
  }

  protected actorName(userId: string): string {
    return this.actorNames().get(userId) ?? 'Usuario fuera de la consola';
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : AUDIT_VIEWS[index]! });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    const keys = this.view() === 'log' ? LOG_FILTER_KEYS : DATA_ACCESS_FILTER_KEYS;
    void patchQuery(this.router, this.route, Object.fromEntries(keys.map((k) => [k, null])));
  }

  private actorField(): FilterField {
    const names = [...this.actorNames()].map(([value, label]) => ({ value, label }));
    const current = this.values().userId;
    const extra: SelectOption<string>[] =
      current !== '' && !this.actorNames().has(current) ? [{ value: current, label: 'El actor elegido en la tabla' }] : [];
    return {
      key: 'userId',
      label: 'Quién',
      kind: 'select',
      options: [{ value: '', label: 'Cualquier persona' }, ...extra, ...names],
      ...(this.actorNamesUnavailable()
        ? { hint: 'La lista de usuarios internos no llegó: se puede filtrar desde la tabla.' }
        : {}),
    };
  }

  private whenEmpty(filtered: string, unfiltered: string): EmptyViewState {
    const values: AuditUrlValues = this.values();
    const view = viewOf(values);
    const keep: Record<string, string> = view === 'log' ? {} : { view };
    if (hasFilters(values)) {
      return empty({ label: 'Quitar los filtros', route: SCREEN, queryParams: keep }, filtered);
    }
    const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    return empty({ label: 'Mirar el último año', route: SCREEN, queryParams: { ...keep, from: yearAgo } }, unfiltered);
  }

  private loadActorNames(): void {
    const subscription = this.authz.internalUsers({ limit: ACTOR_NAMES_LIMIT }).subscribe({
      next: (page) => this.actorNames.set(new Map(page.items.map((u) => [u.id, u.displayName]))),
      error: () => this.actorNamesUnavailable.set(true),
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }
}
