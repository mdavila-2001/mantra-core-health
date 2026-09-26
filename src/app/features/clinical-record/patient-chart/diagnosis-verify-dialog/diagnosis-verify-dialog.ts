import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import type { ChartNotesPage } from '../../../../core/data-access/chart-notes/chart-notes.types';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type {
  Condition,
  DiagnosisEvidence,
  DiagnosisOutcome,
  NewDiagnosisVerification,
} from '../../../../core/data-access/clinical/clinical.types';
import { DiagnosticsClient } from '../../../../core/data-access/diagnostics/diagnostics.client';
import type { PatientDiagnostics } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';

/** Hasta cuánto puede decir el motivo. Es el tope del contrato (§3.4). */
export const MAX_MOTIVO = 500;

/**
 * El binding del curso clínico. Es el mismo que usa el alta del bloque; se
 * repite acá en vez de importarlo para no cerrar un ciclo bloque ⇄ diálogo.
 */
const TARGET_CURSO_CLINICO = 'clinical.conditions.clinical_course_concept_id';

/** El curso que exime del fin esperado: una crónica no resuelve. */
const CODIGO_CURSO_CRONICO = 'COND_COURSE_CHRONIC';

/**
 * «Informe · Hemograma completo · 12 sept 2026».
 *
 * Sin una opción vacía propia: `app-select` ya dibuja su `placeholder` como
 * la opción nula, y sumarle otra mostraba «Sin evidencia» dos veces.
 */
function opcionesDeEvidencia(
  circuito: PatientDiagnostics | null,
  notas: ChartNotesPage | null,
  etiquetas: ConceptLabels,
): readonly SelectOption<string | null>[] {
  const nombre = (conceptId: string) => etiquetas.get(conceptId)?.display ?? 'Estudio';
  const fecha = (instante: Date) =>
    instante.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    ...(circuito?.reports ?? []).map((informe) => ({
      value: `report:${informe.id}`,
      label: `Informe · ${nombre(informe.codeConceptId)} · ${fecha(informe.createdAt)}`,
    })),
    ...(circuito?.orders ?? []).map((orden) => ({
      value: `order:${orden.id}`,
      label: `Orden · ${nombre(orden.codeConceptId)} · ${fecha(orden.createdAt)}`,
    })),
    ...(notas?.items ?? []).map((nota) => ({
      value: `note:${nota.noteId}`,
      // «Nota #a1b2»: cuatro caracteres distinguen dos notas del mismo día sin
      // mostrar el identificador entero.
      label: `Nota #${nota.noteId.replace(/-/g, '').slice(-4)} · ${fecha(nota.signedAt ?? nota.createdAt)}`,
    })),
  ];
}

/**
 * **Confirmar o rechazar** un diagnóstico presuntivo — C3.
 *
 * ## Por qué un modal
 *
 * Es un cambio sobre un registro existente que **pide datos**: el motivo, la
 * evidencia y, al confirmar, desde y hasta cuándo. Eso va en modal; la fila
 * sólo tiene la acción directa.
 *
 * ## Lo que valida antes de mandar es el espejo del 422
 *
 * El contrato exige motivo **o** evidencia, y al confirmar un fin esperado
 * **o** curso crónico. Se comprueba acá con el mismo criterio y se marca el
 * campo: mandar para que el servidor lo rechace y recién ahí avisar hace
 * perder el foco y obliga a releer todo el formulario. Lo que el servidor
 * responda igual se muestra —un 409 porque alguien decidió antes, un 422 que
 * esta pantalla no previó— sin perder lo escrito.
 *
 * ## La evidencia es de esta persona, y sólo de ella
 *
 * Las opciones salen del circuito diagnóstico del paciente y de sus notas: no
 * hay un campo libre donde pegar un identificador. Una lectura que falle deja
 * la lista con «Sin evidencia» y el motivo sigue alcanzando para decidir.
 */
@Component({
  selector: 'app-diagnosis-verify-dialog',
  imports: [Alert, AppButton, Checkbox, ContentDialog, DatePicker, FormField, Select, Textarea],
  templateUrl: './diagnosis-verify-dialog.html',
  styleUrl: './diagnosis-verify-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosisVerifyDialog {
  private readonly clinical = inject(ClinicalClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly chartNotes = inject(ChartNotesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly dialogs = inject(DialogService);

  /** El presuntivo a decidir. */
  readonly condition = input.required<Condition>();

  /** La persona, para leer su circuito diagnóstico y sus notas. */
  readonly patientProfileId = input.required<string>();

  /** Qué se decide. Gobierna el título, los campos y el color del botón. */
  readonly outcome = input.required<DiagnosisOutcome>();

  /** El nombre del diagnóstico, para el título. Sin él: «el diagnóstico». */
  readonly nombre = input('');

  /** La condición como quedó en el servidor. */
  readonly verified = output<Condition>();

  /** Se cerró, con o sin decisión. Quien lo usa lo desmonta acá. */
  readonly closed = output<void>();

  private readonly dialog = viewChild(ContentDialog);

  protected readonly maxMotivo = MAX_MOTIVO;

  protected readonly confirma = computed(() => this.outcome() === 'CONFIRMED');

  protected readonly titulo = computed(
    () => `${this.confirma() ? 'Confirmar' : 'Rechazar'} ${this.nombre() || 'el diagnóstico'}`,
  );

  protected readonly bajada = computed(() =>
    this.confirma()
      ? 'Queda como enfermedad activa en la historia. Decí en qué te basás y hasta cuándo se espera.'
      : 'Queda como rechazado en la historia. Decí en qué te basás.',
  );

  /* -- Lo que se escribe --------------------------------------------------- */

  protected readonly motivo = signal('');
  protected readonly evidencia = signal<string | null>(null);

  /**
   * El inicio, o `undefined` mientras nadie lo tocó: entonces vale el que el
   * presuntivo ya declaraba. Así el campo aparece precargado sin copiar el
   * dato en el constructor, donde las entradas todavía no existen.
   */
  private readonly inicioElegido = signal<Date | null | undefined>(undefined);
  protected readonly inicio = computed<Date | null>(() => {
    const elegido = this.inicioElegido();
    return elegido === undefined ? (this.condition().onsetAt ?? null) : elegido;
  });

  protected readonly fin = signal<Date | null>(null);
  protected readonly cronica = signal(false);

  protected readonly enviando = signal(false);
  /** Se muestran los errores recién cuando alguien intentó enviar. */
  protected readonly intentado = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  /* -- Lo que se lee ------------------------------------------------------- */

  protected readonly opcionesDeEvidencia = signal<readonly SelectOption<string | null>[]>([]);
  protected readonly cargandoEvidencia = signal(true);
  private readonly circuito = signal<PatientDiagnostics | null>(null);

  /** El concepto del curso crónico, o `null` si el catálogo no lo publica. */
  protected readonly cursoCronico = signal<string | null>(null);

  constructor() {
    effect(() => {
      const patientProfileId = this.patientProfileId();
      untracked(() => this.cargarEvidencia(patientProfileId));
    });
    this.systemContext.dynamicEnum(TARGET_CURSO_CLINICO).subscribe({
      next: (enumeracion) =>
        this.cursoCronico.set(
          enumeracion.options.find((opcion) => opcion.code === CODIGO_CURSO_CRONICO)?.conceptId ??
            null,
        ),
      error: () => this.cursoCronico.set(null),
    });
  }

  private cargarEvidencia(patientProfileId: string): void {
    this.cargandoEvidencia.set(true);
    forkJoin({
      circuito: this.diagnostics
        .getPatientDiagnostics(patientProfileId)
        .pipe(catchError(() => of<PatientDiagnostics | null>(null))),
      notas: this.chartNotes
        .listNotes({ patientProfileId })
        .pipe(catchError(() => of<ChartNotesPage | null>(null))),
    })
      .pipe(
        switchMap(({ circuito, notas }) => {
          const conceptos = [
            ...(circuito?.orders ?? []).map((orden) => orden.codeConceptId),
            ...(circuito?.reports ?? []).map((informe) => informe.codeConceptId),
          ];
          return this.terminology.readConceptLabels(conceptos).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => ({
              circuito,
              opciones: opcionesDeEvidencia(circuito, notas, etiquetas),
            })),
          );
        }),
      )
      .subscribe(({ circuito, opciones }) => {
        this.circuito.set(circuito);
        this.opcionesDeEvidencia.set(opciones);
        this.cargandoEvidencia.set(false);
      });
  }

  /* -- El espejo del 422 --------------------------------------------------- */

  protected readonly faltaSustento = computed(
    () => this.motivo().trim() === '' && this.evidencia() === null,
  );
  protected readonly faltaInicio = computed(() => this.confirma() && this.inicio() === null);
  protected readonly faltaFin = computed(
    () => this.confirma() && !this.cronica() && this.fin() === null,
  );

  protected readonly errorDeMotivo = computed(() =>
    this.intentado() && this.faltaSustento()
      ? 'Escribí el motivo o elegí una evidencia: al menos uno de los dos.'
      : '',
  );
  protected readonly errorDeInicio = computed(() =>
    this.intentado() && this.faltaInicio()
      ? 'Indicá desde cuándo la persona presenta la condición.'
      : '',
  );
  protected readonly errorDeFin = computed(() =>
    this.intentado() && this.faltaFin()
      ? 'Indicá hasta cuándo se espera la condición, o marcala como crónica.'
      : '',
  );

  /** Lo que el servidor dijo, en palabras. `null` mientras no falló nada. */
  protected readonly errorDelServidor = computed<string | null>(() => {
    const estado = this.resultado();
    if (estado.status === 'validation') {
      return (
        estado.issues.map((issue) => issue.message).join(' ') || 'El servidor rechazó la decisión.'
      );
    }
    return mensajeDeFalloDeEscritura(estado, {
      accion: 'confirmar o rechazar diagnósticos',
      sinPermiso: 'Tu rol no permite confirmar ni rechazar diagnósticos.',
      yaNoExiste: 'El diagnóstico ya no existe: alguien lo quitó mientras lo decidías.',
    });
  });

  /** Algo se escribió: cerrar tiene que preguntar. */
  protected readonly tieneCambios = computed(
    () =>
      this.motivo().trim() !== '' ||
      this.evidencia() !== null ||
      this.fin() !== null ||
      this.cronica() ||
      this.inicioElegido() !== undefined,
  );

  /** La guardia del modal: con cambios, pregunta antes de tirarlos. */
  protected readonly guardia = async (): Promise<boolean> => {
    if (this.enviando()) return false;
    if (!this.tieneCambios()) return true;
    return this.dialogs.confirm({
      title: '¿Descartar la decisión?',
      message: 'Lo que escribiste no se guardó. Si cerrás, el diagnóstico sigue en estudio.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    });
  };

  protected elegirInicio(fecha: Date | null): void {
    this.inicioElegido.set(fecha);
  }

  protected marcarCronica(marcada: boolean): void {
    this.cronica.set(marcada);
    if (marcada) {
      // Una crónica no resuelve: dejar la fecha invita a mandar las dos cosas.
      this.fin.set(null);
    }
  }

  /** La evidencia elegida, en la forma del contrato. `undefined` si no hay. */
  private evidenciaElegida(): DiagnosisEvidence | undefined {
    const valor = this.evidencia();
    if (valor === null) return undefined;
    const separador = valor.indexOf(':');
    const tipo = valor.slice(0, separador);
    const id = valor.slice(separador + 1);
    if (tipo === 'note') return { kind: 'NOTE', noteId: id };
    if (tipo === 'order') return { kind: 'ANALYSIS', serviceRequestId: id };
    const informe = this.circuito()?.reports.find((r) => r.id === id);
    return {
      kind: 'ANALYSIS',
      diagnosticReportId: id,
      ...(informe?.serviceRequestId === undefined
        ? {}
        : { serviceRequestId: informe.serviceRequestId }),
    };
  }

  /**
   * Decide. Con algo que falta según el contrato, marca los campos y no manda:
   * el servidor lo rechazaría igual, pero acá el foco no se pierde.
   */
  protected enviar(): void {
    this.intentado.set(true);
    if (this.enviando() || this.faltaSustento() || this.faltaInicio() || this.faltaFin()) {
      return;
    }
    const motivo = this.motivo().trim();
    const evidencia = this.evidenciaElegida();
    const inicio = this.inicio();
    const fin = this.fin();
    const cursoCronico = this.cursoCronico();

    const decision: NewDiagnosisVerification = {
      outcome: this.outcome(),
      ...(motivo === '' ? {} : { reasonText: motivo }),
      ...(evidencia === undefined ? {} : { basedOn: evidencia }),
      ...(this.confirma() && inicio !== null ? { onsetAt: inicio.toISOString() } : {}),
      ...(this.confirma() && !this.cronica() && fin !== null
        ? { expectedResolutionAt: fin.toISOString() }
        : {}),
      ...(this.confirma() && this.cronica() && cursoCronico !== null
        ? { clinicalCourseConceptId: cursoCronico }
        : {}),
    };

    this.enviando.set(true);
    this.resultado.set(loading());
    this.clinical.verifyCondition(this.condition().id, decision).subscribe({
      next: (condicion) => {
        this.enviando.set(false);
        this.resultado.set(ready(null));
        this.verified.emit(condicion);
        this.cerrar();
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.resultado.set(errorToViewState<null>(error));
      },
    });
  }

  /** Cierra sin preguntar: lo llama el éxito y el botón «Cancelar» sin cambios. */
  protected cerrar(): void {
    const modal = this.dialog();
    if (modal === undefined) {
      this.closed.emit();
      return;
    }
    modal.close(true);
  }

  /** «Cancelar»: con cambios pregunta, igual que `Escape` y el fondo. */
  protected async cancelar(): Promise<void> {
    if (await this.guardia()) {
      this.cerrar();
    }
  }
}
