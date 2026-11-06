/* ============================================================================
    From the contract to the clinical network: the records and **only** the
    links the contract stores.

    The input shapes are the `core/data-access` types trimmed with `Pick`
    (`red-clinica.fuente.ts`). The Strip 1 fields (`reasonConditionId`,
    `targetEncounterId` —only after accepting—, `replacedByConditionId`) and
    the prescriptions' `replacedByRequestId` are optional in the contract:
    when absent, the network does not draw those links.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { ClaseDeLaRed, RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';
import { inferirVinculos } from './red-clinica.vinculos';
import type { TipoDelRecorrido } from './recorrido-clinico.model';
import type { DerivacionDeLaFuente, FilaPresentada, FuenteDeLaRed, Rotulador } from './red-clinica.fuente';

/** The network class matching each chart block. */
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

/** An appointment's status, by code: the tone does not depend on the text. */
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

/** A referral's status in words: the cycle sent → accepted → arrived → counter-referral. */
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
 * The network's records and links.
 *
 * A link is drawn only if **both** ends arrived in this read: a diagnosis cut
 * off by the cap cannot be the source of a line. Inferred ones are appended at
 * the end, already marked.
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
  /* The contract's links, with both ends in view. */
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
      const evidencia = base.diagnosticReportId ?? base.serviceRequestId ?? base.noteId ?? base.encounterId;      // The encounter where it was entered is already joined by `registrado-en`.
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
    if (origen === undefined || origen === null) continue;    // The source appointment if it arrived; otherwise its encounter. A single
    // line: both say the same.
    if (presentes.has(origen.bookingId)) unir(origen.bookingId, c.id, 'reconsulta-de');
    else unir(origen.encounterId, c.id, 'reconsulta-de');
  }
  for (const e of fuente.encounters) {
    unir(e.episodeId, e.id, 'durante-internacion');
  }

  const atendible = new Map(
    (fuente.citas ?? []).map((c) => [c.id, CITA[rotular(c.statusConceptId).code ?? '']?.atendible ?? true]),
  );
  const inferidos = inferirVinculos(registros, vinculos, (id) => atendible.get(id) ?? true);  // The appointment inferred to an encounter goes in that encounter's column:
  // it is the same visit. The line joining them says «inferido».
  const columnaInferida = new Map(
    inferidos.filter((v) => v.motivo === 'inferido-mismo-dia').map((v) => [v.desde, v.hasta]),
  );
  const ubicados = registros.map((r) =>
    columnaInferida.has(r.id) ? { ...r, encuentroId: columnaInferida.get(r.id)! } : r,
  );
  return { registros: ubicados, vinculos: [...vinculos, ...inferidos] };
}
