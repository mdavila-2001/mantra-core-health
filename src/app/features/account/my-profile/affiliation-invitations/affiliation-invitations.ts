import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { concatMap, from, tap } from 'rxjs';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import {
  roleAssignmentState,
  roleAssignmentStatusText,
  roleAssignmentStatusTone,
} from '../../../../core/data-access/role-assignments/role-assignment-status';
import { RoleAssignmentsClient } from '../../../../core/data-access/role-assignments/role-assignments.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { AffiliationRequestForm } from './affiliation-request-form/affiliation-request-form';

/** Una afiliación por procedimiento: las vinculaciones de siempre no traen `healthcareServiceId`. */
export function isProcedureAffiliation(row: MyRoleAssignment): boolean {
  return row.healthcareServiceId !== undefined && row.statusCode !== undefined;
}

/** Lo que un centro le pide o le ofrece al médico, agrupado por centro. */
interface CenterGroup {
  readonly practiceId: string;
  readonly practiceName: string;
  readonly rows: readonly MyRoleAssignment[];
}

function groupByCenter(rows: readonly MyRoleAssignment[]): readonly CenterGroup[] {
  const groups = new Map<string, MyRoleAssignment[]>();
  for (const row of rows) groups.set(row.practiceId, [...(groups.get(row.practiceId) ?? []), row]);
  return [...groups.values()].map((list) => ({ practiceId: list[0]!.practiceId, practiceName: list[0]!.practiceName, rows: list }));
}

/**
 * **Invitaciones y solicitudes** del médico a centros médicos (CM-07, HU-M1/M2).
 *
 * El médico acepta o rechaza lo que un centro le ofrece, y pide afiliarse con
 * los procedimientos que haría. Ninguna fila se pinta activa por su cuenta: se
 * muestra el estado que devolvió la API tras recargar. Aceptar y rechazar
 * existen solo sobre lo invitado por el centro; sobre una solicitud propia el
 * médico únicamente espera.
 */
@Component({
  selector: 'app-affiliation-invitations',
  imports: [AffiliationRequestForm, AppButton, Badge, Card, PageHeader, ViewStateHost],
  templateUrl: './affiliation-invitations.html',
  styleUrl: './affiliation-invitations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationInvitations implements OnInit {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly assignments = inject(RoleAssignmentsClient);
  private readonly toasts = inject(ToastService);

  protected readonly rows = signal<ViewState<readonly MyRoleAssignment[]>>(loading());
  private readonly loaded = signal<readonly MyRoleAssignment[]>([]);
  protected readonly requesting = signal(false);
  protected readonly busyRowId = signal<string | null>(null);
  protected readonly acceptingAll = signal(false);

  protected readonly invitations = computed(() =>
    groupByCenter(this.loaded().filter((row) => roleAssignmentState(row.statusCode ?? '') === 'INVITED')),
  );
  protected readonly invitedCount = computed(() => this.invitations().reduce((total, group) => total + group.rows.length, 0));
  protected readonly requests = computed(() =>
    groupByCenter(this.loaded().filter((row) => roleAssignmentState(row.statusCode ?? '') === 'PENDING')),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.rows.set(loading());
    this.practiceSites.listMyRoleAssignments().subscribe({
      next: (list) => {
        const mine = list.filter(isProcedureAffiliation);
        this.loaded.set(mine);
        this.rows.set(
          mine.length > 0
            ? ready(mine)
            : empty(
                { label: 'Use «Pedir afiliarme a un centro»' },
                'No tiene invitaciones ni solicitudes a centros médicos.',
              ),
        );
      },
      error: (failure: unknown) => this.rows.set(errorToViewState<readonly MyRoleAssignment[]>(failure)),
    });
  }

  protected statusText(row: MyRoleAssignment): string {
    return roleAssignmentStatusText(row.statusCode ?? '');
  }

  protected statusTone(row: MyRoleAssignment): 'success' | 'warning' | 'error' | 'info' {
    return roleAssignmentStatusTone(row.statusCode ?? '');
  }

  protected accept(row: MyRoleAssignment): void {
    this.act(row, this.assignments.accept(row.id), 'Aceptó la invitación.');
  }

  protected decline(row: MyRoleAssignment): void {
    this.act(row, this.assignments.decline(row.id), 'Rechazó la invitación.');
  }

  /** No hay aprobación en grupo en la API: son N llamadas, una por procedimiento, en orden. */
  protected acceptAll(): void {
    const pending = this.invitations().flatMap((group) => group.rows);
    if (pending.length === 0 || this.acceptingAll() || this.busyRowId() !== null) return;
    this.acceptingAll.set(true);
    let accepted = 0;
    from(pending)
      .pipe(concatMap((row) => this.assignments.accept(row.id).pipe(tap(() => accepted++))))
      .subscribe({
        complete: () => this.finishAll(accepted, pending.length),
        error: () => this.finishAll(accepted, pending.length),
      });
  }

  protected onRequested(count: number): void {
    this.requesting.set(false);
    this.toasts.success(
      count === 1 ? 'Pidió afiliarse por 1 procedimiento.' : `Pidió afiliarse por ${count} procedimientos.`,
      'Falta que el centro apruebe',
    );
    this.reload();
  }

  private finishAll(accepted: number, total: number): void {
    this.acceptingAll.set(false);
    if (accepted === total) this.toasts.success(`Aceptó las ${total} invitaciones.`);
    else this.toasts.error(`Aceptó ${accepted} de ${total} invitaciones. Revise las que faltan.`);
    this.reload();
  }

  private act(row: MyRoleAssignment, request: ReturnType<RoleAssignmentsClient['accept']>, done: string): void {
    if (this.busyRowId() !== null || this.acceptingAll()) return;
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
