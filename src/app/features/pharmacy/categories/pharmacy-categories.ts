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
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyCategory } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope } from '../pharmacy-scope';

/** Largo máximo del nombre de una categoría (el mismo tope del servidor). */
const NAME_MAX_LENGTH = 60;

const ROW_ACTIONS: readonly RowAction[] = [
  { code: 'rename', label: 'Renombrar', icon: 'edit' },
  { code: 'delete', label: 'Eliminar', icon: 'remove', destructive: true },
];

/**
 * **Categorías** de la farmacia: las crea, las renombra y las elimina; con cuántos
 * productos usa cada una.
 *
 * - Partida: las seis del mockup del cliente, que el simulador siembra por
 *   farmacia (P47: la API real no tiene categorías propias).
 * - **Renombrar**: los productos siguen a la categoría; el servidor les escribe
 *   el nombre nuevo.
 * - **Eliminar**: el servidor la rechaza con 409 si tiene productos, y esa
 *   respuesta se muestra en pantalla —no se oculta el botón—, porque la lista de
 *   productos que la usan sale del enlace de su conteo.
 */
@Component({
  selector: 'app-pharmacy-categories',
  imports: [
    Alert,
    AppButton,
    Card,
    ContentDialog,
    DataTable,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    RowActions,
    Select,
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-categories.html',
  styleUrl: './pharmacy-categories.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyCategories {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly categories = signal<ViewState<readonly PharmacyCategory[]>>(loading());
  /** Un mensaje del servidor que la pantalla tiene que dejar a la vista (409, 403…). */
  protected readonly notice = signal<string | null>(null);

  /** El modal: `undefined` cerrado, `null` crea, una categoría la renombra. */
  protected readonly dialogTarget = signal<PharmacyCategory | null | undefined>(undefined);
  protected readonly nameDraft = signal('');
  protected readonly dialogError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected readonly rowActions = ROW_ACTIONS;
  protected readonly dialogHeading = computed(() =>
    this.dialogTarget() === null ? 'Nueva categoría' : 'Renombrar la categoría',
  );

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: PharmacyCategory }>>('nameCell');
  private readonly countCell = viewChild.required<TemplateRef<{ $implicit: PharmacyCategory }>>('countCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: PharmacyCategory }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<PharmacyCategory>[]>(() => [
    { key: 'name', header: 'Categoría', priority: 1, cell: this.nameCell() },
    { key: 'count', header: 'Productos', priority: 1, align: 'end', cell: this.countCell() },
    { key: 'actions', header: 'Acciones', priority: 1, align: 'end', sticky: 'end', cell: this.actionsCell() },
  ]);

  protected readonly rowId = (category: PharmacyCategory): string => category.id;
  protected readonly rowLabel = (category: PharmacyCategory): string => category.name;

  constructor() {
    effect(() => {
      if (this.scope.pharmacyId() !== null) {
        untracked(() => this.reload());
      }
    });
  }

  protected reload(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.categories.set(loading());
    this.pharmacy.listCategories(pharmacyId).subscribe({
      next: (page) =>
        this.categories.set(
          page.items.length > 0
            ? ready(page.items)
            : empty({ label: 'Usá «Nueva categoría»' }, 'Todavía no tenés categorías.'),
        ),
      error: (error: unknown) =>
        this.categories.set(errorToViewState<readonly PharmacyCategory[]>(error)),
    });
  }

  /* ─── Crear y renombrar ───────────────────────────────────────────────── */

  protected openNew(): void {
    this.nameDraft.set('');
    this.dialogError.set(null);
    this.dialogTarget.set(null);
  }

  protected closeDialog(): void {
    this.dialogTarget.set(undefined);
  }

  protected save(): void {
    const pharmacyId = this.scope.pharmacyId();
    const target = this.dialogTarget();
    const name = this.nameDraft().trim();
    if (pharmacyId === null || target === undefined || this.saving()) {
      return;
    }
    if (name === '') {
      this.dialogError.set('Escribí un nombre para la categoría.');
      return;
    }
    this.saving.set(true);
    this.dialogError.set(null);
    const request =
      target === null
        ? this.pharmacy.createCategory(pharmacyId, name)
        : this.pharmacy.renameCategory(pharmacyId, target.id, name);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(target === null ? `Creaste «${name}».` : `Renombraste la categoría a «${name}».`);
        this.notice.set(null);
        this.reload();
        this.closeDialog();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.dialogError.set(pharmacyErrorMessage(error, 'No se pudo guardar la categoría.'));
      },
    });
  }

  /* ─── Eliminar ────────────────────────────────────────────────────────── */

  protected async onRowAction(code: string, category: PharmacyCategory): Promise<void> {
    if (code === 'rename') {
      this.nameDraft.set(category.name);
      this.dialogError.set(null);
      this.dialogTarget.set(category);
      return;
    }
    if (code === 'delete') {
      await this.remove(category);
    }
  }

  private async remove(category: PharmacyCategory): Promise<void> {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    const confirmed = await this.dialogs.confirm({
      title: '¿Eliminar esta categoría?',
      message: `«${category.name}» deja de existir. Sólo se puede eliminar si ningún producto la usa.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.pharmacy.deleteCategory(pharmacyId, category.id).subscribe({
      next: () => {
        this.notice.set(null);
        this.toasts.success(`Eliminaste «${category.name}».`);
        this.reload();
      },
      error: (error: unknown) => {
        // El 409 —«tiene productos»— es la respuesta esperada y se deja a la
        // vista en la pantalla, no sólo en un aviso que se va solo.
        this.notice.set(pharmacyErrorMessage(error, 'No se pudo eliminar la categoría.'));
        this.reload();
      },
    });
  }
}
