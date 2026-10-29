import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  REASON_CODES,
  REASON_CODE_LABELS,
  SOURCE_TYPE_CODES,
  SOURCE_TYPE_LABELS,
  type ReasonCode,
  type SourceTypeCode,
} from '@core/data-access/admissions/admissions.types';
import {
  ADMISSION_NOTE_MAX,
  ADMISSION_REASON_MAX,
  noteError,
  reasonCodeError,
  reasonError,
  sourceError,
  todayIso,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { Textarea } from '@shared/components/atoms/textarea/textarea';
import { Alert } from '@shared/components/molecules/alert/alert';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que la persona escribió al confirmar. */
export interface ReviewDialogResult {
  readonly sourceType?: SourceTypeCode;
  readonly sourceRef?: string;
  readonly sourceConsultedAt?: string;
  readonly reasonCode?: ReasonCode;
  readonly reason?: string;
  readonly internalNote?: string;
  readonly assigneeId?: string;
}

/** Qué pide el diálogo. Cada bloque presente se valida y se emite. */
export interface ReviewDialogConfig {
  readonly heading: string;
  readonly description?: string;
  readonly confirmLabel: string;
  /** Rechazar, suspender: el botón va en tono de error. */
  readonly destructive?: boolean;
  /** Aviso fijo sobre lo que implica (p. ej. «no se puede deshacer»). */
  readonly warning?: string;
  /** Un resumen de lo que se va a decidir, antes de confirmar. */
  readonly summary?: readonly string[];
  /** Pide la fuente consultada: tipo, referencia opcional y fecha de consulta. */
  readonly source?: boolean;
  /** La fuente no es obligatoria (el requisito no la exige): se valida solo si se la escribió. */
  readonly sourceOptional?: boolean;
  /** Pide un motivo. `withCode` agrega la lista cerrada; `note` la nota interna. */
  readonly reason?: {
    readonly label: string;
    readonly hint?: string;
    readonly withCode: boolean;
    readonly note: boolean;
  };
  /** Pide a quién reasignar, de una lista. */
  readonly assignees?: readonly { readonly id: string; readonly name: string }[];
  /**
   * Pide a quién reasignar por el id de su cuenta. La API no ofrece una lista
   * de revisores: quien aprueba pega el id de la cuenta que recibe la revisión.
   */
  readonly assigneeById?: boolean;
}

/**
 * El formulario de cualquier decisión de la revisión: verificar un requisito
 * (fuente), rechazarlo o pedir información (motivo), la decisión final, la
 * suspensión, la reasignación. Una sola pieza para que todas validen igual.
 *
 * No habla con la API: emite lo escrito y quien lo abre manda la petición.
 * `busy` mantiene el diálogo abierto y deshabilita «Confirmar» mientras viaja,
 * así un doble clic no manda dos veces. Si la API responde 409, el diálogo
 * **no se cierra ni pierde lo escrito**: muestra el aviso con «Ver cambios»
 * (`reload`) y se puede confirmar de nuevo sobre la versión nueva.
 */
@Component({
  selector: 'app-admission-review-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, Textarea],
  templateUrl: './admission-review-dialog.html',
  styleUrl: './admission-review-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionReviewDialog {
  readonly config = input.required<ReviewDialogConfig>();
  readonly busy = input(false);
  /** Error de la API a mostrar dentro del diálogo (p. ej. un 412). */
  readonly serverError = input<string | null>(null);
  /** La API dijo 409: se ofrece «Ver cambios». */
  readonly stale = input(false);

  readonly confirmed = output<ReviewDialogResult>();
  readonly cancelled = output<void>();
  readonly reload = output<void>();

  protected readonly reasonMax = ADMISSION_REASON_MAX;
  protected readonly noteMax = ADMISSION_NOTE_MAX;
  protected readonly sourceTypes = SOURCE_TYPE_CODES.map((code) => ({ code, label: SOURCE_TYPE_LABELS[code] }));
  protected readonly reasonCodes = REASON_CODES.map((code) => ({ code, label: REASON_CODE_LABELS[code] }));

  protected readonly sourceType = signal<SourceTypeCode | ''>('');
  protected readonly sourceRef = signal<string | number | null>('');
  protected readonly consultedAt = signal<string | number | null>(todayIso());
  protected readonly reasonCode = signal<ReasonCode | ''>('');
  protected readonly reason = signal('');
  protected readonly note = signal('');
  protected readonly assigneeId = signal('');
  protected readonly assigneeText = signal<string | number | null>('');
  protected readonly touched = signal(false);

  private readonly refText = computed(() => String(this.sourceRef() ?? ''));

  protected readonly sourceProblem = computed(() => {
    const config = this.config();
    if (config.source !== true) return null;
    // Sin tipo y sin referencia, una fuente opcional se deja en blanco.
    if (config.sourceOptional === true && this.sourceType() === '' && this.refText().trim() === '') return null;
    return sourceError(this.sourceType(), this.refText());
  });
  protected readonly dateProblem = computed(() => {
    if (this.config().source !== true) return null;
    if (this.config().sourceOptional === true && this.sourceType() === '') return null;
    const fecha = String(this.consultedAt() ?? '');
    if (fecha === '') return 'Indique la fecha de la consulta.';
    return fecha > todayIso() ? 'La fecha de la consulta no puede ser futura.' : null;
  });
  protected readonly codeProblem = computed(() => {
    const razon = this.config().reason;
    return razon?.withCode === true ? reasonCodeError(this.reasonCode()) : null;
  });
  protected readonly reasonProblem = computed(() =>
    this.config().reason === undefined ? null : reasonError(this.reason()),
  );
  protected readonly noteProblem = computed(() =>
    this.config().reason?.note === true ? noteError(this.note()) : null,
  );
  protected readonly assigneeProblem = computed(() => {
    const config = this.config();
    if (config.assignees !== undefined) return this.assigneeId() === '' ? 'Elija a quién reasignar.' : null;
    if (config.assigneeById === true) {
      const texto = String(this.assigneeText() ?? '').trim();
      if (texto === '') return 'Escriba el id de la cuenta del revisor.';
      return UUID.test(texto) ? null : 'El id de la cuenta tiene que ser un identificador válido (formato 8-4-4-4-12).';
    }
    return null;
  });
  protected readonly fraudSelected = computed(() => this.reasonCode() === 'SUSPECTED_FRAUD');
  protected readonly reasonCount = computed(() => this.reason().trim().length);
  protected readonly noteCount = computed(() => this.note().trim().length);

  private readonly problems = computed(() => [
    this.sourceProblem(),
    this.dateProblem(),
    this.codeProblem(),
    this.reasonProblem(),
    this.noteProblem(),
    this.assigneeProblem(),
  ]);

  protected onSourceType(event: Event): void {
    this.sourceType.set((event.target as HTMLSelectElement).value as SourceTypeCode | '');
  }

  protected onReasonCode(event: Event): void {
    this.reasonCode.set((event.target as HTMLSelectElement).value as ReasonCode | '');
  }

  protected onAssignee(event: Event): void {
    this.assigneeId.set((event.target as HTMLSelectElement).value);
  }

  protected onDate(event: Event): void {
    this.consultedAt.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    this.touched.set(true);
    if (this.busy() || this.problems().some((p) => p !== null)) return;
    const config = this.config();
    const ref = this.refText().trim();
    const nota = this.note().trim();
    this.confirmed.emit({
      ...(config.source === true && this.sourceType() !== ''
        ? {
            sourceType: this.sourceType() as SourceTypeCode,
            ...(ref === '' ? {} : { sourceRef: ref }),
            sourceConsultedAt: String(this.consultedAt()),
          }
        : {}),
      ...(config.reason === undefined
        ? {}
        : {
            reason: this.reason().trim(),
            ...(config.reason.withCode && this.reasonCode() !== '' ? { reasonCode: this.reasonCode() as ReasonCode } : {}),
            ...(config.reason.note && nota !== '' ? { internalNote: nota } : {}),
          }),
      ...(config.assignees === undefined ? {} : { assigneeId: this.assigneeId() }),
      ...(config.assigneeById === true ? { assigneeId: String(this.assigneeText() ?? '').trim().toLowerCase() } : {}),
    });
  }

  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
