import type {
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import {
  esReconsulta,
  type Booking,
} from '../../../../core/data-access/scheduling/scheduling.types';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  type ResolverCodigo,
} from '../../../../shared/clinical/diagnosis-state';

/* ============================================================================
    (a) El adaptador: de los tipos del portal del paciente a una interfaz
    neutra de «registro con vínculos».

    ## Por qué una interfaz neutra

    La agrupación en episodios y la narración (`episodios.ts`) no deberían
    saber si el registro vino de `GET /clinical/patients/:id/summary`, de
    `/diagnostic-results/me/orders` o de la agenda. Así, cuando la franja 2
    publique el modelo compartido de la red clínica, se reemplaza **este**
    archivo y la agrupación queda igual.

    // INTEGRACION-FRANJA-2: `RegistroConVinculos` es el sustituto local del
    // nodo de la red clínica del expediente (`patient-chart/recorrido-clinico`).
    // Cuando ese modelo exista en un lugar compartido, este adaptador debe
    // producir esos nodos y este tipo desaparece.

    ## Sólo lo que el portal ya recibe

    Entran el resumen clínico, las órdenes propias y las citas del titular: las
    mismas tres lecturas que la vista «Por fecha» ya hace. No se pide nada a
    otro endpoint. Lo que no viaja —las derivaciones, por ejemplo— no se
    infiere: queda declarado como ausente.
    ========================================================================== */

/** Qué clase de hecho es. */
export type TipoDeRegistro = 'atencion' | 'diagnostico' | 'estudio' | 'receta' | 'control';

/** El estado de un diagnóstico, en las cuatro palabras que lee el paciente. */
export type EstadoDelDiagnostico = 'en-estudio' | 'confirmado' | 'descartado' | 'resuelto';

/** Qué pasó con el control (la reconsulta agendada). */
export type EstadoDelControl = 'realizado' | 'proximo' | 'agendado' | 'no-realizado';

/**
 * Un vínculo que el recorrido necesitaría y que **no consta** en lo que llegó.
 *
 * No distingue «el campo no viajó» de «viajó vacío»: el contrato de la red
 * clínica omite los tres vínculos nuevos cuando valen `null`, así que desde
 * acá las dos cosas se ven igual. Lo que sí se puede decir es que no consta.
 */
export type VinculoAusente =
  /** El estudio no dice para qué diagnóstico se pidió (`reasonConditionId`). */
  | 'estudio-sin-diagnostico'
  /** El descartado no dice qué diagnóstico quedó en su lugar (`replacedByConditionId`). */
  | 'descartado-sin-reemplazo'
  /** La receta no dice para qué diagnóstico es (`indicationConditionId`). */
  | 'receta-sin-diagnostico';

/** Un registro del portal, con sus vínculos ya resueltos a identificadores. */
export interface RegistroConVinculos {
  readonly id: string;
  readonly tipo: TipoDeRegistro;
  /** El instante del hecho, o `null` si el registro no lo trae. */
  readonly cuando: Date | null;
  /** Lo que se nombra: el motivo, el diagnóstico, el estudio, el medicamento. */
  readonly nombre: string;
  /** La atención en que quedó registrado, si consta. */
  readonly atencionId: string | null;
  /** El diagnóstico al que sirve: indicación de la receta o motivo del estudio. */
  readonly diagnosticoId: string | null;
  /** Diagnóstico: el que lo reemplazó al descartarlo (vínculo nuevo de franja 1). */
  readonly reemplazadoPorId: string | null;
  /** Control: la atención de la que salió. */
  readonly origenAtencionId: string | null;
  /** Diagnóstico: en qué quedó. */
  readonly estado: EstadoDelDiagnostico | null;
  /** Diagnóstico: cuándo se decidió (confirmación o descarte), si consta. */
  readonly decididoEl: Date | null;
  /** Diagnóstico: el estudio con que se decidió (`verification.basedOn`). */
  readonly evidenciaEstudioId: string | null;
  /** Diagnóstico: cuándo se dio por resuelto. */
  readonly resueltoEl: Date | null;
  /** Estudio: el informe liberado, si ya lo hay. */
  readonly informeId: string | null;
  /** Estudio: el resultado ya está disponible para el paciente. */
  readonly conResultado: boolean;
  /** Control: en qué quedó. */
  readonly estadoDelControl: EstadoDelControl | null;
  /** Atención: sigue abierta. */
  readonly enCurso: boolean;
  /** Los datos que la hoja de detalle muestra, ya en palabras. */
  readonly detalle: readonly Hecho[];
  /** Los vínculos que no constan, para marcarlos sin inferirlos. */
  readonly ausentes: readonly VinculoAusente[];
}

/** Lo que el portal ya trajo, tal como lo trajo. */
export interface FuentesDelPortal {
  readonly resumen: ClinicalSummary;
  readonly ordenes: readonly PatientOrder[];
  readonly citas: readonly Booking[];
}

/** Resuelve un concepto a su etiqueta legible. */
export type ResolverEtiqueta = (conceptId: string | undefined) => string;

/**
 * Los tres vínculos nuevos del contrato de la red clínica (franja 1), leídos
 * **de forma tolerante**: hasta que `core/data-access` los declare, llegan por
 * el `...resto` de los mapeadores o no llegan.
 *
 * // INTEGRACION-FRANJA-2: cuando `Condition.replacedByConditionId` y
 * // `PatientOrder.reasonConditionId` estén declarados en los tipos, estas dos
 * // lecturas pasan a ser acceso directo.
 */
interface ConVinculosNuevos {
  readonly replacedByConditionId?: string | null;
  readonly reasonConditionId?: string | null;
}

function vinculoNuevo(
  registro: object,
  campo: keyof ConVinculosNuevos,
): string | null {
  const valor = (registro as ConVinculosNuevos)[campo];
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

/** Todos los registros del portal, en la forma neutra. */
export function registrosDelPortal(
  fuentes: FuentesDelPortal,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  ahora: Date = new Date(),
): readonly RegistroConVinculos[] {
  const { resumen, ordenes, citas } = fuentes;
  const diagnosticos = new Map(resumen.conditions.map((condicion) => [condicion.id, condicion]));
  const nombreDelDiagnostico = (id: string | null): string | null => {
    const condicion = id === null ? undefined : diagnosticos.get(id);
    return condicion === undefined ? null : etiqueta(condicion.codeConceptId);
  };

  return [
    ...resumen.encounters.map((encuentro) => desdeAtencion(encuentro)),
    ...resumen.conditions.map((condicion) =>
      desdeDiagnostico(condicion, etiqueta, codigo, ahora, nombreDelDiagnostico),
    ),
    ...ordenes.map((orden) => desdeEstudio(orden, etiqueta, diagnosticos, nombreDelDiagnostico)),
    ...resumen.medicationRequests.map((receta) =>
      desdeReceta(receta, etiqueta, diagnosticos, nombreDelDiagnostico),
    ),
    ...citas
      .filter((cita) => esReconsulta(cita))
      .map((cita) => desdeControl(cita, codigo, ahora)),
  ];
}

/** Un registro vacío, para no repetir quince `null` en cada adaptador. */
function base(id: string, tipo: TipoDeRegistro, nombre: string): RegistroConVinculos {
  return {
    id,
    tipo,
    nombre,
    cuando: null,
    atencionId: null,
    diagnosticoId: null,
    reemplazadoPorId: null,
    origenAtencionId: null,
    estado: null,
    decididoEl: null,
    evidenciaEstudioId: null,
    resueltoEl: null,
    informeId: null,
    conResultado: false,
    estadoDelControl: null,
    enCurso: false,
    detalle: [],
    ausentes: [],
  };
}

function desdeAtencion(encuentro: Encounter): RegistroConVinculos {
  const motivo = encuentro.reasonText?.trim() || 'Consulta';
  return {
    ...base(encuentro.id, 'atencion', motivo),
    cuando: encuentro.startAt ?? null,
    atencionId: encuentro.id,
    enCurso: encuentro.endAt === undefined,
    detalle: [
      { etiqueta: 'Motivo', valor: motivo },
      { etiqueta: 'Fecha', valor: fechaCorta(encuentro.startAt) },
      { etiqueta: 'Estado', valor: encuentro.endAt === undefined ? 'En curso' : 'Cerrada' },
    ],
  };
}

const ESTADO_POR_GRUPO = {
  IN_STUDY: 'en-estudio',
  ACTIVE: 'confirmado',
  HISTORIC: 'resuelto',
  REFUTED: 'descartado',
} as const;

/** En qué quedó un diagnóstico, con el mismo helper que usa la pestaña «Diagnósticos». */
function estadoDelDiagnostico(
  condicion: Condition,
  codigo: ResolverCodigo,
  ahora: Date,
): EstadoDelDiagnostico {
  // La decisión de C3 manda aunque el catálogo no haya traducido el código.
  if (condicion.verification?.outcome === 'REFUTED') return 'descartado';
  const grupo = diagnosisStateOf(
    {
      ...condicion,
      verificationStatusConceptId:
        codigo(condicion.verificationStatusConceptId) ??
        (condicion.verification?.outcome === 'CONFIRMED' ? CODIGO_CONFIRMADO : undefined),
      clinicalStatusConceptId: codigo(condicion.clinicalStatusConceptId),
    },
    { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
    ahora,
  );
  // Un confirmado cuyo plazo venció sin resolverse no se da por «resuelto»:
  // nadie lo resolvió. Sigue confirmado y la fecha la dice el detalle.
  if (grupo === 'HISTORIC' && condicion.resolvedAt === undefined) return 'confirmado';
  return ESTADO_POR_GRUPO[grupo];
}

const PALABRA_DEL_ESTADO: Readonly<Record<EstadoDelDiagnostico, string>> = {
  'en-estudio': 'En estudio',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
  resuelto: 'Resuelto',
};

function desdeDiagnostico(
  condicion: Condition,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  ahora: Date,
  nombreDelDiagnostico: (id: string | null) => string | null,
): RegistroConVinculos {
  const estado = estadoDelDiagnostico(condicion, codigo, ahora);
  const decision = condicion.verification ?? null;
  const decididoEl = decision === null ? null : fechaValida(decision.decidedAt);
  const reemplazadoPorId = vinculoNuevo(condicion, 'replacedByConditionId');
  const motivo = decision?.reasonText?.trim() || null;
  const ausentes: VinculoAusente[] =
    estado === 'descartado' && reemplazadoPorId === null ? ['descartado-sin-reemplazo'] : [];

  return {
    ...base(condicion.id, 'diagnostico', etiqueta(condicion.codeConceptId)),
    cuando: condicion.createdAt,
    atencionId: condicion.encounterId ?? null,
    reemplazadoPorId,
    estado,
    decididoEl,
    evidenciaEstudioId: decision?.basedOn?.serviceRequestId ?? null,
    resueltoEl: condicion.resolvedAt ?? null,
    ausentes,
    detalle: [
      { etiqueta: 'Estado', valor: PALABRA_DEL_ESTADO[estado] },
      { etiqueta: 'Registrado', valor: fechaCorta(condicion.createdAt) },
      { etiqueta: 'Desde', valor: fechaCorta(condicion.onsetAt) },
      {
        etiqueta: estado === 'descartado' ? 'Descartado el' : 'Confirmado el',
        valor: estado === 'en-estudio' ? null : fechaCorta(decididoEl ?? undefined),
      },
      { etiqueta: 'Resuelto el', valor: fechaCorta(condicion.resolvedAt) },
      { etiqueta: 'En su lugar quedó', valor: nombreDelDiagnostico(reemplazadoPorId) },
      { etiqueta: 'Motivo indicado', valor: motivo },
      {
        etiqueta: 'Nota del profesional',
        valor: condicion.noteText?.trim() || null,
      },
    ],
  };
}

function desdeEstudio(
  orden: PatientOrder,
  etiqueta: ResolverEtiqueta,
  diagnosticos: ReadonlyMap<string, Condition>,
  nombreDelDiagnostico: (id: string | null) => string | null,
): RegistroConVinculos {
  const motivo = vinculoNuevo(orden, 'reasonConditionId');
  // Un vínculo a un diagnóstico que el resumen no trajo no se puede nombrar:
  // se trata como si no constara, en vez de dibujar una arista al vacío.
  const diagnosticoId = motivo !== null && diagnosticos.has(motivo) ? motivo : null;
  return {
    ...base(orden.id, 'estudio', etiqueta(orden.codeConceptId)),
    cuando: orden.createdAt,
    atencionId: orden.encounterId ?? null,
    diagnosticoId,
    informeId: orden.reportId ?? null,
    conResultado: orden.hasReleasedResult,
    ausentes: diagnosticoId === null ? ['estudio-sin-diagnostico'] : [],
    detalle: [
      { etiqueta: 'Pedido el', valor: fechaCorta(orden.createdAt) },
      { etiqueta: 'Estado', valor: etiqueta(orden.statusConceptId) },
      { etiqueta: 'Para', valor: nombreDelDiagnostico(diagnosticoId) },
      {
        etiqueta: 'Resultado',
        valor: orden.hasReleasedResult ? 'Disponible' : 'Todavía no disponible',
      },
      { etiqueta: 'Preparación', valor: orden.preparationInstructions?.trim() || null },
    ],
  };
}

function desdeReceta(
  receta: MedicationRequest,
  etiqueta: ResolverEtiqueta,
  diagnosticos: ReadonlyMap<string, Condition>,
  nombreDelDiagnostico: (id: string | null) => string | null,
): RegistroConVinculos {
  const indicacion = receta.indicationConditionId ?? null;
  const diagnosticoId = indicacion !== null && diagnosticos.has(indicacion) ? indicacion : null;
  const pauta = [receta.doseText, receta.frequencyText].filter(Boolean).join(' · ');
  return {
    ...base(receta.id, 'receta', etiqueta(receta.medicationConceptId)),
    cuando: receta.issuedAt ?? receta.createdAt,
    atencionId: receta.encounterId ?? null,
    diagnosticoId,
    ausentes: diagnosticoId === null ? ['receta-sin-diagnostico'] : [],
    detalle: [
      { etiqueta: 'Indicación', valor: pauta === '' ? null : pauta },
      {
        etiqueta: 'Para',
        valor: nombreDelDiagnostico(diagnosticoId) ?? (receta.indicationText?.trim() || null),
      },
      { etiqueta: 'Estado', valor: etiqueta(receta.statusConceptId) },
      { etiqueta: 'Emitida el', valor: fechaCorta(receta.issuedAt) },
      { etiqueta: 'Indicaciones', valor: receta.patientInstructionsText?.trim() || null },
    ],
  };
}

/** El código de estado de una cita, sin prefijo de módulo y con guion bajo. */
function codigoDeCita(codigo: string | undefined): string {
  if (codigo === undefined) return '';
  const simple = codigo.includes(':') ? codigo.slice(codigo.lastIndexOf(':') + 1) : codigo;
  return simple.toUpperCase().replace(/-/g, '_');
}

function estadoDelControl(cita: Booking, codigo: ResolverCodigo, ahora: Date): EstadoDelControl {
  const estado = codigoDeCita(codigo(cita.statusConceptId));
  if (/(COMPLETED|DONE)$/.test(estado)) return 'realizado';
  if (/(CANCELLED|REJECTED|NO_SHOW)$/.test(estado)) return 'no-realizado';
  if (cita.startAt !== undefined && cita.startAt.getTime() > ahora.getTime()) return 'proximo';
  return 'agendado';
}

const PALABRA_DEL_CONTROL: Readonly<Record<EstadoDelControl, string>> = {
  realizado: 'Realizado',
  proximo: 'Próximo',
  agendado: 'Agendado',
  'no-realizado': 'No se realizó',
};

function desdeControl(cita: Booking, codigo: ResolverCodigo, ahora: Date): RegistroConVinculos {
  const estado = estadoDelControl(cita, codigo, ahora);
  return {
    ...base(cita.id, 'control', 'Control'),
    cuando: cita.startAt ?? null,
    origenAtencionId: cita.followUpOf?.encounterId ?? null,
    estadoDelControl: estado,
    detalle: [
      { etiqueta: 'Fecha', valor: fechaCorta(cita.startAt) },
      { etiqueta: 'Estado', valor: PALABRA_DEL_CONTROL[estado] },
      { etiqueta: 'Motivo', valor: cita.reasonText?.trim() || null },
    ],
  };
}

/* ---- fechas -------------------------------------------------------------- */

const DIA_CORTO = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** «3 feb 2026», o `null` para que la hoja no dibuje la fila. */
export function fechaCorta(cuando: Date | undefined): string | null {
  return cuando === undefined || Number.isNaN(cuando.getTime()) ? null : DIA_CORTO.format(cuando);
}

function fechaValida(iso: string): Date | null {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
