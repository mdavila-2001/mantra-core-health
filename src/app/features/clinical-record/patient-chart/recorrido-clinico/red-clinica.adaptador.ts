/* ============================================================================
    Del contrato a la red clínica: los registros y **sólo** los vínculos que el
    contrato guarda.

    Las formas de entrada son estructurales y mínimas, no los tipos de
    `core/data-access`: así las pruebas no fabrican un resumen clínico entero,
    y los tres campos nuevos del contrato (`reasonConditionId`,
    `targetEncounterId`, `replacedByConditionId`) se leen como opcionales —
    ausentes mientras la API o el simulador no los devuelvan, la red
    simplemente no dibuja esos vínculos—.
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

interface ConId {
  readonly id: string;
}

/** Lo que la red lee de cada lectura. Opcional lo que el contrato puede no traer. */
export interface FuenteDeLaRed {
  readonly encounters: readonly (ConId & { readonly episodeId?: string })[];
  readonly conditions: readonly (ConId & {
    readonly encounterId?: string;
    readonly replacedByConditionId?: string | null;
    readonly verification?: {
      readonly basedOn?: {
        readonly noteId?: string;
        readonly encounterId?: string;
        readonly serviceRequestId?: string;
        readonly diagnosticReportId?: string;
      } | null;
    } | null;
  })[];
  readonly medicationRequests: readonly (ConId & {
    readonly encounterId?: string;
    readonly indicationConditionId?: string;
    readonly replacedByRequestId?: string | null;
  })[];
  readonly observations: readonly (ConId & { readonly encounterId?: string })[];
  readonly notes: readonly { readonly noteId: string; readonly encounterId?: string }[];
  readonly carePlans: readonly (ConId & { readonly conditionId?: string })[];
  /** Las lecturas que la red pide aparte. `null`: no se pudo leer o todavía no llegó. */
  readonly citas?: readonly CitaDeLaFuente[] | null;
  readonly derivaciones?: readonly DerivacionDeLaFuente[] | null;
  readonly estudios?: {
    readonly orders: readonly OrdenDeLaFuente[];
    readonly reports: readonly InformeDeLaFuente[];
  } | null;
  readonly procedimientos?: readonly ProcedimientoDeLaFuente[] | null;
}

export interface CitaDeLaFuente extends ConId {
  readonly startAt?: Date;
  readonly createdAt: Date;
  readonly statusConceptId: string;
  readonly typeConceptId?: string;
  readonly reasonText?: string;
  readonly service?: { readonly name: string };
  readonly followUpOf?: { readonly bookingId: string; readonly encounterId: string | null } | null;
}

export interface DerivacionDeLaFuente extends ConId {
  readonly createdAt: Date;
  readonly status?: string;
  readonly sourceEncounterId?: string;
  readonly targetEncounterId?: string | null;
  readonly targetDisplayName?: string;
  readonly targetTenantName?: string;
  readonly targetExternalName?: string;
  readonly targetServiceName?: string;
  readonly requestedServiceText?: string;
  readonly reasonText?: string;
  readonly diagnosisText?: string;
  readonly counterReferralAt?: Date;
  readonly transfer?: { readonly arrivedAt?: Date };
}

export interface OrdenDeLaFuente extends ConId {
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
  readonly reasonConditionId?: string | null;
}

export interface InformeDeLaFuente extends ConId {
  readonly serviceRequestId?: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly lifecycleStatusConceptId: string;
  readonly createdAt: Date;
}

export interface ProcedimientoDeLaFuente extends ConId {
  readonly encounterId?: string;
  readonly procedureCodeConceptId: string;
  readonly statusConceptId: string;
  readonly performedAt?: Date;
  readonly createdAt: Date;
}

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
