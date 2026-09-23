import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import type {
  DuplicateStudyCheckResult,
  PreviousStudy,
} from '../../../../../core/data-access/diagnostics/diagnostics.types';
import { AnnounceOnAppear } from '../../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../../../shared/components/atoms/checkbox/checkbox';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';

/** Debajo de esto, «justificación clínica» es una frase sin contenido real. */
const MIN_JUSTIFICATION_LENGTH = 20;

/**
 * El diálogo que decide qué hacer con un estudio posiblemente repetido
 * (antiduplicación de estudios · T-26, subtarea 3.2).
 *
 * Se monta cuando `POST /clinical/service-requests/duplicate-check` responde
 * `isDuplicate: true`: informa el estudio previo (fecha, prestador, si tiene
 * resultados y, sólo si es de la misma organización, la conclusión) y ofrece
 * dos caminos, nunca los dos a la vez — {@link reused} registra el pedido
 * nuevo como satisfecho por ese informe (no se llega a crear una orden
 * facturable); {@link justified} lo deja repetir con una justificación de al
 * menos {@link MIN_JUSTIFICATION_LENGTH} caracteres, que viaja a la
 * aseguradora en el detalle del reclamo. Sin resultados liberados
 * (`resultsAvailable: false`) no hay nada que reutilizar, así que ese botón
 * no se ofrece.
 *
 * Es un componente de la `feature`, no una molécula compartida: hoy tiene un
 * solo consumidor (`DiagnosticsBlock`).
 */
@Component({
  selector: 'app-duplicate-study-warning-dialog',
  imports: [DatePipe, AnnounceOnAppear, AppButton, Badge, Checkbox, Textarea, Alert, FormField, ContentDialog],
  // `imports` sólo habilita la sintaxis `| date` en la plantilla; `inject(DatePipe)`
  // en el constructor necesita el proveedor explícito, o el `NullInjector` lo rechaza
  // (NG0201) — la bajada del encabezado la arma esta clase, no la plantilla.
  providers: [DatePipe],
  templateUrl: './duplicate-study-warning-dialog.html',
  styleUrl: './duplicate-study-warning-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateStudyWarningDialog {
  /** El resultado del chequeo; se asume `isDuplicate: true` (quien lo monta ya filtró). */
  readonly check = input.required<DuplicateStudyCheckResult>();

  /** Mientras el alta está en vuelo: deshabilita los tres botones y el cierre por fondo/Escape. */
  readonly sending = input(false);

  /** Reutilizar: la orden nueva nace satisfecha por el informe previo, sin justificación. */
  readonly reused = output<void>();

  /** Repetir con justificación clínica (ya validada: ≥20 caracteres). */
  readonly justified = output<string>();

  /** Se cerró sin decidir (Cancelar, fondo o Escape). */
  readonly closed = output<void>();

  private readonly datePipe = inject(DatePipe);

  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly previousStudy = computed<PreviousStudy | null>(() => this.check().previousStudy ?? null);

  protected readonly repeatRequested = signal(false);
  protected readonly reason = signal('');
  protected readonly reasonTouched = signal(false);

  protected readonly heading = computed(() => {
    const study = this.previousStudy();
    return study ? `Ya hay un ${study.studyName} reciente` : 'Estudio posiblemente duplicado';
  });

  protected readonly description = computed(() => {
    const study = this.previousStudy();
    if (!study) return null;
    const fecha = this.datePipe.transform(study.performedAt, 'd MMM y') ?? '';
    const dias = study.daysAgo === 1 ? 'día' : 'días';
    return `${study.providerName} lo informó el ${fecha} (hace ${study.daysAgo} ${dias}).`;
  });

  protected readonly reasonLength = computed(() => this.reason().trim().length);

  protected readonly counterHint = computed(
    () => `${this.reasonLength()}/${MIN_JUSTIFICATION_LENGTH} caracteres mínimos`,
  );

  protected readonly reasonErrorMessage = computed(() =>
    this.reasonTouched() && this.reasonLength() < MIN_JUSTIFICATION_LENGTH
      ? 'La justificación necesita al menos 20 caracteres para que la aseguradora la pueda leer.'
      : '',
  );

  protected readonly canConfirmRepeat = computed(
    () => this.repeatRequested() && this.reasonLength() >= MIN_JUSTIFICATION_LENGTH && !this.sending(),
  );

  protected toggleRepeat(checked: boolean): void {
    this.repeatRequested.set(checked);
    if (!checked) {
      this.reasonTouched.set(false);
    }
  }

  protected touchReason(): void {
    this.reasonTouched.set(true);
  }

  protected confirmReuse(): void {
    if (this.sending()) return;
    this.reused.emit();
  }

  protected confirmRepeat(): void {
    this.reasonTouched.set(true);
    if (!this.canConfirmRepeat()) return;
    this.justified.emit(this.reason().trim());
  }

  protected cancel(): void {
    this.dialog().close();
  }
}
