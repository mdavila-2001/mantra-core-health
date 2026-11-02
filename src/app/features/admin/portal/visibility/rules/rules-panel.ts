import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiRuleSubjectType,
  UiVisibilityRule,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Breakpoints } from '../../../../../core/layout/breakpoints';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { FilterForm, type FilterField } from '../../governance/filter-form';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery } from '../../support/route-query';
import { UiElementIndex } from '../element-index';
import {
  SUBJECT_TYPES,
  effectLabel,
  isStaleRule,
  optionsOf,
  ruleState,
  subjectTypeLabel,
  validityText,
  visibilityFailure,
} from '../visibility-labels';
import { RuleEditDialog } from './rule-edit-dialog';

const SCREEN = portalUrl('governance/ui-rules');
const PAGE_SIZE = 50;
const FILTER_KEYS = ['element', 'subjectType', 'state'] as const;

/**
 * Las reglas de visibilidad en una lista paginada por cursor. Por omisión, las que siguen
 * rigiendo o van a regir; «Terminadas» muestra el historial. Las reglas no se borran: se terminan
 * (`validTo = ahora`) y quedan en la auditoría. Editar usa el diálogo con control de versión.
 */
@Component({
  selector: 'app-visibility-rules-panel',
  imports: [AppButton, Badge, Alert, DataTable, FilterForm, RuleEditDialog],
  templateUrl: './rules-panel.html',
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPanel {
  private readonly client = inject(UiVisibilityAdminClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  protected readonly index = inject(UiElementIndex);
  /** Teléfono: sólo las columnas que se leen de un vistazo; lo demás va dentro de la fila. */
  protected readonly narrow = inject(Breakpoints).isNavDrawer;
  /** El motor de visibilidad de esta misma sesión: se recarga tras cada cambio de reglas. */
  private readonly visibility = inject(UiVisibilityService);

  /** Los filtros de la URL (los lee la página, que es quien la tiene). */
  readonly values = input.required<Readonly<Record<(typeof FILTER_KEYS)[number], string>>>();
  /** Un aviso de afuera (p. ej. «regla creada»). */
  readonly notice = input<string | null>(null);
  readonly changed = output<void>();

  protected readonly effect = effectLabel;
  protected readonly subjectType = subjectTypeLabel;
  protected readonly stateOf = (r: UiVisibilityRule) => ruleState(r);
  protected readonly validity = validityText;
  protected readonly editing = signal<UiVisibilityRule | null>(null);
  protected readonly done = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly working = signal<string | null>(null);

  protected readonly fields = computed<readonly FilterField[]>(() => [
    {
      key: 'element',
      label: 'Elemento',
      kind: 'select',
      options: [{ value: '', label: 'Todos los elementos' }, ...this.index.options()],
    },
    {
      key: 'subjectType',
      label: 'Se aplica a',
      kind: 'select',
      options: [{ value: '', label: 'Cualquiera' }, ...optionsOf(SUBJECT_TYPES, (t) => subjectTypeLabel(t).label)],
    },
    {
      key: 'state',
      label: 'Estado',
      kind: 'select',
      options: [
        { value: '', label: 'Vigentes y programadas' },
        { value: 'ended', label: 'Terminadas' },
        { value: 'all', label: 'Todas' },
      ],
    },
  ]);
  protected readonly hasFilters = computed(() => FILTER_KEYS.some((k) => this.values()[k] !== ''));

  protected readonly list = pagedList<UiVisibilityRule>(
    (cursor) => {
      const v = this.values();
      return this.client
        .listRules({
          ...(v.element === '' ? {} : { elementKey: v.element }),
          ...(SUBJECT_TYPES.includes(v.subjectType as UiRuleSubjectType) ? { subjectType: v.subjectType as UiRuleSubjectType } : {}),
          ...(v.state === 'all' ? {} : { active: v.state !== 'ended' }),
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        })
        .pipe(map((page) => ({ items: page.items, nextCursor: page.nextCursor, ...(page.total === null ? {} : { total: page.total }) })));
    },
    () => this.whenEmpty(),
  );

  private readonly ruleCell = viewChild.required<TemplateRef<{ $implicit: UiVisibilityRule }>>('ruleCell');
  private readonly subjectCell = viewChild.required<TemplateRef<{ $implicit: UiVisibilityRule }>>('subjectCell');
  private readonly validityCell = viewChild.required<TemplateRef<{ $implicit: UiVisibilityRule }>>('validityCell');
  private readonly reasonCell = viewChild.required<TemplateRef<{ $implicit: UiVisibilityRule }>>('reasonCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: UiVisibilityRule }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<UiVisibilityRule>[]>(() =>
    this.narrow()
      ? [
          { key: 'rule', header: 'Regla', priority: 1, cell: this.ruleCell() },
          { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
        ]
      : [
          { key: 'rule', header: 'Regla', priority: 1, cell: this.ruleCell() },
          { key: 'subject', header: 'Se aplica a', priority: 1, cell: this.subjectCell() },
          { key: 'validity', header: 'Vigencia', priority: 2, nowrap: true, cell: this.validityCell() },
          { key: 'reason', header: 'Motivo', priority: 3, cell: this.reasonCell() },
          { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
        ],
  );

  protected readonly byId = (row: UiVisibilityRule): string => row.id;
  protected readonly rowName = (row: UiVisibilityRule): string => `${effectLabel(row.effect).label} ${this.index.path(row.elementKey)}`;
  protected readonly pathOf = (key: string): string => this.index.path(key);
  protected readonly canChange = (row: UiVisibilityRule): boolean => ruleState(row).code !== 'ended';

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    void patchQuery(this.router, this.route, Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
  }

  protected edit(rule: UiVisibilityRule): void {
    this.done.set(null);
    this.failure.set(null);
    this.editing.set(rule);
  }

  protected saved(rule: UiVisibilityRule): void {
    this.editing.set(null);
    this.done.set(`Se guardó la regla sobre «${this.pathOf(rule.elementKey)}» (versión ${rule.version}).`);
    this.list.reload();
    // Lo que ve quien edita también cambia: sin esto, su propia interfaz seguiría con las reglas viejas.
    this.visibility.refresh();
    this.changed.emit();
  }

  /** Termina la regla: deja de regir ahora y queda en el historial. No se borra. */
  protected async end(rule: UiVisibilityRule): Promise<void> {
    this.done.set(null);
    this.failure.set(null);
    const confirmed = await this.dialogs.confirm({
      title: 'Terminar la regla',
      message:
        'La regla deja de regir ahora. No se borra: queda en el historial y en la auditoría. Para volver a aplicarla hay que crear una nueva.',
      details: [
        { label: 'Elemento', value: this.pathOf(rule.elementKey) },
        { label: 'Qué hace', value: effectLabel(rule.effect).label },
        { label: 'Se aplica a', value: rule.subjectLabel ?? rule.subjectId ?? 'Todos' },
      ],
      confirmLabel: 'Terminar la regla',
      destructive: true,
    });
    if (!confirmed) return;
    this.working.set(rule.id);
    this.pending = this.client.endRule(rule.id).subscribe({
      next: () => {
        this.working.set(null);
        this.done.set(`Se terminó la regla sobre «${this.pathOf(rule.elementKey)}». Quedó en el historial.`);
        this.list.reload();
        this.visibility.refresh();
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.working.set(null);
        this.failure.set(visibilityFailure(e, 'No se pudo terminar la regla.'));
        // Si ya estaba terminada o ya no existe, la lista que se ve está vieja: se pone al día.
        if (isStaleRule(e)) this.list.reload();
      },
    });
  }

  private whenEmpty(): EmptyViewState {
    const v = this.values();
    if (FILTER_KEYS.some((k) => v[k] !== '')) {
      return empty({ label: 'Quitar los filtros', route: SCREEN }, 'Ninguna regla coincide con los filtros elegidos.');
    }
    return empty(
      { label: 'Crear la primera regla', route: SCREEN, queryParams: { view: 'new' } },
      'Todavía no hay reglas vigentes: toda la interfaz se muestra según el valor por omisión de cada elemento.',
    );
  }
}
