/* ============================================================================
    From the network by episodes (Strip 2) to the contract of the panel, the
    filters and the alerts (Strip 3).

    The network already read the chart and built its records and links
    (`recorrido-clinico/red-clinica.adaptador.ts → construirRed`). This reads
    nothing again nor decides episodes: it translates each `RegistroDeLaRed`
    to a `NodoDeRed` —with its type's analysis taken from the read that brought
    it (`red-clinica-del-expediente.fuente.ts`)— and each `VinculoDeLaRed` to an
    `AristaDeRed`, in the direction `red-clinica-vinculos.types.ts` asks for
    (`red-clinica-del-expediente.aristas.ts`).

    Rules:

    - **Real ids.** The node's id is the record's; the edges', too.
    - **Nothing made up.** What the read does not bring stays absent: no
      practitioner name (no chart contract publishes it), no release date nor
      values of a report in the orders list (it only says there is a released
      version): the panel reads them on opening the study, with the report id.
      The panel says what there is and nothing more.
    - **Inferred links stay inferred**: `inferido: true` on the edge.
    ========================================================================== */

import type { AnalysisCategory } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { referralTypeLabel } from '../referral-block/referral-block.model';
import type { Rotulador } from '../recorrido-clinico/red-clinica.fuente';
import type { ClaseDeLaRed, RegistroDeLaRed, VinculoDeLaRed } from '../recorrido-clinico/red-clinica.model';
import type { CertezaDiagnostica, DetalleDeNodo, DetalleGeneral, NodoDeRed, TipoDeNodo } from './red-clinica.types';
import type { AristaDeRed } from './red-clinica-vinculos.types';
import type { FuenteDelDetalle, InformeDelDetalle } from './red-clinica-del-expediente.fuente';
import { aristasDeLaRed } from './red-clinica-del-expediente.aristas';

/**
 * The node type of each network class. The report (`resultado`) is a study
 * for the panel: its analysis is the order's plus its result.
 */
const TIPO_DE_LA_CLASE: Readonly<Record<ClaseDeLaRed, TipoDeNodo>> = {
  atencion: 'atencion',
  cita: 'cita',
  internacion: 'internacion',
  diagnostico: 'diagnostico',
  estudio: 'estudio',
  resultado: 'estudio',
  procedimiento: 'procedimiento',
  medicacion: 'medicacion',
  derivacion: 'derivacion',
  plan: 'plan',
  observacion: 'observacion',
  nota: 'nota',
  documento: 'documento',
};

/* -- Each type's analysis --------------------------------------------------- */

const CATEGORIA: Readonly<Record<AnalysisCategory, string>> = {
  LAB: 'Laboratorio',
  IMAGING: 'Imagen',
  OTHER: 'Otro estudio',
};

/** «Histórico» is a diagnosis that was confirmed and resolved: the status says so apart. */
function certezaDelPanel(r: RegistroDeLaRed): CertezaDiagnostica {
  return r.certeza === 'presuntivo' || r.certeza === 'descartado' ? r.certeza : 'confirmado';
}

function texto(valor: string | undefined | null): string | undefined {
  const limpio = valor?.trim();
  return limpio === undefined || limpio === '' ? undefined : limpio;
}

/** The network's nodes with their analysis, and their edges. */
export function nodosDeLaRed(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
  fuente: FuenteDelDetalle,
  rotular: Rotulador,
): { readonly nodos: readonly NodoDeRed[]; readonly aristas: readonly AristaDeRed[] } {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const titulo = (id: string | undefined | null): string | undefined =>
    id === undefined || id === null ? undefined : porId.get(id)?.titulo;

  const diagnosticos = new Map((fuente.diagnosticos ?? []).map((d) => [d.id, d]));
  const citas = new Map((fuente.citas ?? []).map((c) => [c.id, c]));
  const derivaciones = new Map((fuente.derivaciones ?? []).map((d) => [d.id, d]));
  const ordenes = new Map((fuente.estudios?.orders ?? []).map((o) => [o.id, o]));
  const informes = new Map((fuente.estudios?.reports ?? []).map((i) => [i.id, i]));
  const informesDeLaOrden = new Map<string, InformeDelDetalle[]>();
  for (const i of fuente.estudios?.reports ?? []) {
    if (i.serviceRequestId === undefined) continue;
    informesDeLaOrden.set(i.serviceRequestId, [...(informesDeLaOrden.get(i.serviceRequestId) ?? []), i]);
  }

  const detalleDeEstudio = (ordenId: string | undefined, informe: InformeDelDetalle | undefined): DetalleDeNodo => {
    const orden = ordenId === undefined ? undefined : ordenes.get(ordenId);
    const candidatos = informe !== undefined ? [informe] : ordenId === undefined ? [] : (informesDeLaOrden.get(ordenId) ?? []);
    const liberado = candidatos.find((i) => i.currentReleasedVersionId !== undefined);
    const prioridad = texto(rotular(orden?.priorityConceptId).display);
    return {
      tipo: 'estudio',
      ...(orden?.category === undefined ? {} : { categoria: CATEGORIA[orden.category] }),
      ...(prioridad === undefined ? {} : { prioridad }),
      // The orders list brings neither the release date nor the values: it
      // says there is a released result, without making up the rest. With the
      // report id, the panel reads them on opening it (`getPractitionerResult`).
      resultado: liberado === undefined ? null : { liberadoEn: null, valores: [], archivos: [], informeId: liberado.id },
    };
  };

  const detalleDe = (r: RegistroDeLaRed): { readonly tipo: TipoDeNodo; readonly detalle?: DetalleDeNodo } => {
    switch (r.clase) {
      case 'diagnostico': {
        const dx = diagnosticos.get(r.id);
        const verificacion = dx?.verification ?? null;
        const base = verificacion?.basedOn ?? null;
        const evidenciaId =
          base === null ? undefined : (base.diagnosticReportId ?? base.serviceRequestId ?? base.noteId ?? base.encounterId);
        const reemplazo = dx?.replacedByConditionId;
        const nota = texto(dx?.noteText);
        return {
          tipo: 'diagnostico',
          detalle: {
            tipo: 'diagnostico',
            certeza: certezaDelPanel(r),
            ...(nota === undefined ? {} : { nota }),
            inicio: dx?.onsetAt ?? null,
            decision:
              verificacion === null
                ? null
                : {
                    resultado: verificacion.outcome === 'CONFIRMED' ? 'confirmado' : 'descartado',
                    decididoEn: new Date(verificacion.decidedAt),
                    decididoPor: null,
                    motivo: texto(verificacion.reasonText) ?? null,
                    evidencia:
                      base === null
                        ? null
                        : {
                            tipo: base.kind === 'NOTE' ? 'nota' : 'analisis',
                            etiqueta: titulo(evidenciaId) ?? (base.kind === 'NOTE' ? 'Nota clínica' : 'Análisis'),
                            ...(evidenciaId !== undefined && porId.has(evidenciaId) ? { nodoId: evidenciaId } : {}),
                          },
                  },
            // Only if the replacement arrived in this read: a link to a node
            // that is not there leads nowhere.
            reemplazadoPor:
              reemplazo !== undefined && porId.has(reemplazo)
                ? { nodoId: reemplazo, etiqueta: titulo(reemplazo)! }
                : null,
          },
        };
      }
      case 'estudio':
        return { tipo: 'estudio', detalle: detalleDeEstudio(r.id, undefined) };
      case 'resultado': {
        const informe = informes.get(r.id);
        return { tipo: 'estudio', detalle: detalleDeEstudio(informe?.serviceRequestId, informe) };
      }
      case 'cita': {
        const cita = citas.get(r.id);
        const reconsulta = cita?.followUpOf !== undefined && cita?.followUpOf !== null;
        const motivo = texto(cita?.reasonText);
        const tipo = reconsulta ? 'reconsulta' : 'cita';
        return { tipo, detalle: { tipo, ...(motivo === undefined ? {} : { motivo }) } };
      }
      case 'derivacion': {
        const d = derivaciones.get(r.id);
        if (d === undefined) return { tipo: 'derivacion' };
        const destino = texto(
          d.targetDisplayName || d.targetTenantName || d.targetExternalName || d.targetServiceName || d.requestedServiceText,
        );
        const motivo = texto(d.reasonText ?? d.diagnosisText);
        const resumen = texto(d.clinicalSummary);
        const llegada = d.transfer?.arrivedAt;
        const contrarreferencia = texto(d.counterReferralText);
        const respondida = d.status === 'ACCEPTED' || d.status === 'COMPLETED' || d.status === 'REJECTED';
        return {
          tipo: 'derivacion',
          detalle: {
            tipo: 'derivacion',
            ...(d.referralType === undefined ? {} : { tipoDeDerivacion: referralTypeLabel(d.referralType) }),
            ...(destino === undefined ? {} : { destino }),
            ...(motivo === undefined ? {} : { motivo }),
            ...(resumen === undefined ? {} : { resumenClinico: resumen }),
            // A referral that arrived or has a counter-referral was accepted
            // even if the status already says «completada».
            respuesta: respondida
              ? {
                  decision: d.status === 'REJECTED' ? 'rechazada' : 'aceptada',
                  en: d.respondedAt ?? null,
                  motivoDeRechazo: d.status === 'REJECTED' ? (texto(d.rejectReason) ?? null) : null,
                }
              : null,
            llegada:
              llegada === undefined
                ? null
                : {
                    en: llegada,
                    atencionNodoId:
                      d.targetEncounterId !== undefined && porId.has(d.targetEncounterId) ? d.targetEncounterId : null,
                    notas: texto(d.transfer?.arrivalNotes) ?? null,
                  },
            contrarreferencia:
              contrarreferencia === undefined ? null : { texto: contrarreferencia, en: d.counterReferralAt ?? null },
          },
        };
      }
      default: {
        const bloque = fuente.bloques?.get(r.id);
        const resumen = texto(bloque?.resumen) ?? texto(r.detalle);
        const datos = (bloque?.datos ?? []).filter((d) => texto(d.valor) !== undefined);
        const detalle: DetalleGeneral = {
          tipo: 'general',
          ...(resumen === undefined ? {} : { resumen }),
          ...(datos.length === 0 ? {} : { datos }),
        };
        return { tipo: TIPO_DE_LA_CLASE[r.clase], detalle };
      }
    }
  };

  const nodos = registros.map((r): NodoDeRed => {
    const { tipo, detalle } = detalleDe(r);
    const subtitulo = texto(r.detalle);
    return {
      id: r.id,
      tipo,
      titulo: r.titulo,
      ...(subtitulo === undefined ? {} : { subtitulo }),
      cuando: r.cuando,
      estado: r.estado === '' ? null : { etiqueta: r.estado, ...(r.tonoDelEstado === undefined ? {} : { tono: r.tonoDelEstado }) },
      ...(detalle === undefined ? {} : { detalle }),
    };
  });
  return { nodos, aristas: aristasDeLaRed(vinculos) };
}

/**
 * What the filter lets through, crossed with the chart's filter by type.
 *
 * Both are ids; empty in one means «everything» for that criterion. Returns
 * `null` when neither filters (the network draws everything) and an array
 * —maybe empty— when one does: empty is «nothing passes», which the network
 * cannot receive as `visibles` (for it empty is «everything»).
 */
export function visiblesCombinados(
  porTipo: readonly string[],
  porFiltro: readonly string[] | null,
): readonly string[] | null {
  if (porTipo.length === 0 && porFiltro === null) return null;
  if (porFiltro === null) return porTipo;
  if (porTipo.length === 0) return porFiltro;
  const tipo = new Set(porTipo);
  return porFiltro.filter((id) => tipo.has(id));
}
