/* ============================================================================
    Del contrato a la red clínica: los registros y **sólo** los vínculos que el
    contrato guarda.

    Las formas de entrada son los tipos de `core/data-access` recortados con
    `Pick`. Los campos de la Franja 1 (`reasonConditionId`,
    `targetEncounterId` —sólo tras aceptar—, `replacedByConditionId`) y
    `replacedByRequestId` de las recetas son opcionales en el contrato:
    ausentes, la red no dibuja esos vínculos.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import {
  inferirVinculos,
  type CertezaDiagnostica,
  type ClaseDeLaRed,
  type RegistroDeLaRed,
  type VinculoDeLaRed,
} from './red-clinica.model';
import type { TipoDelRecorrido } from './recorrido-clinico.model';
import type {
  CarePlan,
  ChartNote,
  Condition,
  DiagnosisEvidence,
  Encounter,
  MedicationRequest,
  Observation,
} from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import type { DentalProcedure } from '../../../../core/data-access/procedures/procedures.types';

/** La clase de la red que corresponde a cada bloque del expediente. */
export const CLASE_DEL_TIPO: Readonly<Record<TipoDelRecorrido, ClaseDeLaRed>> = {
  encuentros: 'atencion',
  internaciones: 'internacion',
  observaciones: 'observacion',
  diagnosticos: 'diagnostico',
  medicacion: 'medicacion',
  planes: 'plan',
  notas: 'nota',
  documentos: 'documento',
};

/** Un registro de los bloques del expediente, ya presentado (lo arma la pantalla, con la misma regla que la tabla). */
export interface FilaPresentada {
  readonly id: string;
  readonly tipo: TipoDelRecorrido;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  readonly cuando: Date | null;
  readonly certeza?: CertezaDiagnostica;
  readonly concepto?: string;
}

/**
 * Lo que la red lee de cada lectura: los tipos del contrato
 * (`core/data-access`), recortados a los campos que usa. Así las pruebas no
 * fabrican un resumen clínico entero, y un cambio de nombre en el contrato
 * rompe la compilación acá en vez de borrar una línea en silencio.
 */
export interface FuenteDeLaRed {
  readonly encounters: readonly Pick<Encounter, 'id' | 'episodeId'>[];
  readonly conditions: readonly (Pick<Condition, 'id' | 'encounterId' | 'replacedByConditionId'> & {
    readonly verification?: { readonly basedOn: DiagnosisEvidence | null } | null;
  })[];
  readonly medicationRequests: readonly Pick<
    MedicationRequest,
    'id' | 'encounterId' | 'indicationConditionId' | 'replacedByRequestId'
  >[];
  readonly observations: readonly Pick<Observation, 'id' | 'encounterId'>[];
  readonly notes: readonly Pick<ChartNote, 'noteId' | 'encounterId'>[];
  readonly carePlans: readonly Pick<CarePlan, 'id' | 'conditionId'>[];
  /** Las lecturas que la red pide aparte. `null`: no se pudo leer o todavía no llegó. */
  readonly citas?: readonly CitaDeLaFuente[] | null;
  readonly derivaciones?: readonly DerivacionDeLaFuente[] | null;
  readonly estudios?: {
    readonly orders: readonly OrdenDeLaFuente[];
    readonly reports: readonly InformeDeLaFuente[];
  } | null;
  readonly procedimientos?: readonly ProcedimientoDeLaFuente[] | null;
}

export type CitaDeLaFuente = Pick<
  Booking,
  'id' | 'startAt' | 'createdAt' | 'statusConceptId' | 'typeConceptId' | 'reasonText' | 'followUpOf'
> & { readonly service?: Pick<NonNullable<Booking['service']>, 'name'> };

export type DerivacionDeLaFuente = Pick<
  Referral,
  | 'id'
  | 'createdAt'
  | 'status'
  | 'sourceEncounterId'
  | 'targetEncounterId'
  | 'targetDisplayName'
  | 'targetTenantName'
  | 'targetExternalName'
  | 'targetServiceName'
  | 'requestedServiceText'
  | 'reasonText'
  | 'diagnosisText'
  | 'counterReferralAt'
> & { readonly transfer?: Pick<NonNullable<Referral['transfer']>, 'arrivedAt'> };

export type OrdenDeLaFuente = Pick<
  DiagnosticOrder,
  'id' | 'encounterId' | 'codeConceptId' | 'statusConceptId' | 'createdAt' | 'reasonConditionId'
>;

export type InformeDeLaFuente = Pick<
  DiagnosticReport,
  'id' | 'serviceRequestId' | 'encounterId' | 'codeConceptId' | 'lifecycleStatusConceptId' | 'createdAt'
>;

export type ProcedimientoDeLaFuente = Pick<
  DentalProcedure,
  'id' | 'encounterId' | 'procedureCodeConceptId' | 'statusConceptId' | 'performedAt' | 'createdAt'
>;

/** La etiqueta de un concepto: `display` para mostrar, `code` para decidir. */
export type Rotulador = (conceptId: string | undefined) => { readonly display?: string; readonly code?: string };

/** El estado de una cita, por código: el tono no depende del texto. */
const CITA: Readonly<Record<string, { tono: Tone; atendible: boolean }>> = {
  'BK-REQUESTED': { tono: 'info', atendible: true },
  'BK-CONFIRMED': { tono: 'info', atendible: true },
  'BK-CHECKED-IN': { tono: 'primary', atendible: true },
  'BK-IN-PROGRESS': { tono: 'primary', atendible: true },
  'BK-COMPLETED': { tono: 'success', atendible: true },
  'BK-CANCELLED': { tono: 'error', atendible: false },
  'BK-REJECTED': { tono: 'error', atendible: false },
  'BK-NO-SHOW': { tono: 'warning', atendible: false },
};

/** El estado de una derivación en palabras: el ciclo enviada → aceptada → llegó → contrarreferencia. */
export function estadoDeLaDerivacion(d: DerivacionDeLaFuente): { readonly estado: string; readonly tono: Tone } {
  if (d.counterReferralAt !== undefined) return { estado: 'Contrarreferencia', tono: 'success' };
  if (d.transfer?.arrivedAt !== undefined) return { estado: 'Llegó al destino', tono: 'success' };
  switch (d.status) {
    case 'PENDING':
      return { estado: 'Enviada', tono: 'info' };
    case 'ACCEPTED':
      return { estado: 'Aceptada', tono: 'primary' };
    case 'REJECTED':
      return { estado: 'Rechazada', tono: 'error' };
    case 'COMPLETED':
      return { estado: 'Completada', tono: 'success' };
    case 'CANCELLED':
      return { estado: 'Cancelada', tono: 'error' };
    default:
      return { estado: '', tono: 'info' };
  }
}

/**
 * Los registros y vínculos de la red.
 *
 * Un vínculo se dibuja sólo si sus **dos** extremos llegaron en esta lectura:
 * un diagnóstico recortado por el tope no puede ser el origen de una línea.
 * Los inferidos se agregan al final, ya marcados.
 */
export function construirRed(
  filas: readonly FilaPresentada[],
  fuente: FuenteDeLaRed,
  rotular: Rotulador,
): { readonly registros: readonly RegistroDeLaRed[]; readonly vinculos: readonly VinculoDeLaRed[] } {
  const atencionDe = new Map<string, string>();
  const anotar = (id: string, encuentro: string | undefined | null): void => {
    if (encuentro !== undefined && encuentro !== null && encuentro !== '') atencionDe.set(id, encuentro);
  };
  fuente.conditions.forEach((f) => anotar(f.id, f.encounterId));
  fuente.medicationRequests.forEach((f) => anotar(f.id, f.encounterId));
  fuente.observations.forEach((f) => anotar(f.id, f.encounterId));
  fuente.notes.forEach((f) => anotar(f.noteId, f.encounterId));

  const registros: RegistroDeLaRed[] = filas.map((f) => ({
    id: f.id,
    clase: CLASE_DEL_TIPO[f.tipo],
    titulo: f.titulo,
    detalle: f.detalle,
    estado: f.estado,
    ...(f.tonoDelEstado === undefined ? {} : { tonoDelEstado: f.tonoDelEstado }),
    cuando: f.cuando,
    ...(atencionDe.has(f.id) ? { encuentroId: atencionDe.get(f.id)! } : {}),
    ...(f.certeza === undefined ? {} : { certeza: f.certeza }),
    ...(f.concepto === undefined ? {} : { concepto: f.concepto }),
  }));

  const nombre = (conceptId: string | undefined, porOmision: string): string =>
    rotular(conceptId).display?.trim() || porOmision;

  for (const c of fuente.citas ?? []) {
    const codigo = rotular(c.statusConceptId).code ?? '';
    const reconsulta = c.followUpOf !== undefined && c.followUpOf !== null;
    registros.push({
      id: c.id,
      clase: 'cita',
      titulo: reconsulta ? 'Reconsulta' : c.service?.name || nombre(c.typeConceptId, 'Cita'),
      detalle: c.reasonText ?? '',
      estado: nombre(c.statusConceptId, ''),
      tonoDelEstado: CITA[codigo]?.tono ?? 'info',
      cuando: c.startAt ?? c.createdAt,
    });
  }
  for (const d of fuente.derivaciones ?? []) {
    const destino =
      d.targetDisplayName || d.targetTenantName || d.targetExternalName || d.targetServiceName || d.requestedServiceText;
    const { estado, tono } = estadoDeLaDerivacion(d);
    registros.push({
      id: d.id,
      clase: 'derivacion',
      titulo: destino ? `Derivación a ${destino}` : 'Derivación',
      detalle: d.reasonText ?? d.diagnosisText ?? '',
      estado,
      tonoDelEstado: tono,
      cuando: d.createdAt,
      ...(d.sourceEncounterId ? { encuentroId: d.sourceEncounterId } : {}),
    });
  }
  for (const o of fuente.estudios?.orders ?? []) {
    registros.push({
      id: o.id,
      clase: 'estudio',
      titulo: nombre(o.codeConceptId, 'Estudio'),
      detalle: 'Orden de estudio',
      estado: nombre(o.statusConceptId, ''),
      tonoDelEstado: 'info',
      cuando: o.createdAt,
      ...(o.encounterId ? { encuentroId: o.encounterId } : {}),
    });
  }
  for (const r of fuente.estudios?.reports ?? []) {
    registros.push({
      id: r.id,
      clase: 'resultado',
      titulo: nombre(r.codeConceptId, 'Resultado'),
      detalle: 'Informe del estudio',
      estado: nombre(r.lifecycleStatusConceptId, ''),
      tonoDelEstado: 'success',
      cuando: r.createdAt,
      ...(r.encounterId ? { encuentroId: r.encounterId } : {}),
    });
  }
  for (const p of fuente.procedimientos ?? []) {
    registros.push({
      id: p.id,
      clase: 'procedimiento',
      titulo: nombre(p.procedureCodeConceptId, 'Procedimiento'),
      detalle: '',
      estado: nombre(p.statusConceptId, ''),
      tonoDelEstado: 'info',
      cuando: p.performedAt ?? p.createdAt,
      ...(p.encounterId ? { encuentroId: p.encounterId } : {}),
    });
  }

  /* Los vínculos del contrato, con sus dos extremos a la vista. */
  const presentes = new Set(registros.map((r) => r.id));
  const atenciones = new Set(fuente.encounters.map((e) => e.id));
  const vinculos: VinculoDeLaRed[] = [];
  const unir = (desde: string | undefined | null, hasta: string, motivo: VinculoDeLaRed['motivo']): void => {
    if (desde !== undefined && desde !== null && desde !== '' && presentes.has(desde) && presentes.has(hasta)) {
      vinculos.push({ desde, hasta, motivo });
    }
  };
  for (const r of registros) {
    if (r.encuentroId !== undefined && atenciones.has(r.encuentroId)) {
      unir(r.encuentroId, r.id, r.clase === 'derivacion' ? 'derivado-desde' : 'registrado-en');
    }
  }
  for (const rx of fuente.medicationRequests) {
    unir(rx.indicationConditionId, rx.id, 'indicado-para');
    if (rx.replacedByRequestId) unir(rx.id, rx.replacedByRequestId, 'receta-reemplazada');
  }
  for (const dx of fuente.conditions) {
    if (dx.replacedByConditionId) unir(dx.id, dx.replacedByConditionId, 'reemplazado-por');
    const base = dx.verification?.basedOn;
    if (base !== undefined && base !== null) {
      const evidencia = base.diagnosticReportId ?? base.serviceRequestId ?? base.noteId ?? base.encounterId;
      // La atención donde se registró ya está unida por `registrado-en`.
      if (evidencia !== dx.encounterId) unir(evidencia, dx.id, 'evidencia');
    }
  }
  for (const plan of fuente.carePlans) {
    unir(plan.conditionId, plan.id, 'plan-para');
  }
  for (const o of fuente.estudios?.orders ?? []) {
    unir(o.reasonConditionId, o.id, 'pedido-para');
  }
  for (const r of fuente.estudios?.reports ?? []) {
    unir(r.serviceRequestId, r.id, 'resultado-de');
  }
  for (const d of fuente.derivaciones ?? []) {
    if (d.targetEncounterId) unir(d.id, d.targetEncounterId, 'recibido-en');
  }
  for (const c of fuente.citas ?? []) {
    const origen = c.followUpOf;
    if (origen === undefined || origen === null) continue;
    // La cita de origen si llegó; si no, su atención. Una sola línea: las dos
    // dicen lo mismo.
    if (presentes.has(origen.bookingId)) unir(origen.bookingId, c.id, 'reconsulta-de');
    else unir(origen.encounterId, c.id, 'reconsulta-de');
  }
  for (const e of fuente.encounters) {
    unir(e.episodeId, e.id, 'durante-internacion');
  }

  const atendible = new Map(
    (fuente.citas ?? []).map((c) => [c.id, CITA[rotular(c.statusConceptId).code ?? '']?.atendible ?? true]),
  );
  const inferidos = inferirVinculos(registros, vinculos, (id) => atendible.get(id) ?? true);
  // La cita a la que se le infiere una atención va en la columna de esa
  // atención: es la misma visita. La línea que las une dice «inferido».
  const columnaInferida = new Map(
    inferidos.filter((v) => v.motivo === 'inferido-mismo-dia').map((v) => [v.desde, v.hasta]),
  );
  const ubicados = registros.map((r) =>
    columnaInferida.has(r.id) ? { ...r, encuentroId: columnaInferida.get(r.id)! } : r,
  );
  return { registros: ubicados, vinculos: [...vinculos, ...inferidos] };
}
