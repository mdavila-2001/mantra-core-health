import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  SupersedeMode,
  VersionSuperseded,
} from '../../../core/data-access/health-context/health-context.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const MODOS: readonly SupersedeMode[] = ['SUPERSEDED', 'EXPIRED'];

/**
 * Retirar una versión publicada (V44-05·A,
 * `POST /health-context/versions/:id/supersede`).
 *
 * Los dos modos no son variantes de lo mismo:
 *
 * - **`SUPERSEDED`** exige quién la reemplaza y el contexto **sigue activo**.
 * - **`EXPIRED`** no tiene reemplazo y el contexto queda **obsoleto**: la
 *   resolución para consumo empieza a marcar `stale`. Marcarlo activo cuando ya
 *   no entrega nada engañaría al consumidor, y por eso el backend no lo hace.
 *
 * La obligatoriedad del reemplazo es condicional al modo, y **se valida acá
 * además de en el backend**: dejar que viaje sin reemplazo para recibir el 422
 * sería usar la red como validador de formulario.
 */
@Component({
  selector: 'app-version-supersede',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    Textarea,
  ],
  templateUrl: './version-supersede.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionSupersede {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    versionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    replacementVersionId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** Obligatorio: sin modo no hay retiro. */
  protected readonly mode = signal<SupersedeMode | null>(null);

  /** Motivo obligatorio por contrato: un retiro sin por qué no se puede auditar. */
  protected readonly reason = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly superseded = signal<VersionSuperseded | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para retirar versiones.'),
  );

  /** El reemplazo solo existe —y solo se exige— en el modo con reemplazo. */
  protected readonly exigeReemplazo = computed(() => this.mode() === 'SUPERSEDED');

  protected elegirModo(valor: unknown): void {
    this.mode.set(opcionDe(MODOS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const modo = this.mode();
    const motivo = this.reason().trim();
    const reemplazo = this.form.getRawValue().replacementVersionId.trim();

    const faltaReemplazo = modo === 'SUPERSEDED' && reemplazo === '';
    if (this.form.invalid || modo === null || motivo === '' || faltaReemplazo) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client
      .supersedeVersion(this.form.getRawValue().versionId.trim(), {
        mode: modo,
        reason: motivo,
        ...(modo === 'SUPERSEDED' ? { replacementVersionId: reemplazo } : {}),
      })
      .subscribe({
        next: (resultado) => {
          this.state.set(ready(null));
          this.superseded.set(resultado);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otroRetiro(): void {
    this.form.reset();
    this.mode.set(null);
    this.reason.set('');
    this.superseded.set(null);
    this.state.set(ready(null));
  }
}
