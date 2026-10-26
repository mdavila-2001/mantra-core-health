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

import { HealthcareServicesClient } from '../../../core/data-access/healthcare-services/healthcare-services.client';
import type { PracticeSiteOption } from '../../../core/data-access/healthcare-services/healthcare-services.types';
import {
  roleAssignmentInitiatorText,
  roleAssignmentState,
  roleAssignmentStatusText,
  roleAssignmentStatusTone,
} from '../../../core/data-access/role-assignments/role-assignment-status';
import { RoleAssignmentsClient } from '../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../core/data-access/role-assignments/role-assignments.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { Practice } from '../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PractitionerInviteForm } from './practitioner-invite-form/practitioner-invite-form';

/**
 * **Médicos del centro**: por práctica y por sede, qué médico hace qué
 * procedimiento, en qué estado y quién inició la afiliación (CM-07, HU-C3/C4).
 *
 * El centro invita (el médico tiene que aceptar) y aprueba o rechaza lo que el
 * médico pide. La pantalla nunca activa una fila por su cuenta: solo ofrece
 * «Aprobar» y «Rechazar» sobre lo que está pendiente del centro, y pinta el
 * estado que devuelve la API, recargando la lista después de cada acción.
 */
@Component({
  selector: 'app-practitioner-affiliations',
  imports: [Alert, AppButton, Badge, Card, DataTable, FormField, PageHeader, PractitionerInviteForm, Select],
  templateUrl: './practitioner-affiliations.html',
  styleUrl: './practitioner-affiliations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerAffiliations implements OnInit {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly services = inject(HealthcareServicesClient);
  private readonly assignments = inject(RoleAssignmentsClient);
  private readonly toasts = inject(ToastService);

  protected readonly practices = signal<readonly Practice[]>([]);
  protected readonly practiceId = signal<string | null>(null);
  protected readonly sites = signal<readonly PracticeSiteOption[]>([]);
  protected readonly siteId = signal<string | null>(null);
  protected readonly rows = signal<ViewState<readonly RoleAssignmentRow[]>>(loading());
  protected readonly inviting = signal(false);
  /** La fila sobre la que hay una acción en vuelo: una por vez. */
  protected readonly busyRowId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    this.practices().map((practice) => ({ value: practice.id, label: practice.name })),
  );
  protected readonly siteOptions = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((site) => ({ value: site.id, label: site.name })),
  );

  /** Solo las filas de la sede elegida. */
  protected readonly siteRows = computed<ViewState<readonly RoleAssignmentRow[]>>(() => {
    const state = this.rows();
    const siteId = this.siteId();
    const all = dataOf(state);
    if (all === null || siteId === null) return state;
    const mine = all.filter((row) => row.practiceSiteId === siteId);
    return mine.length > 0
      ? ready(mine)
      : empty(
          { label: 'Use «Invitar a un médico» para sumar a alguien a esta sede' },
          'Esta sede todavía no tiene médicos afiliados.',
        );
  });

  private readonly practitionerCell = viewChild.required<TemplateRef<{ $implicit: RoleAssignmentRow }>>('practitionerCell');
  private readonly initiatorCell = viewChild.required<TemplateRef<{ $implicit: RoleAssignmentRow }>>('initiatorCell');

  protected readonly columns = computed<readonly ColumnDef<RoleAssignmentRow>[]>(() => [
    { key: 'practitioner', header: 'Médico, procedimiento y estado', priority: 1, cell: this.practitionerCell() },
    { key: 'initiator', header: 'Iniciada por', priority: 3, cell: this.initiatorCell() },
  ]);

  protected readonly rowId = (row: RoleAssignmentRow): string => row.id;
  protected readonly rowLabel = (row: RoleAssignmentRow): string => `${row.practitionerName} · ${row.serviceDisplay ?? ''}`;

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
    this.inviting.set(false);
    this.siteId.set(null);
    this.sites.set([]);
    this.loadError.set(null);
    this.services.listSites(id).subscribe({
      next: (list) => {
        this.sites.set(list);
        this.siteId.set(list[0]?.id ?? null);
      },
      error: () => this.loadError.set('No pudimos cargar las sedes de la práctica.'),
    });
    this.reload();
  }

  protected selectSite(id: string | null): void {
    this.siteId.set(id);
    this.inviting.set(false);
  }

  protected reload(): void {
    const practiceId = this.practiceId();
    if (practiceId === null) return;
    this.rows.set(loading());
    this.assignments.listForPractice(practiceId).subscribe({
      next: (list) =>
        this.rows.set(
          list.length > 0
            ? ready(list)
            : empty({ label: 'Use «Invitar a un médico»' }, 'Todavía no hay médicos afiliados a esta práctica.'),
        ),
      error: (failure: unknown) => this.rows.set(errorToViewState<readonly RoleAssignmentRow[]>(failure)),
    });
  }

  protected onInvited(invited: readonly RoleAssignmentRow[]): void {
    this.inviting.set(false);
    this.toasts.success(
      invited.length === 1 ? 'Invitación enviada.' : `Invitación enviada por ${invited.length} procedimientos.`,
      'Falta que el médico acepte',
    );
    this.reload();
  }

  protected statusText(row: RoleAssignmentRow): string {
    return roleAssignmentStatusText(row.statusCode);
  }

  protected statusTone(row: RoleAssignmentRow): 'success' | 'warning' | 'error' | 'info' {
    return roleAssignmentStatusTone(row.statusCode);
  }

  protected initiatorText(row: RoleAssignmentRow): string {
    return roleAssignmentInitiatorText(row.initiatedBy);
  }

  /** Aprobar y rechazar existen solo sobre lo que espera al centro. */
  protected awaitsPractice(row: RoleAssignmentRow): boolean {
    return roleAssignmentState(row.statusCode) === 'PENDING';
  }

  protected approve(row: RoleAssignmentRow): void {
    this.act(row, this.assignments.approve(row.id), 'Aprobó la afiliación.');
  }

  protected reject(row: RoleAssignmentRow): void {
    this.act(row, this.assignments.reject(row.id), 'Rechazó la solicitud.');
  }

  private act(row: RoleAssignmentRow, request: ReturnType<RoleAssignmentsClient['approve']>, done: string): void {
    if (this.busyRowId() !== null) return;
    this.busyRowId.set(row.id);
    request.subscribe({
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
