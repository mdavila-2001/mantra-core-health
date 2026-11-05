import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import { PractitionerAccessClient } from '../../../core/data-access/consent/practitioner-access.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { describeApiFailure } from '../../../core/http/api-failure';
import { readApiError } from '../../../core/http/api-error';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { CheckboxGroup } from '../../../shared/components/molecules/checkbox-group/checkbox-group';
import type { OpcionDeCasilla } from '../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record.routes';

/** Which duplicate the API reported when it answered 409. */
type ConflictoDeVinculo = 'activo' | 'pendiente' | 'desconocido';

/** What is asked: to be the primary practitioner, or to read some specialties. None until chosen. */
type RequestScope = 'CABECERA' | 'GRANULAR' | '';

const SCOPES: readonly SegmentedOption<RequestScope>[] = [
  { value: 'CABECERA', label: 'Médico de cabecera' },
  { value: 'GRANULAR', label: 'Por especialidad' },
];

/** Maps the API `reason` of a 409 to the duplicate it names. */
function conflictoDe(reason: string | undefined): ConflictoDeVinculo {
  if (reason === 'CARE_RELATIONSHIP_ALREADY_ACTIVE') return 'activo';
  if (reason === 'CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING') return 'pendiente';
  return 'desconocido';
}

/**
 * **Solicitar vinculación** (FT-07-R05) — el paso que faltaba entre encontrar
 * a alguien en `/medical-records` y poder leer su expediente sin un turno
 * confirmado el mismo día.
 *
 * No concede nada: crea la solicitud y el paciente decide en su buzón. Two
 * kinds: primary practitioner (`POST /authz/care-relationships/request` with
 * `PRIMARY`) or some specialties (`POST /consent/practitioner-access-requests`),
 * where the practitioner names what he asks and the patient may grant less.
 */
@Component({
  selector: 'app-request-access',
  imports: [Alert, AppButton, Card, CheckboxGroup, FormField, PageHeader, SegmentedControl, Textarea],
  templateUrl: './request-access.html',
  styleUrl: './request-access.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestAccess {
  private readonly authz = inject(AuthzClient);
  private readonly granular = inject(PractitionerAccessClient);
  private readonly specialties = inject(MedicalSpecialtiesCatalog);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  protected readonly nombrePaciente = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly scopes = SCOPES;
  protected readonly scope = signal<RequestScope>('');
  protected readonly specialtyOptions = signal<readonly OpcionDeCasilla[]>([]);
  protected readonly chosenSpecialties = signal<readonly string[]>([]);
  protected readonly specialtiesError = signal<string | null>(null);

  /**
   * What the 409 said. The API tells the two duplicates apart by `reason`
   * (`CARE_RELATIONSHIP_ALREADY_ACTIVE` / `CARE_RELATIONSHIP_REQUEST_ALREADY_PENDING`);
   * `desconocido` is the fallback when no `reason` comes back (older API). It is
   * not a failure: the request already exists, so it is told as a state.
   */
  protected readonly conflicto = signal<ConflictoDeVinculo | null>(null);

  /** Sin organización activa no hay a nombre de quién pedir: el contrato exige `tenantId`. */
  protected readonly sinOrganizacion = computed(() => this.auth.activeTenantId() === null);

  protected readonly puedeEnviar = computed(
    () =>
      this.profileId() !== '' &&
      !this.sinOrganizacion() &&
      !this.enviando() &&
      this.scope() !== '' &&
      (this.scope() !== 'GRANULAR' || this.chosenSpecialties().length > 0),
  );

  constructor() {
    const id = this.profileId();
    if (id !== '') {
      this.profiles.getPatient(id).subscribe({
        next: (paciente) => this.nombrePaciente.set(paciente.displayName ?? null),
        error: () => this.nombrePaciente.set(null),
      });
    }
    this.loadSpecialties();
  }

  protected loadSpecialties(): void {
    this.specialtiesError.set(null);
    this.specialties.listar().subscribe({
      next: (options) => this.specialtyOptions.set(options.map((o) => ({ value: o.conceptId, label: o.display }))),
      error: (error: unknown) => {
        this.specialties.olvidar();
        this.specialtiesError.set(describeApiFailure(error, 'No pudimos traer la lista de especialidades.'));
      },
    });
  }

  protected enviar(): void {
    const patientProfileId = this.profileId();
    const tenantId = this.auth.activeTenantId();
    const scope = this.scope();
    if (patientProfileId === '' || tenantId === null || scope === '') return;

    const motivo = this.motivo().trim();
    const reason = motivo === '' ? {} : { reasonText: motivo };
    const request: Observable<unknown> =
      scope === 'CABECERA'
        ? this.authz.requestCareRelationship({ tenantId, patientProfileId, relationshipType: 'PRIMARY', ...reason })
        : this.granular.requestAccess({ patientProfileId, specialtyConceptIds: this.chosenSpecialties(), ...reason });
    this.enviando.set(true);
    this.error.set(null);
    this.conflicto.set(null);
    request.subscribe({
      next: () => {
        this.toasts.success(
          scope === 'CABECERA'
            ? 'Solicitud enviada. El paciente va a decidir si acepta que usted sea su médico de cabecera.'
            : 'Solicitud enviada. El paciente va a decidir qué especialidades le autoriza.',
        );
        void this.router.navigate([CLINICAL_RECORD_ROUTE]);
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        // Branch by `code`/`reason`, not by message or status alone: status is
        // enough for 403/409 (no ambiguity), `code` settles 412/422.
        const cuerpo = err instanceof HttpErrorResponse ? readApiError(err) : null;
        const code = cuerpo?.code ?? null;
        const http = err instanceof HttpErrorResponse ? err.status : 0;
        if (http === 403) {
          this.error.set('No tiene permiso para pedir este vínculo.');
        } else if (http === 409) {
          this.conflicto.set(conflictoDe(cuerpo?.reason));
        } else if (code === 'PRECONDITION_FAILED') {
          this.error.set('Su cuenta no tiene un perfil profesional propio para pedir el vínculo.');
        } else {
          this.error.set('No se pudo enviar la solicitud. Pruebe de nuevo en un momento.');
        }
      },
    });
  }
}
