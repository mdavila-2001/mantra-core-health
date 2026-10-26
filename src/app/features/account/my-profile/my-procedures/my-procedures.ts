import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import type { PracticeSiteOption } from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import {
  roleAssignmentInitiatorText,
  roleAssignmentStatusText,
  roleAssignmentStatusTone,
} from '../../../../core/data-access/role-assignments/role-assignment-status';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { isProcedureAffiliation } from '../affiliation-invitations/affiliation-invitations';
import { AffiliationRequestForm } from '../affiliation-invitations/affiliation-request-form/affiliation-request-form';

/** Los procedimientos que el médico hace en una sede. */
interface SiteGroup {
  readonly siteId: string;
  readonly siteName: string;
  readonly rows: readonly MyRoleAssignment[];
}

/** Una de las fichas: un centro con sus sedes. */
interface CenterGroup {
  readonly practiceId: string;
  readonly practiceName: string;
  readonly sites: readonly SiteGroup[];
}

function group(rows: readonly MyRoleAssignment[], siteNames: ReadonlyMap<string, string>): readonly CenterGroup[] {
  const centers = new Map<string, { name: string; sites: Map<string, MyRoleAssignment[]> }>();
  for (const row of rows) {
    const center = centers.get(row.practiceId) ?? { name: row.practiceName, sites: new Map<string, MyRoleAssignment[]>() };
    const siteId = row.practiceSiteId ?? '';
    center.sites.set(siteId, [...(center.sites.get(siteId) ?? []), row]);
    centers.set(row.practiceId, center);
  }
  return [...centers.entries()].map(([practiceId, center]) => ({
    practiceId,
    practiceName: center.name,
    sites: [...center.sites.entries()].map(([siteId, siteRows]) => ({
      siteId,
      siteName: siteNames.get(siteId) ?? 'Sede',
      rows: siteRows,
    })),
  }));
}

/**
 * **Procedimientos que hago**: por centro y por sede, cada procedimiento con su
 * estado (CM-07, HU-M3).
 *
 * Agregar uno nuevo no lo activa: crea una solicitud pendiente del centro, y
 * recién cuando el centro aprueba pasa a «Activa» (A-7). Lo que se pinta es
 * siempre lo que devolvió la API al recargar.
 */
@Component({
  selector: 'app-my-procedures',
  imports: [AffiliationRequestForm, AppButton, Badge, Card, PageHeader, ViewStateHost],
  templateUrl: './my-procedures.html',
  styleUrl: './my-procedures.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProcedures implements OnInit {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly services = inject(HealthcareServicesClient);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<readonly CenterGroup[]>>(loading());
  protected readonly centers = signal<readonly CenterGroup[]>([]);
  protected readonly adding = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.state.set(loading());
    this.practiceSites.listMyRoleAssignments().subscribe({
      next: (list) => this.withSiteNames(list.filter(isProcedureAffiliation)),
      error: (failure: unknown) => this.state.set(errorToViewState<readonly CenterGroup[]>(failure)),
    });
  }

  protected statusText(row: MyRoleAssignment): string {
    return roleAssignmentStatusText(row.statusCode ?? '');
  }

  protected statusTone(row: MyRoleAssignment): 'success' | 'warning' | 'error' | 'info' {
    return roleAssignmentStatusTone(row.statusCode ?? '');
  }

  protected initiatorText(row: MyRoleAssignment): string {
    return row.initiatedBy === undefined ? '' : roleAssignmentInitiatorText(row.initiatedBy);
  }

  protected onRequested(count: number): void {
    this.adding.set(false);
    this.toasts.success(
      count === 1 ? 'Pidió sumar 1 procedimiento.' : `Pidió sumar ${count} procedimientos.`,
      'Falta que el centro apruebe',
    );
    this.reload();
  }

  /** Las sedes se nombran con una consulta por centro; si una falla, queda «Sede» y la lista sigue. */
  private withSiteNames(rows: readonly MyRoleAssignment[]): void {
    const practiceIds = [...new Set(rows.map((row) => row.practiceId))];
    const finish = (siteLists: readonly (readonly PracticeSiteOption[])[]): void => {
      const names = new Map(siteLists.flat().map((site) => [site.id, site.name] as const));
      const centers = group(rows, names);
      this.centers.set(centers);
      this.state.set(
        centers.length > 0
          ? ready(centers)
          : empty({ label: 'Use «Agregar un procedimiento»' }, 'Todavía no hace procedimientos en ningún centro.'),
      );
    };
    if (practiceIds.length === 0) {
      finish([]);
      return;
    }
    forkJoin(practiceIds.map((id) => this.services.listSites(id).pipe(catchError(() => of([] as readonly PracticeSiteOption[]))))).subscribe(finish);
  }
}
