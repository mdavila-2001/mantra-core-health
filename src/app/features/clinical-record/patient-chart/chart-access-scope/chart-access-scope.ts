import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { AuthzClient } from '../../../../core/data-access/authz/authz.client';
import { PRACTITIONER_INBOX_ROLES, type AccessRequestItem } from '../../../../core/data-access/authz/authz.types';
import { MedicalSpecialtiesCatalog } from '../../../../core/data-access/terminology/medical-specialties.service';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/** What the inbox says about this patient: the active granular rows, or that it could not be read. */
type Scope = { readonly status: 'read'; readonly rows: readonly AccessRequestItem[] } | { readonly status: 'failed' };

/**
 * **The scope of the practitioner's access** to this chart, next to the
 * truncation notice. The API does not send it with the chart yet, so it is
 * derived from the practitioner's inbox: an ACTIVE granular request for this
 * patient means the access is by specialty. Without one (or with an active
 * primary practitioner relationship, which reads the whole record) it draws
 * nothing. What the chart actually shows is still the API's decision.
 */
@Component({
  selector: 'app-chart-access-scope',
  imports: [Alert],
  template: `
    @if (scope().status === 'failed') {
      <app-alert tone="warning" data-testid="chart-access-scope-unknown">
        No pudimos confirmar el alcance de su acceso a esta historia.
      </app-alert>
    } @else if (granted().length > 0) {
      <app-alert tone="info" title="Acceso por especialidad" data-testid="chart-access-scope">
        El paciente le autorizó: {{ names() }}.
      </app-alert>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartAccessScope {
  private readonly authz = inject(AuthzClient);
  private readonly catalog = inject(MedicalSpecialtiesCatalog);
  private readonly roles = inject(AuthService).roles;

  readonly patientProfileId = input.required<string>();

  protected readonly scope = toSignal(
    toObservable(this.patientProfileId).pipe(
      switchMap((patientProfileId) =>
        patientProfileId === '' || !this.roles().some((role) => PRACTITIONER_INBOX_ROLES.includes(role))
          ? of<Scope>({ status: 'read', rows: [] })
          : this.authz.listPractitionerAccessRequests().pipe(
              map((items): Scope => ({ status: 'read', rows: items.filter((i) => i.counterpart.profileId === patientProfileId) })),
              catchError(() => of<Scope>({ status: 'failed' })),
            ),
      ),
    ),
    { initialValue: { status: 'read', rows: [] } as Scope },
  );

  /** The authorized specialties, unless a primary practitioner relationship opens the whole record. */
  protected readonly granted = computed(() => {
    const scope = this.scope();
    if (scope.status === 'failed') return [];
    const active = scope.rows.filter((row) => row.status === 'ACTIVE');
    if (active.some((row) => row.kind === 'CABECERA')) return [];
    return [...new Set(active.filter((row) => row.kind === 'GRANULAR').flatMap((row) => row.authorizedSpecialtyConceptIds))];
  });

  /** The catalog is read only when there is something to name. */
  private readonly specialtyNames = toSignal(
    toObservable(this.granted).pipe(
      switchMap((ids) =>
        ids.length === 0
          ? of(new Map<string, string>())
          : this.catalog.listar().pipe(
              map((options) => new Map(options.map((o) => [o.conceptId, o.display]))),
              // The names are a nicety here: without them the notice still tells the scope.
              catchError(() => of(new Map<string, string>())),
            ),
      ),
    ),
    { initialValue: new Map<string, string>() },
  );

  protected readonly names = computed(() => {
    const names = this.specialtyNames();
    const known = this.granted().map((id) => names.get(id)).filter((name) => name !== undefined);
    // Never an id on screen: without the catalog it says what it is, not which.
    return known.length === this.granted().length ? known.join(', ') : 'las especialidades que figuran en su buzón';
  });
}
