import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';

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
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePicker,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
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
  });

  /** Obligatoria por contrato; arranca sin elegir para no decidir por nadie. */
  protected readonly decision = signal<AccessRequestDecision | null>(null);

  protected readonly purpose = signal<PurposeOfUse | null>(null);
  protected readonly resourceType = signal<GrantResourceType | null>(null);
  protected readonly validTo = signal<Date | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly resolved = signal<AccessRequestDecisionResult | null>(null);

  protected readonly esAprobacion = computed(() => this.decision() === 'APPROVED');

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para resolver solicitudes de acceso.'),
  );

  protected elegirDecision(valor: unknown): void {
    this.decision.set(opcionDe(DECISIONS, valor));
  }

  protected elegirProposito(valor: unknown): void {
    this.purpose.set(opcionDe(PURPOSES, valor));
  }

  protected elegirRecurso(valor: unknown): void {
    this.resourceType.set(opcionDe(RESOURCE_TYPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.decision() === null) {
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
    this.decision.set(null);
    this.purpose.set(null);
    this.resourceType.set(null);
    this.validTo.set(null);
    this.resolved.set(null);
    this.state.set(ready(null));
  }

  private datos(): Resolution | null {
    const decision = this.decision();
    if (decision === null) {
      return null;
    }

    if (decision === 'DENIED') {
      return { decision };
    }

    const { encounterId } = this.form.getRawValue();
    const encuentro = encounterId.trim();
    const proposito = this.purpose();
    const recurso = this.resourceType();
    const vencimiento = this.validTo();

    return {
      decision,
      ...(proposito === null ? {} : { purpose: proposito }),
      ...(recurso === null ? {} : { resourceType: recurso }),
      ...(vencimiento === null ? {} : { validTo: vencimiento.toISOString() }),
      ...(encuentro === '' ? {} : { encounterId: encuentro }),
    };
  }
}
