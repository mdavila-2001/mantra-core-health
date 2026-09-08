import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Input } from '../../atoms/input/input';
import { Select } from '../../atoms/select/select';
import { Textarea } from '../../atoms/textarea/textarea';
import { Tooltip } from '../../atoms/tooltip/tooltip';
import { Card } from '../../molecules/card/card';
import { DialogService } from '../../molecules/dialog/dialog-service';
import { EmptyState } from '../../molecules/empty-state/empty-state';
import { FormField } from '../../molecules/form-field/form-field';
import { Pagination } from '../../molecules/pagination/pagination';
import { ToastService } from '../../molecules/toast/toast.service';
import {
  HISTORICAL_CONFIRM_MESSAGE,
  HISTORICAL_DEFAULT_PAGE_SIZE,
  type HistoricalColumn,
  type HistoricalRecord,
  type HistoricalRecordMode,
  type HistoricalRecordPersistence,
} from './historical-records-table.types';

type Draft = Record<string, string>;

/**
 * Tabla paginada de registros históricos con alta, edición y baja.
 *
 * - Filtro por columna (texto libre, «contiene», sin distinguir mayúsculas).
 * - Lápiz por fila → modal con **los mismos campos** de la tabla.
 * - «Agregar» → el mismo modal, vacío.
 * - Papelera por fila → confirmación y baja.
 *
 * Toda operación pasa por `DialogService.confirm` («¿Estás seguro de aplicar
 * estos cambios?») y, al terminar bien, por `ToastService.success`. Es el
 * mismo par que usa el formulario de perfil, para que la cuenta se sienta
 * una sola pantalla.
 *
 * Es genérica en la fila: el padre declara columnas y filas y se queda con
 * `rowsChange` (o entrega `persistence` para ir contra el backend).
 */
@Component({
  selector: 'app-historical-records-table',
  imports: [AppButton, Card, EmptyState, FormField, Input, Pagination, Select, Textarea, Tooltip],
  templateUrl: './historical-records-table.html',
  styleUrl: './historical-records-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'historical-records' },
})
export class HistoricalRecordsTable<Row extends HistoricalRecord = HistoricalRecord> {
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);

  private readonly modalRef = viewChild<ElementRef<HTMLDialogElement>>('modal');

  readonly columns = input.required<readonly HistoricalColumn[]>();
  readonly rows = model.required<readonly Row[]>();

  /** Nombre en singular de lo que se lista, para rótulos y toasts. */
  readonly entityLabel = input<string>('registro');
  readonly caption = input<string>('');
  /** Título de los toasts: el sustantivo del bloque (convención de la cuenta). */
  readonly toastTitle = input<string>('Historial');
  readonly pageSize = input<number>(HISTORICAL_DEFAULT_PAGE_SIZE);
  readonly persistence = input<HistoricalRecordPersistence<Row> | null>(null);

  readonly created = output<Row>();
  readonly updated = output<Row>();
  readonly deleted = output<Row>();

  /* ---- filtros y paginación --------------------------------------------- */

  protected readonly filters = signal<Readonly<Record<string, string>>>({});
  protected readonly page = signal(1);
  protected readonly currentPageSize = signal(HISTORICAL_DEFAULT_PAGE_SIZE);

  protected readonly hasActiveFilters = computed(() =>
    Object.values(this.filters()).some((value) => value.trim() !== ''),
  );

  protected readonly filteredRows = computed(() => {
    const activos = Object.entries(this.filters())
      .map(([key, value]) => [key, value.trim().toLocaleLowerCase()] as const)
      .filter(([, value]) => value !== '');
    if (activos.length === 0) {
      return this.rows();
    }
    return this.rows().filter((row) =>
      activos.every(([key, value]) =>
        this.displayValue(row, key).toLocaleLowerCase().includes(value),
      ),
    );
  });

  protected readonly pageRows = computed(() => {
    const size = this.currentPageSize();
    const start = (this.page() - 1) * size;
    return this.filteredRows().slice(start, start + size);
  });

  protected readonly totalColumns = computed(() => this.columns().length + 1);

  constructor() {
    afterNextRender(() => this.currentPageSize.set(this.pageSize()));
  }

  protected setFilter(key: string, value: string | number | null): void {
    this.filters.update((actual) => ({ ...actual, [key]: value === null ? '' : String(value) }));
    this.page.set(1);
  }

  protected clearFilters(): void {
    this.filters.set({});
    this.page.set(1);
  }

  protected filterValue(key: string): string {
    return this.filters()[key] ?? '';
  }

  protected displayValue(row: Row, key: string): string {
    const raw = row[key];
    if (raw === null || raw === undefined || raw === '') {
      return '—';
    }
    const column = this.columns().find((candidate) => candidate.key === key);
    if (column?.type === 'select') {
      return column.options?.find((option) => option.value === String(raw))?.label ?? String(raw);
    }
    return String(raw);
  }

  /* ---- el modal (alta y edición comparten campos) ------------------------ */

  protected readonly mode = signal<HistoricalRecordMode>('create');
  protected readonly draft = signal<Draft>({});
  protected readonly editing = signal<Row | null>(null);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);

  protected readonly modalTitle = computed(() =>
    this.mode() === 'create' ? `Agregar ${this.entityLabel()}` : `Editar ${this.entityLabel()}`,
  );

  protected readonly errors = computed<Readonly<Record<string, string>>>(() => {
    if (!this.submitted()) {
      return {};
    }
    const draft = this.draft();
    const errores: Record<string, string> = {};
    for (const column of this.columns()) {
      if (column.required && (draft[column.key] ?? '').trim() === '') {
        errores[column.key] = 'Este campo es obligatorio.';
      }
    }
    return errores;
  });

  protected readonly isValid = computed(() => Object.keys(this.errors()).length === 0);

  protected openCreate(): void {
    this.mode.set('create');
    this.editing.set(null);
    this.draft.set(this.emptyDraft());
    this.showModal();
  }

  protected openEdit(row: Row): void {
    this.mode.set('edit');
    this.editing.set(row);
    this.draft.set(this.draftFrom(row));
    this.showModal();
  }

  protected setField(key: string, value: string | number | null): void {
    this.draft.update((actual) => ({ ...actual, [key]: value === null ? '' : String(value) }));
  }

  protected fieldValue(key: string): string {
    return this.draft()[key] ?? '';
  }

  protected fieldError(key: string): string {
    return this.errors()[key] ?? '';
  }

  protected closeModal(): void {
    this.submitted.set(false);
    this.modalRef()?.nativeElement.close();
  }

  protected handleNativeCancel(event: Event): void {
    event.preventDefault();
    if (!this.saving()) {
      this.closeModal();
    }
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (!this.isValid() || this.saving()) {
      return;
    }
    const confirmado = await this.dialogs.confirm({
      title: this.mode() === 'create' ? 'Confirmar alta' : 'Confirmar cambios',
      message: HISTORICAL_CONFIRM_MESSAGE,
      confirmLabel: 'Aplicar',
      cancelLabel: 'Volver',
    });
    if (!confirmado) {
      return;
    }

    this.saving.set(true);
    try {
      if (this.mode() === 'create') {
        await this.persistCreate();
      } else {
        await this.persistUpdate();
      }
      this.closeModal();
    } catch (error: unknown) {
      // Si la persistencia rechazó con un motivo legible (409, 422…), se dice
      // ése; si no, el genérico.
      this.toasts.error(
        error instanceof Error && error.message !== ''
          ? error.message
          : `No pudimos guardar el ${this.entityLabel()}. Probá de nuevo.`,
        this.toastTitle(),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(row: Row): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: `Eliminar ${this.entityLabel()}`,
      message: HISTORICAL_CONFIRM_MESSAGE,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    try {
      await this.persistence()?.remove?.(row);
      this.rows.update((actual) => actual.filter((candidate) => candidate.id !== row.id));
      this.clampPage();
      this.deleted.emit(row);
      this.toasts.success(`El ${this.entityLabel()} se eliminó correctamente.`, this.toastTitle());
    } catch (error: unknown) {
      this.toasts.error(
        error instanceof Error && error.message !== ''
          ? error.message
          : `No pudimos eliminar el ${this.entityLabel()}. Probá de nuevo.`,
        this.toastTitle(),
      );
    }
  }

  /* ---- persistencia ------------------------------------------------------ */

  private async persistCreate(): Promise<void> {
    const draft = this.draftToValues();
    const creator = this.persistence()?.create;
    const nueva = creator
      ? await creator(draft as Omit<Row, 'id'>)
      : ({ ...draft, id: nextLocalId() } as unknown as Row);
    this.rows.update((actual) => [...actual, nueva]);
    this.created.emit(nueva);
    this.toasts.success(`El ${this.entityLabel()} se creó correctamente.`, this.toastTitle());
  }

  private async persistUpdate(): Promise<void> {
    const original = this.editing();
    if (original === null) {
      return;
    }
    const candidata = { ...original, ...this.draftToValues() } as Row;
    const updater = this.persistence()?.update;
    const actualizada = updater ? await updater(candidata) : candidata;
    this.rows.update((actual) =>
      actual.map((row) => (row.id === original.id ? actualizada : row)),
    );
    this.updated.emit(actualizada);
    this.toasts.success(`El ${this.entityLabel()} se actualizó correctamente.`, this.toastTitle());
  }

  /* ---- ayudas ------------------------------------------------------------ */

  private showModal(): void {
    this.submitted.set(false);
    // El `<dialog>` vive en la plantilla; se espera al siguiente render para
    // que el borrador ya esté pintado antes de que el navegador enfoque.
    afterNextRender(() => this.modalRef()?.nativeElement.showModal(), {
      injector: this.injector,
    });
  }

  private emptyDraft(): Draft {
    return Object.fromEntries(this.columns().map((column) => [column.key, '']));
  }

  private draftFrom(row: Row): Draft {
    return Object.fromEntries(
      this.columns().map((column) => {
        const raw = row[column.key];
        return [column.key, raw === null || raw === undefined ? '' : String(raw)];
      }),
    );
  }

  /** Del borrador (todo texto) a valores tipados según la columna. */
  private draftToValues(): Record<string, string | number | null> {
    const draft = this.draft();
    const values: Record<string, string | number | null> = {};
    for (const column of this.columns()) {
      const texto = (draft[column.key] ?? '').trim();
      if (texto === '') {
        values[column.key] = null;
      } else if (column.type === 'number') {
        const numero = Number(texto);
        values[column.key] = Number.isNaN(numero) ? texto : numero;
      } else {
        values[column.key] = texto;
      }
    }
    return values;
  }

  private clampPage(): void {
    const ultima = Math.max(1, Math.ceil(this.filteredRows().length / this.currentPageSize()));
    if (this.page() > ultima) {
      this.page.set(ultima);
    }
  }

}

let secuenciaLocal = 0;

/** Identificador para filas creadas sin backend: único dentro de la sesión. */
function nextLocalId(): string {
  return `local-${Date.now()}-${++secuenciaLocal}`;
}
