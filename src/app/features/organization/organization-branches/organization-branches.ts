import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type {
  BranchChanges,
  BranchListItem,
} from '../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { BranchBulkImport } from '../../../shared/components/organisms/branch-bulk-import/branch-bulk-import';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  BRANCH_CODE_MAX_LENGTH,
  BRANCH_DESCRIPTION_MAX_LENGTH,
  BRANCH_LOCATION_URL_MAX_LENGTH,
  BRANCH_NAME_MAX_LENGTH,
  branchCodeFromName,
  coordinatesFromMapUrl,
  isWebUrl,
  nameKey,
  type BranchDraft,
} from '../../../shared/utils/branch-import/branch-import';

import {
  branchRejectionReason,
  createBranchesInSeries,
  type BranchRejection,
} from './create-branches-in-series';

/** Lo que se escribe en el diálogo, todavía como texto. */
interface BranchForm {
  readonly name: string;
  readonly code: string;
  readonly description: string;
  readonly locationUrl: string;
}

const EMPTY_FORM: BranchForm = { name: '', code: '', description: '', locationUrl: '' };

/** El diálogo está cerrado, crea una sucursal nueva o edita una existente. */
type Editing = { readonly mode: 'create' } | { readonly mode: 'edit'; readonly branch: BranchListItem };

/**
 * **Sucursales** de la organización activa: la pestaña del portal de la
 * farmacia y del laboratorio (01/10/2026) para verlas, editarlas una por una y
 * subirlas en lote con un CSV.
 *
 * La carga masiva es la misma pieza que usan las altas y la ficha de
 * administración (`app-branch-bulk-import`), y crea en serie con
 * {@link createBranchesInSeries}. La edición es `PATCH
 * /tenants/{id}/branches/{branchId}`, que **sólo existe en el simulador** (P54).
 *
 * El código no se edita: es la identidad de la sucursal dentro de la
 * organización. Al cambiar el enlace de ubicación, el punto en el mapa se
 * vuelve a sacar del enlace; un enlace sin punto escrito lo borra, porque
 * dejaría el pin de otro lugar.
 */
@Component({
  selector: 'app-organization-branches',
  imports: [
    Alert,
    AppButton,
    BranchBulkImport,
    Card,
    ContentDialog,
    DataTable,
    FormActions,
    FormField,
    Input,
    Link,
    PageHeader,
    Textarea,
  ],
  templateUrl: './organization-branches.html',
  styleUrl: './organization-branches.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationBranches {
  private readonly session = inject(SessionStore);
  private readonly directory = inject(DirectoryClient);
  private readonly toasts = inject(ToastService);

  protected readonly tenantId = this.session.activeTenantId;
  protected readonly branches = signal<ViewState<readonly BranchListItem[]>>(loading());

  protected readonly nameMax = BRANCH_NAME_MAX_LENGTH;
  protected readonly codeMax = BRANCH_CODE_MAX_LENGTH;
  protected readonly descriptionMax = BRANCH_DESCRIPTION_MAX_LENGTH;
  protected readonly urlMax = BRANCH_LOCATION_URL_MAX_LENGTH;

  /* --- carga en lote ------------------------------------------------------ */

  private readonly bulkImport = viewChild(BranchBulkImport);
  protected readonly bulkOpen = signal(false);
  protected readonly bulkSaving = signal(false);
  /** Las que la API rechazó en el último lote, con su motivo. */
  protected readonly rejected = signal<readonly BranchRejection[]>([]);

  /** Sólo con la lista a la vista: sin ella no hay contra qué detectar repetidas. */
  protected readonly listReady = computed(() => {
    const status = this.branches().status;
    return status === 'ready' || status === 'empty';
  });

  private readonly loaded = computed(() => dataOf(this.branches()) ?? []);
  protected readonly existingNames = computed(() => this.loaded().map((branch) => branch.name));

  /* --- diálogo de una sucursal ------------------------------------------- */

  private readonly dialog = viewChild(ContentDialog);
  protected readonly editing = signal<Editing | null>(null);
  protected readonly form = signal<BranchForm>(EMPTY_FORM);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly dialogHeading = computed(() =>
    this.editing()?.mode === 'edit' ? 'Editar la sucursal' : 'Nueva sucursal',
  );

  protected readonly nameError = computed(() => {
    const name = this.form().name.trim();
    if (name === '') {
      return 'Escriba el nombre de la sucursal.';
    }
    const editing = this.editing();
    const ownId = editing?.mode === 'edit' ? editing.branch.id : null;
    const repeated = this.loaded().some(
      (branch) => branch.id !== ownId && nameKey(branch.name) === nameKey(name),
    );
    return repeated ? 'Ya tiene una sucursal con ese nombre.' : '';
  });

  protected readonly urlError = computed(() => {
    const url = this.form().locationUrl.trim();
    return url === '' || isWebUrl(url) ? '' : 'Pegue un enlace que empiece con https://.';
  });

  /** Si el enlace escrito trae el punto: se lo dice antes de guardar. */
  protected readonly urlHasPoint = computed(() => {
    const url = this.form().locationUrl.trim();
    return url !== '' && this.urlError() === '' && coordinatesFromMapUrl(url) !== null;
  });

  protected readonly hasChanges = computed(() => {
    const editing = this.editing();
    if (editing === null) {
      return false;
    }
    if (editing.mode === 'create') {
      return this.form().name.trim() !== '';
    }
    return Object.keys(this.changesFor(editing.branch)).length > 0;
  });

  /* --- tabla -------------------------------------------------------------- */

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('nameCell');
  private readonly descriptionCell =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('descriptionCell');
  private readonly locationCell =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('locationCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<BranchListItem>[]>(() => [
    { key: 'name', header: 'Sucursal', priority: 1, cell: this.nameCell() },
    { key: 'description', header: 'Descripción', priority: 3, cell: this.descriptionCell() },
    { key: 'location', header: 'Ubicación', priority: 2, cell: this.locationCell() },
    { key: 'actions', header: 'Acciones', priority: 1, align: 'end', cell: this.actionsCell() },
  ]);

  protected readonly rowId = (branch: BranchListItem): string => branch.id;
  protected readonly rowLabel = (branch: BranchListItem): string => branch.name;

  constructor() {
    effect(() => {
      this.tenantId();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    const tenantId = this.tenantId();
    if (tenantId === null) {
      this.branches.set(
        empty(
          { label: 'Elija la organización en el selector de arriba' },
          'Sin una organización activa no hay sucursales que mostrar.',
        ),
      );
      return;
    }
    this.branches.set(loading());
    this.directory.listBranches(tenantId).subscribe({
      next: (list) =>
        this.branches.set(
          list.items.length > 0
            ? ready(list.items)
            : empty(
                { label: 'Use «Agregar sucursal» o «Subir sucursales (CSV)»' },
                'Todavía no cargó sucursales.',
              ),
        ),
      error: (error: unknown) =>
        this.branches.set(errorToViewState<readonly BranchListItem[]>(error)),
    });
  }

  /* --- carga en lote ------------------------------------------------------ */

  protected openBulk(): void {
    this.rejected.set([]);
    this.bulkOpen.set(true);
  }

  protected createBatch(drafts: readonly BranchDraft[]): void {
    const tenantId = this.tenantId();
    if (tenantId === null || this.bulkSaving() || drafts.length === 0) {
      return;
    }
    this.bulkSaving.set(true);
    this.rejected.set([]);
    const takenCodes = this.loaded().map((branch) => branch.code);
    createBranchesInSeries(this.directory, tenantId, drafts, takenCodes).subscribe(
      ({ created, rejected }) => {
        this.bulkSaving.set(false);
        if (created > 0) {
          this.toasts.success(
            created === 1 ? 'Se creó 1 sucursal.' : `Se crearon ${created} sucursales.`,
            'Sucursales cargadas',
          );
        }
        this.rejected.set(rejected);
        this.bulkImport()?.close();
        this.reload();
      },
    );
  }

  /* --- una sucursal ------------------------------------------------------- */

  protected openCreate(): void {
    this.openDialog({ mode: 'create' }, EMPTY_FORM);
  }

  protected openEdit(branch: BranchListItem): void {
    this.openDialog(
      { mode: 'edit', branch },
      {
        name: branch.name,
        code: branch.code,
        description: branch.description ?? '',
        locationUrl: branch.locationUrl ?? '',
      },
    );
  }

  private openDialog(editing: Editing, form: BranchForm): void {
    this.form.set(form);
    this.submitted.set(false);
    this.saveError.set(null);
    this.editing.set(editing);
  }

  protected setField(field: keyof BranchForm, value: string | number | null): void {
    this.form.update((current) => ({ ...current, [field]: value === null ? '' : String(value) }));
  }

  /** Cancelar cierra por el diálogo, que devuelve el foco a quien lo abrió. */
  protected cancel(): void {
    this.dialog()?.close();
  }

  protected closeDialog(): void {
    if (!this.saving()) {
      this.editing.set(null);
    }
  }

  protected save(): void {
    const editing = this.editing();
    const tenantId = this.tenantId();
    this.submitted.set(true);
    if (
      editing === null ||
      tenantId === null ||
      this.saving() ||
      this.nameError() !== '' ||
      this.urlError() !== ''
    ) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    const request =
      editing.mode === 'edit'
        ? this.directory.updateBranch(tenantId, editing.branch.id, this.changesFor(editing.branch))
        : this.directory.createBranch(tenantId, this.newBranch());
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(
          editing.mode === 'edit' ? 'Guardó los cambios de la sucursal.' : 'Agregó la sucursal.',
        );
        this.dialog()?.close(true);
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(branchRejectionReason(error, 'No se pudo guardar la sucursal.'));
      },
    });
  }

  /** Sólo lo que cambió: una clave ausente deja el dato como está. */
  private changesFor(branch: BranchListItem): BranchChanges {
    const form = this.form();
    const name = form.name.trim();
    const description = form.description.trim();
    const locationUrl = form.locationUrl.trim();
    const changes: { -readonly [K in keyof BranchChanges]: BranchChanges[K] } = {};
    if (name !== branch.name) {
      changes.name = name;
    }
    if (description !== (branch.description ?? '')) {
      changes.description = description === '' ? null : description;
    }
    if (locationUrl !== (branch.locationUrl ?? '')) {
      changes.locationUrl = locationUrl === '' ? null : locationUrl;
      // El punto viejo era del enlace viejo: se reemplaza o se borra.
      const point = locationUrl === '' ? null : coordinatesFromMapUrl(locationUrl);
      changes.latitude = point?.latitude ?? null;
      changes.longitude = point?.longitude ?? null;
    }
    return changes;
  }

  private newBranch() {
    const form = this.form();
    const name = form.name.trim();
    const typed = form.code.trim();
    const code =
      typed === '' ? branchCodeFromName(name, new Set(this.loaded().map((b) => b.code))) : typed;
    const description = form.description.trim();
    const locationUrl = form.locationUrl.trim();
    const point = locationUrl === '' ? null : coordinatesFromMapUrl(locationUrl);
    return {
      code,
      name,
      ...(description === '' ? {} : { description }),
      ...(locationUrl === '' ? {} : { locationUrl }),
      ...(point === null ? {} : { latitude: point.latitude, longitude: point.longitude }),
    };
  }
}
