import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  AccessRequestDecision,
  AccessRequestDecisionResult,
  AccessRequestResolution as Resolution,
  GrantResourceType,
  PurposeOfUse,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const DECISIONS: readonly AccessRequestDecision[] = ['APPROVED', 'DENIED'];
const PURPOSES: readonly PurposeOfUse[] = ['TREATMENT', 'BILLING', 'OPERATIONS'];
const RESOURCE_TYPES: readonly GrantResourceType[] = [
  'CLINICAL_NOTE',
  'APPOINTMENT',
  'PRESCRIPTION',
];

/**
 * Resolver una solicitud de acceso delegado (V29-05,
 * `POST /access-requests/:id/decision`).
 *
 * La decisión es lo único obligatorio. Los campos de alcance acotan el grant
 * que se emite **al aprobar**; con una denegación no hay grant, así que no
 * viajan aunque estén cargados.
 */
@Component({
  selector: 'app-access-request-resolution',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './access-request-resolution.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestResolution {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    requestId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    encounterId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    /** Obligatoria por contrato; arranca sin elegir para no decidir por nadie. */
    decision: new FormControl<AccessRequestDecision | null>(null, {
      validators: [Validators.required],
    }),
    purpose: new FormControl<PurposeOfUse | null>(null),
    resourceType: new FormControl<GrantResourceType | null>(null),
    validTo: new FormControl<Date | null>(null),
  });

  /** La decisión, como señal, para que las páginas reaccionen a ella. */
  private readonly decidido = toSignal(this.form.controls.decision.valueChanges, {
    initialValue: this.form.controls.decision.value,
  });

  /**
   * Las páginas, que **dependen de la decisión**.
   *
   * Denegar no emite grant, así que su alcance no se pregunta: mostrarlo
   * deshabilitado o vacío sería ofrecer datos que no se van a usar.
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'Qué solicitud',
        hint: 'La solicitud de acceso pendiente que se va a resolver.',
        campos: [
          {
            key: 'requestId',
            label: 'Identificador de la solicitud',
            hint: UUID_HINT,
            control: 'text' as const,
            required: true,
            mensajeDeError: UUID_ERROR,
          },
        ],
      },
      {
        titulo: 'Decisión',
        hint: 'Queda registrada en la auditoría del módulo.',
        campos: [
          {
            key: 'decision',
            label: 'Decisión del aprobador',
            control: 'radio' as const,
            required: true,
            options: [
              { value: 'APPROVED', label: 'Aprobar' },
              { value: 'DENIED', label: 'Denegar' },
            ],
          },
        ],
      },
      ...(this.esAprobacion()
        ? [
            {
              titulo: 'Alcance del grant emitido',
              hint: 'Opcional: acota la concesión que nace de esta aprobación.',
              campos: [
                {
                  key: 'purpose',
                  label: 'Propósito de uso',
                  control: 'radio' as const,
                  options: [
                    { value: 'TREATMENT', label: 'Tratamiento' },
                    { value: 'BILLING', label: 'Facturación' },
                    { value: 'OPERATIONS', label: 'Operaciones' },
                  ],
                },
                {
                  key: 'resourceType',
                  label: 'Tipo de recurso',
                  control: 'radio' as const,
                  options: [
                    { value: 'CLINICAL_NOTE', label: 'Nota clínica' },
                    { value: 'APPOINTMENT', label: 'Cita' },
                    { value: 'PRESCRIPTION', label: 'Receta' },
                  ],
                },
                {
                  key: 'validTo',
                  label: 'Fin de vigencia del grant',
                  hint: 'Sin fecha, decide el backend.',
                  control: 'datetime' as const,
                },
                {
                  key: 'encounterId',
                  label: 'Encuentro del grant',
                  hint: UUID_HINT,
                  control: 'text' as const,
                  mensajeDeError: UUID_ERROR,
                },
              ],
            },
          ]
        : []),
    ]),
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly resolved = signal<AccessRequestDecisionResult | null>(null);

  protected readonly esAprobacion = computed(() => this.decidido() === 'APPROVED');

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para resolver solicitudes de acceso.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { requestId } = this.form.getRawValue();
    const datos = this.datos();
    if (datos === null) {
      return;
    }

    this.state.set(loading());

    this.client.resolveAccessRequest(requestId.trim(), datos).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.resolved.set(resultado);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraSolicitud(): void {
    this.form.reset();
    this.resolved.set(null);
    this.state.set(ready(null));
  }

  private datos(): Resolution | null {
    const valores = this.form.getRawValue();
    const decision = opcionDe(DECISIONS, valores.decision);
    if (decision === null) {
      return null;
    }

    // Denegar no emite grant: su alcance ni se lee, aunque hubiera quedado algo
    // escrito de un intento anterior.
    if (decision === 'DENIED') {
      return { decision };
    }

    const encuentro = valores.encounterId.trim();
    const proposito = opcionDe(PURPOSES, valores.purpose);
    const recurso = opcionDe(RESOURCE_TYPES, valores.resourceType);
    const vencimiento = valores.validTo;

    return {
      decision,
      ...(proposito === null ? {} : { purpose: proposito }),
      ...(recurso === null ? {} : { resourceType: recurso }),
      ...(vencimiento === null ? {} : { validTo: vencimiento.toISOString() }),
      ...(encuentro === '' ? {} : { encounterId: encuentro }),
    };
  }
}
