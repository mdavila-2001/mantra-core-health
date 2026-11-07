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

import {
  roleAssignmentState,
  roleAssignmentStatusText,
  roleAssignmentStatusTone,
} from '../../../core/data-access/role-assignments/role-assignment-status';
import { RoleAssignmentsClient } from '../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../core/data-access/role-assignments/role-assignments.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { Practice } from '../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** What the organization can do to a doctor who already works there. */
type Action = 'suspend' | 'end';

/**
 * **Accesos de médicos**: the doctors who work in the organization's practice, and the
 * organization's power over them: suspend an active access or end it. The affiliation requests
 * (invite, approve, reject) live in «Médicos del centro»; this screen starts where those end.
 *
 * It never changes a row by itself: it asks the API, reloads and paints the state that comes
 * back. Ending is final, so it asks for a second click before it sends anything.
 */
@Component({
  selector: 'app-doctor-access',
  imports: [AppButton, Badge, Card, DataTable, FormField, PageHeader, Select],
  templateUrl: './doctor-access.html',
  styleUrl: './doctor-access.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorAccess implements OnInit {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly assignments = inject(RoleAssignmentsClient);
  private readonly toasts = inject(ToastService);

  protected readonly practices = signal<readonly Practice[]>([]);
  protected readonly practiceId = signal<string | null>(null);
  protected readonly rows = signal<ViewState<readonly RoleAssignmentRow[]>>(loading());
  /** The row whose «Terminar» is waiting for its confirmation. */
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly busyRowId = signal<string | null>(null);

  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    this.practices().map((practice) => ({ value: practice.id, label: practice.name })),
  );

  private readonly doctorCell = viewChild.required<TemplateRef<{ $implicit: RoleAssignmentRow }>>('doctorCell');
  protected readonly columns = computed<readonly ColumnDef<RoleAssignmentRow>[]>(() => [
    { key: 'doctor', header: 'Médico, procedimiento y acceso', priority: 1, cell: this.doctorCell() },
  ]);
  protected readonly rowId = (row: RoleAssignmentRow): string => row.id;
  protected readonly rowLabel = (row: RoleAssignmentRow): string => `${row.practitionerName} · ${this.serviceText(row)}`;

  ngOnInit(): void {
    this.catalog.listPractices().subscribe({
      next: (list) => {
        this.practices.set(list);
        if (list.length === 0) {
          this.rows.set(empty({ label: 'Registre una práctica para sumar médicos' }, 'Su organización todavía no tiene prácticas.'));
          return;
        }
        this.selectPractice(list[0]!.id);
      },
      error: (failure: unknown) => this.rows.set(errorToViewState<readonly RoleAssignmentRow[]>(failure)),
    });
  }

  protected selectPractice(id: string | null): void {
    if (id === null) return;
    this.practiceId.set(id);
    this.reload();
  }

  protected reload(): void {
    const practiceId = this.practiceId();
    if (practiceId === null) return;
    this.confirmingId.set(null);
    this.rows.set(loading());
    this.assignments.listForPractice(practiceId).subscribe({
      next: (list) => {
        const working = list.filter((row) => ['ACTIVE', 'SUSPENDED'].includes(roleAssignmentState(row.statusCode) ?? ''));
        this.rows.set(
          working.length > 0
            ? ready(working)
            : empty({ label: 'Apruebe solicitudes en «Médicos del centro»' }, 'Todavía no hay médicos con acceso a esta práctica.'),
        );
      },
      error: (failure: unknown) => this.rows.set(errorToViewState<readonly RoleAssignmentRow[]>(failure)),
    });
  }

  protected serviceText(row: RoleAssignmentRow): string {
    return row.serviceDisplay ?? 'sin servicio asignado';
  }

  protected statusText(row: RoleAssignmentRow): string {
    return roleAssignmentStatusText(row.statusCode);
  }

  protected statusTone(row: RoleAssignmentRow): 'success' | 'warning' | 'error' | 'info' {
    return roleAssignmentStatusTone(row.statusCode);
  }

  protected canSuspend(row: RoleAssignmentRow): boolean {
    return roleAssignmentState(row.statusCode) === 'ACTIVE';
  }

  protected suspend(row: RoleAssignmentRow): void {
    this.act(row, 'suspend', 'Suspendió el acceso del médico.');
  }

  protected end(row: RoleAssignmentRow): void {
    this.act(row, 'end', 'Terminó el acceso del médico.');
  }

  private act(row: RoleAssignmentRow, action: Action, done: string): void {
    if (this.busyRowId() !== null) return;
    this.busyRowId.set(row.id);
    this.assignments[action](row.id).subscribe({
      next: () => {
        this.busyRowId.set(null);
        this.toasts.success(done);
        this.reload();
      },
      error: (failure: unknown) => {
        this.busyRowId.set(null);
        const state = errorToViewState<unknown>(failure);
        this.toasts.error('message' in state && typeof state.message === 'string' ? state.message : 'No pudimos completar la acción.');
        this.reload();
      },
    });
  }
}
