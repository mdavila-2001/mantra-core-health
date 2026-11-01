import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, type Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiPreview,
  UiPreviewEntry,
  UiVisibilityRule,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { Breakpoints } from '../../../../../core/layout/breakpoints';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import { EmptyState } from '../../../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { portalUrl } from '../../portal-nav';
import { UiElementIndex } from '../element-index';
import {
  effectLabel,
  previewReason,
  subjectTypeLabel,
  validityText,
  visibilityFieldErrors,
} from '../visibility-labels';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const RULES_SCREEN = portalUrl('governance/ui-rules');
const CATALOG_SCREEN = portalUrl('governance/ui-catalog');

/** Una fila de «ver como»: el elemento, por qué queda así y la regla que lo decide (si hay). */
export interface PreviewRow {
  readonly entry: UiPreviewEntry;
  readonly rule: UiVisibilityRule | null;
}

/**
 * «Ver como»: qué le queda oculto a una persona o a un rol, y por qué. Para cada oculto muestra
 * la regla ganadora y si fue por cascada (un elemento superior oculto). Es una previsualización
 * del servidor: no cambia nada. Una persona se pide por su identificador; un rol, por su código.
 */
@Component({
  selector: 'app-visibility-preview-panel',
  imports: [RouterLink, AppButton, Badge, Input, Select, Switch, EmptyState, FormField, MetricCard, DataTable],
  templateUrl: './preview-panel.html',
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewPanel {
  private readonly client = inject(UiVisibilityAdminClient);
  private readonly authz = inject(AuthzAdminClient);
  protected readonly index = inject(UiElementIndex);
  /** Teléfono: dos columnas; el enlace a la regla va dentro de «Por qué». */
  protected readonly narrow = inject(Breakpoints).isNavDrawer;

  readonly mode = input.required<'USER' | 'ROLE'>();
  /** Con qué se abre (de la URL). Si ya es válido, se consulta solo. */
  readonly preset = input<string>('');

  protected readonly target = signal('');
  protected readonly submitted = signal(false);
  protected readonly serverProblem = signal('');
  protected readonly includeVisible = signal(false);
  protected readonly roles = signal<readonly SelectOption<string>[] | null>(null);
  /** El nombre legible de cada rol, por código: la cabecera muestra «Personal de farmacia», no el código. */
  private readonly roleNames = signal<ReadonlyMap<string, string>>(new Map());
  /**
   * Las opciones del selector. Si el rol elegido (p. ej. de un enlace) no figura entre los
   * asignables, se agrega tal cual: el control tiene que mostrar lo que se está consultando.
   */
  protected readonly roleOptions = computed<readonly SelectOption<string>[] | null>(() => {
    const options = this.roles();
    const target = this.target();
    if (options === null || target === '' || options.some((o) => o.value === target)) return options;
    return [...options, { value: target, label: `${target} (no figura entre los roles asignables)` }];
  });
  /**
   * Las personas internas, para elegir por nombre (el mismo listado que usa el simulador de
   * «Quién puede qué»). Si no llega, el campo vuelve a pedir el identificador a mano.
   */
  private readonly users = signal<readonly SelectOption<string>[] | null>(null);
  protected readonly userOptions = computed<readonly SelectOption<string>[] | null>(() => {
    const options = this.users();
    const target = this.target();
    if (options === null || target === '' || options.some((o) => o.value === target)) return options;
    return [...options, { value: target, label: `${target} (no figura en el listado de personas)` }];
  });
  protected readonly subjectName = (label: string): string =>
    this.mode() === 'ROLE' ? (this.roleNames().get(label) ?? label) : label;
  protected readonly state = signal<ViewState<readonly PreviewRow[]> | null>(null);
  protected readonly summary = signal<{ readonly label: string; readonly hidden: number; readonly shown: number; readonly byCascade: number } | null>(null);
  private readonly allRows = signal<readonly PreviewRow[]>([]);

  protected readonly rulesUrl = RULES_SCREEN;
  protected readonly catalogUrl = CATALOG_SCREEN;
  protected readonly effect = effectLabel;
  protected readonly subjectType = subjectTypeLabel;
  protected readonly validity = validityText;
  protected readonly pathOf = (key: string): string => this.index.path(key);
  protected readonly reasonText = (entry: UiPreviewEntry): string => previewReason(entry, (k) => this.index.path(k));

  protected readonly copy = computed(() =>
    this.mode() === 'USER'
      ? this.users() !== null
        ? { label: 'Persona', hint: 'Búsquela por nombre; la vista previa usa su cuenta.', action: 'Ver como esta persona' }
        : {
            label: 'Identificador de la persona',
            hint: 'El id (uuid) de la cuenta, como figura en «Usuarios y roles».',
            action: 'Ver como esta persona',
          }
      : { label: 'Rol', hint: 'Qué le queda oculto a quien tenga este rol y nada más.', action: 'Ver como este rol' },
  );

  protected readonly problem = computed(() => {
    const value = this.target().trim();
    const local =
      value === ''
        ? 'Indique a quién mirar.'
        : this.mode() === 'USER' && !RE_UUID.test(value)
          ? 'Tiene que ser un identificador válido (uuid).'
          : this.mode() === 'ROLE' && !RE_CODE.test(value)
            ? 'Tiene que ser un código de rol en mayúsculas, p. ej. PHARMACY_STAFF.'
            : '';
    return this.serverProblem() !== '' ? this.serverProblem() : this.submitted() ? local : '';
  });

  /** Lo que se dibuja: los ocultos, o también los que una regla deja visibles si se pide. */
  protected readonly tableState = computed<ViewState<readonly PreviewRow[]> | null>(() => {
    const base = this.state();
    if (base === null || base.status !== 'ready') return base;
    const rows = this.includeVisible() ? base.data : base.data.filter((r) => r.entry.hidden);
    return rows.length > 0
      ? ready(rows)
      : empty(
          { label: 'Ver las reglas', route: RULES_SCREEN },
          'No queda nada oculto: todo se muestra según el valor por omisión de cada elemento.',
        );
  });
  protected readonly hasShownByRule = computed(() => this.allRows().some((r) => !r.entry.hidden));

  private readonly elementCell = viewChild.required<TemplateRef<{ $implicit: PreviewRow }>>('elementCell');
  private readonly whyCell = viewChild.required<TemplateRef<{ $implicit: PreviewRow }>>('whyCell');
  private readonly ruleCell = viewChild.required<TemplateRef<{ $implicit: PreviewRow }>>('ruleCell');

  protected readonly columns = computed<readonly ColumnDef<PreviewRow>[]>(() =>
    this.narrow()
      ? [
          { key: 'element', header: 'Elemento', priority: 1, cell: this.elementCell() },
          { key: 'why', header: 'Por qué', priority: 1, cell: this.whyCell() },
        ]
      : [
          { key: 'element', header: 'Elemento', priority: 1, cell: this.elementCell() },
          { key: 'why', header: 'Por qué', priority: 1, cell: this.whyCell() },
          { key: 'rule', header: 'Regla ganadora', priority: 2, cell: this.ruleCell() },
        ],
  );
  protected readonly byKey = (row: PreviewRow): string => row.entry.elementKey;
  protected readonly rowName = (row: PreviewRow): string => this.index.path(row.entry.elementKey);
  protected readonly ruleQuery = (row: PreviewRow): Record<string, string> => ({ element: row.entry.elementKey });
  protected readonly ancestorQuery = (row: PreviewRow): Record<string, string> => ({ element: row.entry.ancestorKey ?? '' });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    const rolesSub = this.authz.assignableRoles().subscribe({
      next: (roles) => {
        this.roleNames.set(new Map(roles.map((r) => [r.code, r.name])));
        this.roles.set(roles.length === 0 ? null : roles.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` })));
      },
      error: () => this.roles.set(null),
    });
    const usersSub = this.authz.internalUsers({ limit: 200 }).subscribe({
      next: (page) =>
        this.users.set(
          page.items.length === 0
            ? null
            : [...page.items]
                .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
                .map((u) => ({ value: u.id, label: u.displayName })),
        ),
      error: () => this.users.set(null),
    });
    inject(DestroyRef).onDestroy(() => {
      rolesSub.unsubscribe();
      usersSub.unsubscribe();
    });
    effect(() => {
      const preset = this.preset();
      untracked(() => {
        if (preset === '') return;
        this.target.set(preset);
        this.run();
      });
    });
  }

  protected setTarget(value: string): void {
    this.target.set(value);
    this.serverProblem.set('');
  }

  protected run(): void {
    this.submitted.set(true);
    this.serverProblem.set('');
    if (this.problem() !== '') return;
    const id = this.target().trim();
    this.subscription?.unsubscribe();
    this.state.set(loading());
    this.summary.set(null);
    this.includeVisible.set(false);
    const request = this.mode() === 'USER' ? this.client.previewForUser(id) : this.client.previewForRole(id);
    this.subscription = request
      .pipe(
        switchMap((preview) =>
          preview.entries.some((e) => e.winningRuleId !== null)
            ? // Con la regla ganadora a la vista; si no se puede leer, queda su id y el resto igual se ve.
              this.client.listRules({ active: true, limit: 200 }).pipe(
                map((page) => ({ preview, rules: page.items })),
                catchError(() => of({ preview, rules: [] as readonly UiVisibilityRule[] })),
              )
            : of({ preview, rules: [] as readonly UiVisibilityRule[] }),
        ),
      )
      .subscribe({
        next: ({ preview, rules }) => this.show(preview, rules),
        error: (e: unknown) => {
          this.summary.set(null);
          if (e instanceof HttpErrorResponse && e.status === 404) {
            this.state.set(null);
            this.serverProblem.set(this.mode() === 'USER' ? 'No se encontró a esa persona.' : 'No se encontró ese rol.');
            return;
          }
          const fields = visibilityFieldErrors(e);
          const own = fields['userId'] ?? fields['roleCode'];
          if (own !== undefined && e instanceof HttpErrorResponse && e.status === 400) {
            this.state.set(null);
            this.serverProblem.set(own);
            return;
          }
          this.state.set(errorToViewState<readonly PreviewRow[]>(e));
        },
      });
  }

  private show(preview: UiPreview, rules: readonly UiVisibilityRule[]): void {
    const byId = new Map(rules.map((r) => [r.id, r]));
    const rows: PreviewRow[] = preview.entries
      .map((entry) => ({ entry, rule: entry.winningRuleId === null ? null : (byId.get(entry.winningRuleId) ?? null) }))
      .sort((a, b) => this.index.path(a.entry.elementKey).localeCompare(this.index.path(b.entry.elementKey)));
    this.allRows.set(rows);
    this.summary.set({
      label: preview.subject.label,
      hidden: rows.filter((r) => r.entry.hidden).length,
      shown: rows.filter((r) => !r.entry.hidden).length,
      byCascade: rows.filter((r) => r.entry.reason === 'ANCESTOR_HIDDEN').length,
    });
    this.state.set(ready(rows));
  }
}
