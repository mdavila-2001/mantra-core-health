import type { Condition, Encounter, MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import {
  esReconsulta,
  type Booking,
} from '../../../../core/data-access/scheduling/scheduling.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  type ResolverCodigo,
} from '../../../../shared/clinical/diagnosis-state';
import { fechaCorta, fechaValida } from './redaccion';
import type {
  EstadoDelControl,
  EstadoDelDiagnostico,
  FuentesDelPortal,
  RegistroConVinculos,
  ResolverEtiqueta,
  TipoDeRegistro,
  VinculoAusente,
} from './registro-con-vinculos.types';

/* ============================================================================
    (a) The adapter: from the patient portal's types to a neutral «record with
    links» interface (`registro-con-vinculos.types.ts`).

    ## Why a neutral interface

    The grouping into episodes and the narration (`episodios.ts`) should not
    know whether the record came from `GET /clinical/patients/:id/summary`,
    from `/diagnostic-results/me/orders` or from the agenda. So, when strip 2
    publishes the clinical network's shared model, **this** file is replaced
    and the grouping stays the same.

    ## Why it is not the chart's `RegistroDeLaRed` (06/11/2026)

    The practitioner's network nodes (`patient-chart/recorrido-clinico/
    red-clinica.model.ts`, ADR-0021) were dismissed: that record is a card
    worded for the doctor (`titulo`, `detalle`, `estado` in their jargon,
    without the data sheet nor the links not on record), and that network
    **deduces** links (`inferido-*`) the portal deliberately does not show
    (Strip 5's decision 3). Adapting costs more than it saves; ids are shared.

    ## Only what the portal already receives

    The clinical summary, the own orders and the holder's appointments: the
    same three reads «Por fecha» already makes. What does not travel
    —referrals, for example— is not inferred: it is declared absent.
    ========================================================================== */

/** Every portal record, in the neutral shape. */
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

/** An empty record, so as not to repeat fifteen `null` in each adapter. */
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

/** How a diagnosis ended up, with the same helper the «Diagnósticos» tab uses. */
function estadoDelDiagnostico(
  condicion: Condition,
  codigo: ResolverCodigo,
  ahora: Date,
): EstadoDelDiagnostico {
  // C3's decision rules even if the catalogue did not translate the code.
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
  // An expired, unresolved confirmed one stays confirmed: nobody resolved it.
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
  const reemplazadoPorId = condicion.replacedByConditionId ?? null;
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
  // `reasonConditionId` arrives in `GET /diagnostic-results/me/orders` since
  // 06/11/2026 (`PatientOrderSummaryDto`, absent if the order did not state it).
  const motivo = orden.reasonConditionId ?? null;
  // A link to a diagnosis the summary did not bring cannot be named: it is
  // treated as not on record, instead of drawing an edge into the void.
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

/** An appointment's status code, without module prefix and with underscores. */
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
