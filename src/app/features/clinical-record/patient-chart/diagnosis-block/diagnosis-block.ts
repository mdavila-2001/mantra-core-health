import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { catchError, map, of, switchMap } from 'rxjs';

import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type {
  Condition,
  DiagnosisOutcome,
} from '../../../../core/data-access/clinical/clinical.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  DIAGNOSIS_STATE_LABELS,
  diagnosisStateOf,
  type DiagnosisState,
} from '../../../../shared/clinical/diagnosis-state';
import type { Tone } from '../../../../shared/components/tone/tone.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { DiagnosisVerifyDialog } from '../diagnosis-verify-dialog/diagnosis-verify-dialog';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';

/**
 * La columna que gobierna el diagnóstico.
 *
 * Se mantiene exportada porque es el `target` real de `clinical.conditions.code_concept_id`
 * — `enums-del-diagnostico.spec.ts` verifica contra este valor que el simulador
 * resuelve el catálogo correcto, independientemente de si esta pantalla ofrece
 * o no un selector para él.
 */
export const TARGET_DIAGNOSTICO = 'clinical.conditions.code_concept_id';

/** La categoría del registro (`clinical.conditions.category_concept_id`). Mismo criterio. */
export const TARGET_CATEGORIA = 'clinical.conditions.category_concept_id';

/** La severidad (`clinical.conditions.severity_concept_id`). Mismo criterio. */
export const TARGET_SEVERIDAD = 'clinical.conditions.severity_concept_id';

/** La lateralidad (`clinical.conditions.laterality_concept_id`). Mismo criterio. */
export const TARGET_LATERALIDAD = 'clinical.conditions.laterality_concept_id';

/** El curso clínico (`clinical.conditions.clinical_course_concept_id`). Mismo criterio. */
export const TARGET_CURSO_CLINICO = 'clinical.conditions.clinical_course_concept_id';

/**
 * Una cita del paciente.
 *
 * Vestigio del formulario de alta que este bloque tenía (ver «Sólo la tabla»
 * más abajo): el input `citas` sigue existiendo porque los tres anfitriones
 * (`patient-chart`, `consultation`, `specialty-form-block`) se lo siguen
 * pasando, pero el bloque ya no lo usa para nada.
 */
export interface CitaDelPaciente {
  readonly id: string;
  readonly etiqueta: string;
  readonly enCurso: boolean;
}

/* ---- la tabla de presuntivos (C3) ----------------------------------------- */

/**
 * Una fila de la tabla: la condición y lo que la pantalla ya resolvió de ella.
 *
 * El estado sale de `diagnosisStateOf` sobre **códigos** de catálogo, nunca de
 * etiquetas: la etiqueta es presentación y puede cambiar sin aviso.
 */
export interface FilaDeDiagnostico {
  readonly condition: Condition;
  readonly nombre: string;
  readonly estado: DiagnosisState;
  readonly etiquetaDeEstado: string;
  readonly tono: Tone;
  /** «Informe · Cuadro compatible», o «—» mientras no se decidió. */
  readonly evidencia: string;
  /** Sólo un presuntivo se confirma o se rechaza. */
  readonly enEstudio: boolean;
}

/** Mismo reparto de color que la línea de tiempo de la consulta. */
const TONO_DEL_ESTADO: Readonly<Record<DiagnosisState, Tone>> = Object.freeze({
  IN_STUDY: 'warning',
  ACTIVE: 'success',
  HISTORIC: 'info',
  REFUTED: 'info',
});

const SIN_ETIQUETA = 'Diagnóstico sin etiqueta en el catálogo';
const LARGO_DEL_MOTIVO = 60;

/** Qué respaldó la decisión, en dos palabras, y el motivo recortado. */
function evidenciaDe(condicion: Condition): string {
  const decision = condicion.verification;
  if (decision === undefined || decision === null) return '—';
  const tipo =
    decision.basedOn === null
      ? null
      : decision.basedOn.kind === 'NOTE'
        ? 'Nota'
        : decision.basedOn.diagnosticReportId === undefined
          ? 'Orden'
          : 'Informe';
  const motivo =
    decision.reasonText === null
      ? null
      : decision.reasonText.length > LARGO_DEL_MOTIVO
        ? `${decision.reasonText.slice(0, LARGO_DEL_MOTIVO - 1)}…`
        : decision.reasonText;
  return [tipo, motivo].filter((parte): parte is string => parte !== null).join(' · ') || '—';
}

/** Las condiciones como filas, de la más nueva a la más vieja. */
function filasDe(conditions: readonly Condition[], etiquetas: ConceptLabels): FilaDeDiagnostico[] {
  const codigo = (conceptId: string | undefined) =>
    conceptId === undefined ? undefined : etiquetas.get(conceptId)?.code;
  return [...conditions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((condition) => {
      const estado = diagnosisStateOf(
        {
          ...condition,
          verificationStatusConceptId: codigo(condition.verificationStatusConceptId),
          clinicalStatusConceptId: codigo(condition.clinicalStatusConceptId),
        },
        { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
      );
      return {
        condition,
        nombre: etiquetas.get(condition.codeConceptId)?.display ?? SIN_ETIQUETA,
        estado,
        etiquetaDeEstado: DIAGNOSIS_STATE_LABELS[estado],
        tono: TONO_DEL_ESTADO[estado],
        evidencia: evidenciaDe(condition),
        enEstudio: estado === 'IN_STUDY',
      };
    });
}

/** Los conceptos que la tabla traduce: el diagnóstico y sus dos estados. */
function conceptosDe(conditions: readonly Condition[]): string[] {
  return conditions.flatMap((condition) =>
    [
      condition.codeConceptId,
      condition.verificationStatusConceptId,
      condition.clinicalStatusConceptId,
    ].filter((id): id is string => id !== undefined),
  );
}

/**
 * **Diagnóstico** del expediente: la tabla de presuntivos — C3.
 *
 * ## Sólo la tabla (2026-09-25)
 *
 * Este bloque tenía además un formulario completo para dar de alta un
 * diagnóstico a mano (catálogo, categoría, severidad, lateralidad, curso
 * clínico, duración estimada, notas). El propietario pidió sacar del modal
 * «Nuevo diagnóstico» todo lo que no fuera la tabla: lo demás no se estaba
 * usando. Queda sólo la tabla de presuntivos y el diálogo de verificación que
 * sus acciones abren.
 *
 * Lo que eso implica:
 * - `tieneCambiosPendientes` (contrato de `DraftBlock`) queda fijo en `false`:
 *   sin formulario no hay borrador que se pueda perder al cerrar el modal.
 * - Los inputs `encounterId`, `citas` y `exigeEncuentro` siguen declarados
 *   porque los tres anfitriones (`patient-chart.html`, `consultation.html`,
 *   `specialty-form-block.html`) se los siguen pasando, pero el bloque ya no
 *   los usa para nada. No se tocaron esos tres archivos: es un cambio fuera
 *   del alcance de este trabajo.
 * - `TARGET_DIAGNOSTICO`/`TARGET_CATEGORIA`/`TARGET_SEVERIDAD`/
 *   `TARGET_LATERALIDAD`/`TARGET_CURSO_CLINICO` se mantienen exportados: son
 *   los nombres reales de columna del contrato clínico y
 *   `enums-del-diagnostico.spec.ts` los usa para verificar que el simulador
 *   resuelve bien esos catálogos, sin relación con si esta pantalla arma un
 *   selector con ellos.
 * - El alta manual (`POST /clinical/conditions`) sigue existiendo en el
 *   backend; sólo se quitó el formulario de esta pantalla. De dónde nacen los
 *   presuntivos que hoy llegan «En estudio» es una pregunta de negocio que
 *   este cambio no contesta ni necesita contestar.
 *
 * ## La tabla de presuntivos (C3, 2026-09-26)
 *
 * Diagnóstico · Estado · Evidencia · Acciones. El estado lo decide
 * `diagnosisStateOf` sobre los códigos del catálogo; los de «En estudio»
 * ofrecen **Confirmar** y **Rechazar**, que abren el diálogo de verificación.
 * Tras el 200 se relee la lista y se avisa al expediente.
 */
@Component({
  selector: 'app-diagnosis-block',
  imports: [AppButton, Badge, Card, DataTable, DiagnosisVerifyDialog],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => DiagnosisBlock) }],
  templateUrl: './diagnosis-block.html',
  styleUrl: './diagnosis-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosisBlock implements DraftBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** Vestigio del formulario de alta que este bloque tenía. Ver el comentario de la clase. */
  readonly encounterId = input<string | null>(null);

  /** Vestigio del formulario de alta que este bloque tenía. Ver el comentario de la clase. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** Vestigio del formulario de alta que este bloque tenía. Ver el comentario de la clase. */
  readonly exigeEncuentro = input(true);

  /** Algo se escribió y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  /** Contrato de `DraftBlock`. Sin formulario no hay borrador que perder. */
  readonly tieneCambiosPendientes = computed(() => false);

  /* -- La tabla de presuntivos (C3) ----------------------------------------- */

  /** Las condiciones de la persona, ya resueltas a filas. */
  protected readonly filas = signal<ViewState<readonly FilaDeDiagnostico[]>>(loading());

  /** La decisión en curso: qué presuntivo y en qué sentido. `null` sin diálogo. */
  protected readonly verificando = signal<{
    readonly fila: FilaDeDiagnostico;
    readonly outcome: DiagnosisOutcome;
  } | null>(null);

  private readonly celdaDiagnostico =
    viewChild.required<TemplateRef<{ $implicit: FilaDeDiagnostico }>>('celdaDiagnostico');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaDeDiagnostico }>>('celdaEstado');
  private readonly celdaEvidencia =
    viewChild.required<TemplateRef<{ $implicit: FilaDeDiagnostico }>>('celdaEvidencia');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: FilaDeDiagnostico }>>('celdaAcciones');

  /**
   * Diagnóstico · Estado · Evidencia · Acciones, en ese orden.
   *
   * Diagnóstico y acciones con prioridad 1: son la decisión. El estado y la
   * evidencia se pliegan al detalle en móvil; las acciones no, porque son la
   * razón de la tabla.
   */
  protected readonly columnas = computed<readonly ColumnDef<FilaDeDiagnostico>[]>(() => [
    { key: 'nombre', header: 'Diagnóstico', priority: 1, cell: this.celdaDiagnostico() },
    { key: 'estado', header: 'Estado', priority: 2, cell: this.celdaEstado() },
    { key: 'evidencia', header: 'Evidencia', priority: 3, cell: this.celdaEvidencia() },
    { key: 'acciones', header: 'Acciones', priority: 1, cell: this.celdaAcciones() },
  ]);

  protected readonly porId = (fila: FilaDeDiagnostico): string => fila.condition.id;
  protected readonly nombreDeFila = (fila: FilaDeDiagnostico): string => fila.nombre;

  /** Relee la lista de la persona. Lo que se muestra es lo que el servidor tiene. */
  protected recargar(): void {
    this.cargarTabla(this.patientProfileId());
  }

  private cargarTabla(patientProfileId: string): void {
    this.filas.set(loading());
    this.clinical
      .getSummary(patientProfileId)
      .pipe(
        switchMap((resumen) =>
          this.terminology.readConceptLabels(conceptosDe(resumen.conditions)).pipe(
            // Sin etiquetas la tabla igual se muestra: el estado no se puede
            // resolver y queda «En estudio», que es lo que menos afirma.
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => filasDe(resumen.conditions, etiquetas)),
          ),
        ),
      )
      .subscribe({
        next: (filas) =>
          this.filas.set(
            filas.length === 0
              ? empty(
                  { label: 'Todavía no hay nada para revisar' },
                  'Esta persona todavía no tiene diagnósticos registrados.',
                )
              : ready(filas),
          ),
        error: (error: unknown) =>
          this.filas.set(errorToViewState<readonly FilaDeDiagnostico[]>(error)),
      });
  }

  /** Abre el diálogo para confirmar o rechazar un presuntivo. */
  protected abrirVerificacion(fila: FilaDeDiagnostico, outcome: DiagnosisOutcome): void {
    if (!fila.enEstudio) return;
    this.verificando.set({ fila, outcome });
  }

  /**
   * El servidor decidió: se cierra el diálogo, se relee la lista y se avisa.
   *
   * La fila no se reemplaza con la respuesta a mano: la lista es la del
   * servidor, y releerla es lo que garantiza que lo que se ve es lo que hay.
   */
  protected alVerificar(condicion: Condition): void {
    const decision = this.verificando();
    this.verificando.set(null);
    this.toasts.success(
      condicion.verification?.outcome === 'REFUTED'
        ? 'Quedó como rechazado en la historia.'
        : 'Quedó como enfermedad activa en la historia.',
      decision === null ? 'Diagnóstico decidido' : `${decision.fila.nombre}: decidido`,
    );
    this.recargar();
    this.cambio.emit();
  }

  constructor() {
    // La tabla sigue a la persona: cambia el paciente, cambia la lista.
    effect(() => {
      const patientProfileId = this.patientProfileId();
      untracked(() => this.cargarTabla(patientProfileId));
    });
  }
}
