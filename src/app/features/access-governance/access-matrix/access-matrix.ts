import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import {
  ACCESS_ERROR_TEXTS,
  accessFailureOf,
  AccessExplainClient,
  AccessGovernanceClient,
  type AccessMatrix as AccessMatrixData,
  type ExplainAccessRequest,
  type ExplainAccessResponse,
  type MatrixQuery,
  type PersonMatrixRow,
  type SupportActionInput,
  type TargetMatrix,
  type TargetMatrixRow,
} from '../../../core/data-access/access-governance';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportCatalog } from '../../../core/data-access/support-access/support-access.types';
import { atomMeta } from '../../../core/data-access/support-access/support-atoms';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';
import {
  blockText,
  CELL_GLYPH,
  CELL_MEANING,
  CELL_ORDER,
  CELL_TEXT,
  cellOf,
  columnLabel,
  conditionTexts,
  decisionView,
  explainableAtoms,
  FORMAT_OPTIONS,
  GROUP_OPTIONS,
  KIND_OPTIONS,
  SENSITIVITY_OPTIONS,
  STATE_OPTIONS,
  TARGET_PROMPT,
  VIEW_OPTIONS,
  exportFilters,
  hasFilters,
  isPersonMatrix,
  locationKindText,
  NO_FILTERS,
  pageOf,
  sortByName,
  stateText,
  templateChoices,
  templateLabel,
  visibleColumns,
  visibleRows,
  visibleTargetRows,
  type MatrixFilters,
  type MatrixView,
  type PersonGroup,
  type SensitivityFilter,
  type StateFilter,
  type TargetKind,
} from './access-matrix.support';

/** Pasado este tiempo, la matriz se muestra como «atrasada» (S7) con su antigüedad. */
const STALE_AFTER_MS = 15 * 60_000;

/** Lo que se está mirando: una celda de la matriz de personas o una fila de «quién puede actuar sobre…». */
type Selection =
  | { readonly kind: 'cell'; readonly row: PersonMatrixRow; readonly column: string }
  | { readonly kind: 'target'; readonly row: TargetMatrixRow };

type ExplainView =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly response: ExplainAccessResponse }
  | { readonly status: 'error'; readonly message: string };

/**
 * **Matriz de accesos** — «Quién tiene qué» (personas × categorías o permisos) y «Quién puede actuar sobre…» (un doctor, un
 * servicio o un espacio), con filtros, celdas con su «¿por qué?» y exportación auditada (CONTRATO-GOBIERNO §6.5, §9.3 fila 3).
 *
 * Lo que dice cada celda y cada «¿por qué?» lo calcula la API (`access-matrix`, `explain`); la pantalla no replica la política.
 * No muestra ningún dato de pacientes. Exportar pide un motivo de al menos 10 caracteres y el segundo paso, que resuelve
 * `AccessChallengeService`.
 */
@Component({
  selector: 'app-access-matrix',
  imports: [
    AppButton,
    Alert,
    Card,
    DataTable,
    FormField,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './access-matrix.html',
  styleUrl: './access-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessMatrix implements OnInit {
  private readonly governance = inject(AccessGovernanceClient);
  private readonly route = inject(ActivatedRoute);
  private readonly explainClient = inject(AccessExplainClient);
  private readonly support = inject(SupportAccessClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly download = inject(FileDownloadService);
  private readonly toasts = inject(ToastService);

  /* ---- qué se mira ---- */
  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly groupOptions = GROUP_OPTIONS;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly formatOptions = FORMAT_OPTIONS;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly sensitivityOptions = SENSITIVITY_OPTIONS;
  protected readonly legend = CELL_ORDER.map((status) => ({
    status,
    glyph: CELL_GLYPH[status],
    text: CELL_TEXT[status],
    meaning: CELL_MEANING[status],
  }));

  protected readonly view = signal<MatrixView>('person');
  protected readonly group = signal<PersonGroup>('category');
  protected readonly targetKind = signal<TargetKind>('doctor');
  protected readonly targetId = signal<string | null>(null);
  protected readonly filters = signal<MatrixFilters>(NO_FILTERS);
  protected readonly nameSort = signal<'asc' | 'desc' | null>(null);
  protected readonly page = signal(0);

  private readonly catalog = signal<SupportCatalog | null>(null);
  protected readonly matrix = signal<ViewState<AccessMatrixData>>(loading());
  protected readonly selection = signal<Selection | null>(null);
  protected readonly explainAtom = signal<string | null>(null);
  protected readonly explain = signal<ExplainView>({ status: 'idle' });

  /* ---- exportar ---- */
  protected readonly exportOpen = signal(false);
  protected readonly exportFormat = signal<'csv' | 'json'>('csv');
  protected readonly exportReason = signal('');
  protected readonly exportReasonError = signal<string | null>(null);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  protected readonly exportDone = signal<{
    readonly rowCount: number;
    readonly sha256: string;
    readonly fileName: string;
  } | null>(null);

  /* ---- lo derivado ---- */
  protected readonly data = computed(() => dataOf(this.matrix()));
  protected readonly personMatrix = computed(() => {
    const matrix = this.data();
    return matrix !== null && isPersonMatrix(matrix) ? matrix : null;
  });
  protected readonly targetMatrix = computed<TargetMatrix | null>(() => {
    const matrix = this.data();
    return matrix !== null && !isPersonMatrix(matrix) ? matrix : null;
  });

  protected readonly templateOptions = computed<readonly SelectOption<string>[]>(() => {
    const rows = this.personMatrix()?.rows ?? this.targetMatrix()?.rows ?? [];
    return [{ value: 'ALL', label: 'Todas las plantillas' }, ...templateChoices(rows)];
  });

  protected readonly columns = computed(() => {
    const matrix = this.personMatrix();
    return matrix === null ? [] : visibleColumns(matrix, this.filters());
  });
  private readonly personRows = computed(() => {
    const matrix = this.personMatrix();
    return matrix === null
      ? []
      : sortByName(visibleRows(matrix, this.columns(), this.filters()), this.nameSort());
  });
  protected readonly personPage = computed(() => pageOf(this.personRows(), this.page()));

  private readonly targetRows = computed(() => {
    const matrix = this.targetMatrix();
    return matrix === null
      ? []
      : sortByName(visibleTargetRows(matrix.rows, this.filters()), this.nameSort());
  });
  protected readonly targetPage = computed(() => pageOf(this.targetRows(), this.page()));
  protected readonly targetTable = computed<ViewState<readonly TargetMatrixRow[]>>(() =>
    ready(this.targetPage().items),
  );
  protected readonly targetCursor = computed<CursorState>(() => {
    const { page, pages } = this.targetPage();
    return {
      prevCursor: page > 0 ? String(page - 1) : null,
      nextCursor: page + 1 < pages ? String(page + 1) : null,
    };
  });
  protected readonly targetSort = computed<SortState | null>(() =>
    this.nameSort() === null ? null : { key: 'person', direction: this.nameSort()! },
  );
  protected readonly noMatches = computed(() =>
    this.view() === 'person' ? this.personRows().length === 0 : this.targetRows().length === 0,
  );
  protected readonly filtered = computed(() => hasFilters(this.filters()));

  protected readonly targetOptions = computed<readonly SelectOption<string>[]>(() => {
    const catalog = this.catalog();
    if (catalog === null) return [];
    switch (this.targetKind()) {
      case 'doctor':
        return catalog.doctors.map((d) => ({
          value: d.id,
          label: d.name,
          description: d.specialty,
        }));
      case 'service':
        return catalog.services.map((s) => ({ value: s.id, label: s.name }));
      case 'location':
        return catalog.locations.map((l) => ({
          value: l.id,
          label: l.name,
          description: locationKindText(l.kind),
        }));
    }
  });
  protected readonly targetName = computed(
    () =>
      this.targetOptions().find((o) => o.value === this.targetId())?.label ?? 'el destino elegido',
  );

  protected readonly explainOptions = computed<readonly SelectOption<string>[]>(() => {
    const selection = this.selection();
    if (selection === null) return [];
    if (selection.kind === 'cell')
      return explainableAtoms(selection.column).map((a) => ({ value: a.value, label: a.label }));
    return selection.row.atoms.map((code) => ({
      value: code,
      label: atomMeta(code)?.name ?? code,
    }));
  });
  protected readonly explainFixed = computed(() => {
    const selection = this.selection();
    return selection?.kind === 'cell' && explainableAtoms(selection.column).length === 1;
  });

  private readonly personCell =
    viewChild.required<TemplateRef<{ $implicit: TargetMatrixRow }>>('personCell');
  private readonly effectiveCell =
    viewChild.required<TemplateRef<{ $implicit: TargetMatrixRow }>>('effectiveCell');
  private readonly atomsCell =
    viewChild.required<TemplateRef<{ $implicit: TargetMatrixRow }>>('atomsCell');
  private readonly conditionsCell =
    viewChild.required<TemplateRef<{ $implicit: TargetMatrixRow }>>('conditionsCell');
  private readonly whyCell =
    viewChild.required<TemplateRef<{ $implicit: TargetMatrixRow }>>('whyCell');

  protected readonly targetColumns = computed<readonly ColumnDef<TargetMatrixRow>[]>(() => [
    { key: 'person', header: 'Persona', priority: 1, sortable: true, cell: this.personCell() },
    { key: 'effective', header: 'Hoy', priority: 1, cell: this.effectiveCell() },
    { key: 'atoms', header: 'Permisos', priority: 2, cell: this.atomsCell() },
    { key: 'conditions', header: 'Condiciones', priority: 3, cell: this.conditionsCell() },
    { key: 'why', header: 'Acciones', priority: 1, accion: true, cell: this.whyCell() },
  ]);
  protected readonly rowId = (row: TargetMatrixRow): string => row.engagementId;
  protected readonly rowLabel = (row: TargetMatrixRow): string => row.name ?? 'Persona del equipo';

  ngOnInit(): void {
    // El tablero enlaza con `?sensitivity=HIGH` («Accesos de alto riesgo»): la matriz arranca con ese filtro.
    const pedida = this.route.snapshot.queryParamMap.get('sensitivity');
    if (pedida === 'MEDIUM' || pedida === 'HIGH' || pedida === 'CRITICAL')
      this.filters.update((f) => ({ ...f, sensitivity: pedida }));
    this.reload();
  }

  /* ---- cargar ---- */

  protected reload(): void {
    this.selection.set(null);
    this.explain.set({ status: 'idle' });
    this.page.set(0);
    const query = this.queryOf();
    if (query === null) {
      this.matrix.set(empty({ label: 'Elija una opción de la lista de arriba' }, TARGET_PROMPT));
      return;
    }
    this.matrix.set(loading());
    this.governance.getAccessMatrix(query).subscribe({
      next: (matrix) => this.matrix.set(this.stateOf(matrix)),
      error: (failure: unknown) => this.matrix.set(errorToViewState<AccessMatrixData>(failure)),
    });
  }

  private queryOf(): MatrixQuery | null {
    if (this.view() === 'person') return { by: 'person', group: this.group() };
    const id = this.targetId();
    return id === null ? null : { by: this.targetKind(), id };
  }

  private stateOf(matrix: AccessMatrixData): ViewState<AccessMatrixData> {
    if (matrix.rows.length === 0) {
      return this.view() === 'person'
        ? empty(
            {
              label: 'Invite a alguien al equipo de apoyo',
              route: '/administration/support-invitations',
            },
            'Todavía no hay personas con vínculo de apoyo en su organización.',
          )
        : empty(
            { label: 'Dar permisos a alguien del equipo', route: '/administration/support-team' },
            'Nadie puede actuar hoy sobre el destino elegido.',
          );
    }
    const asOf = new Date(matrix.generatedAt);
    return Number.isNaN(asOf.getTime()) || Date.now() - asOf.getTime() <= STALE_AFTER_MS
      ? ready(matrix)
      : stale(matrix, asOf);
  }

  private ensureCatalog(): void {
    if (this.catalog() !== null) return;
    this.support.getCatalog().subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: (failure: unknown) => this.matrix.set(errorToViewState<AccessMatrixData>(failure)),
    });
  }

  /* ---- elegir qué mirar ---- */

  protected setView(view: MatrixView): void {
    if (view === this.view()) return;
    this.view.set(view);
    this.nameSort.set(null);
    if (view === 'target') this.ensureCatalog();
    this.reload();
  }

  protected setGroup(group: PersonGroup): void {
    if (group === this.group()) return;
    this.group.set(group);
    this.reload();
  }

  protected setTargetKind(kind: TargetKind): void {
    if (kind === this.targetKind()) return;
    this.targetKind.set(kind);
    this.targetId.set(null);
    this.reload();
  }

  protected setTarget(id: string | null): void {
    if (id === null || id === this.targetId()) return;
    this.targetId.set(id);
    this.reload();
  }

  protected setTemplate(template: string | null): void {
    this.setFilters({ template: template ?? 'ALL' });
  }
  protected setState(state: StateFilter | null): void {
    this.setFilters({ state: state ?? 'ALL' });
  }
  protected setSensitivity(sensitivity: SensitivityFilter | null): void {
    this.setFilters({ sensitivity: sensitivity ?? 'ALL' });
  }
  protected clearFilters(): void {
    this.setFilters(NO_FILTERS);
  }

  private setFilters(change: Partial<MatrixFilters>): void {
    this.filters.update((current) => ({ ...current, ...change }));
    this.page.set(0);
  }

  protected toggleNameSort(): void {
    this.nameSort.update((current) => (current === 'asc' ? 'desc' : 'asc'));
    this.page.set(0);
  }

  protected changeTargetSort(sort: SortState): void {
    this.nameSort.set(sort.direction);
    this.page.set(0);
  }

  protected goToPage(page: number): void {
    this.page.set(page);
  }

  protected changeTargetPage(cursor: string): void {
    this.page.set(Number(cursor));
  }

  /* ---- detalle y «¿por qué?» ---- */

  protected pickCell(row: PersonMatrixRow, column: string): void {
    this.selection.set({ kind: 'cell', row, column });
    this.explainAtom.set(explainableAtoms(column)[0]?.value ?? null);
    this.explain.set({ status: 'idle' });
  }

  protected pickTarget(row: TargetMatrixRow): void {
    this.selection.set({ kind: 'target', row });
    this.explainAtom.set(row.atoms[0] ?? null);
    this.explain.set({ status: 'idle' });
  }

  protected runExplain(): void {
    const selection = this.selection();
    const action = this.explainAtom();
    if (selection === null || action === null) return;
    this.explain.set({ status: 'loading' });
    this.explainClient
      .explain(this.explainRequest(selection, action as SupportActionInput))
      .subscribe({
        next: (response) => this.explain.set({ status: 'ready', response }),
        error: (failure: unknown) => {
          const info = accessFailureOf(failure);
          const message =
            info?.status === 404
              ? 'No encontramos a esa persona. Actualice la matriz.'
              : (info?.message ?? 'No pudimos explicar esta decisión. Intente de nuevo.');
          this.explain.set({ status: 'error', message });
        },
      });
  }

  private explainRequest(selection: Selection, action: SupportActionInput): ExplainAccessRequest {
    const engagementId = selection.row.engagementId;
    if (selection.kind === 'cell') return { engagementId, action };
    const id = this.targetId();
    if (id === null) return { engagementId, action };
    switch (this.targetKind()) {
      case 'doctor':
        return { engagementId, action, practitionerRoleAssignmentId: id };
      case 'service':
        return { engagementId, action, healthcareServiceId: id };
      case 'location':
        // Una sede no es un espacio de atención: la pregunta va sin él.
        return this.catalog()?.locations.find((l) => l.id === id)?.kind === 'SITE'
          ? { engagementId, action }
          : { engagementId, action, careSpaceId: id };
    }
  }

  /* ---- exportar ---- */

  protected toggleExport(): void {
    this.exportOpen.update((open) => !open);
    this.exportError.set(null);
  }

  protected changeReason(value: string): void {
    this.exportReason.set(value);
    if (this.exportReasonError() !== null) this.exportReasonError.set(null);
  }

  protected submitExport(): void {
    if (this.exporting()) return;
    const reason = this.exportReason().trim();
    if (reason.length < 10) {
      this.exportReasonError.set(
        ACCESS_ERROR_TEXTS['EXPORT_REASON_REQUIRED'] ?? 'Escriba el motivo de la exportación.',
      );
      return;
    }
    const format = this.exportFormat();
    const target =
      this.view() === 'target' && this.targetId() !== null
        ? { kind: this.targetKind(), id: this.targetId()! }
        : null;
    const filters = exportFilters(
      this.view() === 'target' && target === null ? 'person' : this.view(),
      this.group(),
      target,
      this.filters(),
    );
    this.exporting.set(true);
    this.exportError.set(null);
    this.exportDone.set(null);
    // El segundo paso lo pide la API; el servicio de desafíos lo resuelve con la persona y repite la petición.
    this.challenges
      .run(() => this.governance.exportReport('access-matrix', { format, reason, filters }), {
        actionLabel: 'Exportar la matriz de accesos',
      })
      .subscribe({
        next: (file) => {
          const fileName = `matriz-de-accesos-${new Date().toISOString().slice(0, 10)}.${file.format}`;
          this.download.save(
            new Blob([file.content], {
              type: file.format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
            }),
            fileName,
          );
          this.exporting.set(false);
          this.exportReason.set('');
          this.exportDone.set({ rowCount: file.rowCount, sha256: file.sha256, fileName });
          this.toasts.success('La matriz se exportó y quedó registrada en la bitácora.');
        },
        error: (failure: unknown) => {
          this.exporting.set(false);
          this.exportError.set(
            failure instanceof AccessChallengeCancelledError
              ? 'No se exportó nada: canceló la confirmación.'
              : (accessFailureOf(failure)?.message ??
                  'No pudimos exportar la matriz. Intente de nuevo.'),
          );
        },
      });
  }

  /* ---- texto para la plantilla ---- */

  protected readonly cellOf = cellOf;
  protected readonly columnLabel = columnLabel;
  protected readonly cellText = CELL_TEXT;
  protected readonly cellGlyph = CELL_GLYPH;
  protected readonly stateText = stateText;
  protected readonly templateLabel = templateLabel;
  protected readonly conditionTexts = conditionTexts;
  protected readonly decisionView = decisionView;
  protected readonly blockText = blockText;

  protected personName(row: { readonly name?: string }): string {
    return row.name ?? 'Persona del equipo';
  }

  protected atomNames(row: TargetMatrixRow): string {
    const names = row.atoms.map((code) => atomMeta(code)?.name ?? code);
    return names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 3).join(', ')} y ${names.length - 3} más`;
  }

  protected isCellSelected(row: PersonMatrixRow, column: string): boolean {
    const selection = this.selection();
    return (
      selection?.kind === 'cell' &&
      selection.row.engagementId === row.engagementId &&
      selection.column === column
    );
  }

  protected selectedRow(): {
    readonly name?: string;
    readonly engagementId: string;
    readonly templateCode?: string;
    readonly state: string;
  } | null {
    return this.selection()?.row ?? null;
  }

  protected pageSummary(): string {
    const { page, pages } = this.view() === 'person' ? this.personPage() : this.targetPage();
    const total = this.view() === 'person' ? this.personRows().length : this.targetRows().length;
    return `Página ${page + 1} de ${pages} · ${total} ${total === 1 ? 'persona' : 'personas'}`;
  }
}
