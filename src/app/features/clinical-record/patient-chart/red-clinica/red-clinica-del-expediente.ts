/* ============================================================================
    De la red por episodios (Franja 2) al contrato del panel, los filtros y las
    alertas (Franja 3).

    La red ya leyó el expediente y armó sus registros y vínculos
    (`recorrido-clinico/red-clinica.adaptador.ts → construirRed`). Esto no
    vuelve a leer nada ni decide episodios: traduce cada `RegistroDeLaRed` a un
    `NodoDeRed` —con el análisis de su tipo sacado de la lectura que lo trajo—
    y cada `VinculoDeLaRed` a una `AristaDeRed`, con el sentido que pide la
    tabla de `red-clinica.types.ts`.

    Reglas:

    - **Ids reales.** El id del nodo es el del registro; las aristas, también.
    - **Nada inventado.** Lo que la lectura no trae queda ausente: sin nombre
      del profesional (ningún contrato del expediente lo publica), sin fecha de
      liberación de un informe (la lectura del profesional sólo dice que hay
      versión liberada), sin valores del resultado (no hay lectura de valores
      para el profesional). El panel dice lo que hay y nada más.
    - **Los inferidos siguen siendo inferidos**: `inferido: true` en la arista.
    ========================================================================== */

import type { Condition } from '../../../../core/data-access/clinical/clinical.types';
import type {
  AnalysisCategory,
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import { referralTypeLabel } from '../referral-block/referral-block.model';
import type { Rotulador } from '../recorrido-clinico/red-clinica.adaptador';
import type {
  ClaseDeLaRed,
  MotivoDelVinculo,
  RegistroDeLaRed,
  VinculoDeLaRed,
} from '../recorrido-clinico/red-clinica.model';
import type {
  AristaDeRed,
  CertezaDiagnostica,
  DetalleDeNodo,
  DetalleGeneral,
  NodoDeRed,
  TipoDeNodo,
  TipoDeVinculo,
} from './red-clinica.types';

/* -- Lo que se lee de cada lectura --------------------------------------- */

export type DiagnosticoDelDetalle = Pick<
  Condition,
  'id' | 'noteText' | 'onsetAt' | 'replacedByConditionId' | 'verification'
>;

export type CitaDelDetalle = Pick<Booking, 'id' | 'reasonText' | 'followUpOf'>;

export type DerivacionDelDetalle = Pick<
  Referral,
  | 'id'
  | 'status'
  | 'referralType'
  | 'reasonText'
  | 'diagnosisText'
  | 'clinicalSummary'
  | 'respondedAt'
  | 'rejectReason'
  | 'targetEncounterId'
  | 'counterReferralText'
  | 'counterReferralAt'
  | 'targetDisplayName'
  | 'targetTenantName'
  | 'targetExternalName'
  | 'targetServiceName'
  | 'requestedServiceText'
> & { readonly transfer?: { readonly arrivedAt?: Date; readonly arrivalNotes?: string } };

export type OrdenDelDetalle = Pick<DiagnosticOrder, 'id' | 'category' | 'priorityConceptId'>;

export type InformeDelDetalle = Pick<DiagnosticReport, 'id' | 'serviceRequestId' | 'currentReleasedVersionId'>;

/** Lo que el expediente ya muestra de un registro de sus bloques: el resumen y pares rótulo/valor. */
export interface DetalleDeBloque {
  readonly resumen?: string;
  readonly datos?: readonly { readonly rotulo: string; readonly valor: string }[];
}

/**
 * Las lecturas de donde sale el análisis de cada nodo. Todas opcionales: una
 * que falló (`null`) deja a sus nodos con la cabecera y los vínculos.
 */
export interface FuenteDelDetalle {
  readonly diagnosticos?: readonly DiagnosticoDelDetalle[] | null;
  readonly citas?: readonly CitaDelDetalle[] | null;
  readonly derivaciones?: readonly DerivacionDelDetalle[] | null;
  readonly estudios?: {
    readonly orders: readonly OrdenDelDetalle[];
    readonly reports: readonly InformeDelDetalle[];
  } | null;
  /** Atención, medicación, observación, nota, plan, documento, internación. */
  readonly bloques?: ReadonlyMap<string, DetalleDeBloque>;
}

/* -- Tipos y vínculos ------------------------------------------------------ */

/**
 * El tipo de nodo de cada clase de la red. El informe (`resultado`) es un
 * estudio para el panel: su análisis es el del pedido más su resultado.
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

interface Traduccion {
  readonly tipo: TipoDeVinculo;
  /** La red guarda el vínculo en el otro sentido que la tabla de la Franja 3. */
  readonly invertir: boolean;
  readonly inferido?: true;
}

/**
 * Cada motivo de la red, como vínculo del panel. La red dibuja
 * «atención → registro» y «diagnóstico → receta»; el panel lee «el registro
 * se registró en la atención» y «la receta está indicada para el
 * diagnóstico»: mismo vínculo, la flecha al revés.
 */
export const VINCULO_DEL_MOTIVO: Readonly<Record<MotivoDelVinculo, Traduccion>> = {
  'registrado-en': { tipo: 'registrado-en', invertir: true },
  'indicado-para': { tipo: 'indicado-para', invertir: true },
  'pedido-para': { tipo: 'pedido-para', invertir: true },
  'resultado-de': { tipo: 'resultado-de', invertir: true },
  'reemplazado-por': { tipo: 'reemplazado-por', invertir: false },
  'receta-reemplazada': { tipo: 'reemplaza-receta', invertir: false },
  evidencia: { tipo: 'evidencia-de', invertir: false },
  'plan-para': { tipo: 'plan-para', invertir: true },
  'derivado-desde': { tipo: 'derivada-desde', invertir: true },
  'recibido-en': { tipo: 'recibida-en', invertir: false },
  'reconsulta-de': { tipo: 'reconsulta-de', invertir: true },
  'durante-internacion': { tipo: 'durante-internacion', invertir: true },
  'inferido-misma-atencion': { tipo: 'pedido-para', invertir: true, inferido: true },
  'inferido-mismo-dia': { tipo: 'atendida-en', invertir: false, inferido: true },
};

/** Las aristas del panel, desde los vínculos de la red. Un vínculo repetido sale una vez. */
export function aristasDeLaRed(vinculos: readonly VinculoDeLaRed[]): readonly AristaDeRed[] {
  const vistas = new Set<string>();
  const aristas: AristaDeRed[] = [];
  for (const v of vinculos) {
    const t = VINCULO_DEL_MOTIVO[v.motivo];
    const [desde, hasta] = t.invertir ? [v.hasta, v.desde] : [v.desde, v.hasta];
    const clave = `${t.tipo}:${desde}>${hasta}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    aristas.push(t.inferido ? { desde, hasta, tipo: t.tipo, inferido: true } : { desde, hasta, tipo: t.tipo });
  }
  return aristas;
}

/* -- El análisis de cada tipo ---------------------------------------------- */

const CATEGORIA: Readonly<Record<AnalysisCategory, string>> = {
  LAB: 'Laboratorio',
  IMAGING: 'Imagen',
  OTHER: 'Otro estudio',
};

/** «Histórico» es un diagnóstico que se confirmó y se resolvió: el estado lo dice aparte. */
function certezaDelPanel(r: RegistroDeLaRed): CertezaDiagnostica {
  return r.certeza === 'presuntivo' || r.certeza === 'descartado' ? r.certeza : 'confirmado';
}

function texto(valor: string | undefined | null): string | undefined {
  const limpio = valor?.trim();
  return limpio === undefined || limpio === '' ? undefined : limpio;
}

/** Los nodos de la red con su análisis, y sus aristas. */
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
    const liberado = candidatos.some((i) => i.currentReleasedVersionId !== undefined);
    const prioridad = texto(rotular(orden?.priorityConceptId).display);
    return {
      tipo: 'estudio',
      ...(orden?.category === undefined ? {} : { categoria: CATEGORIA[orden.category] }),
      ...(prioridad === undefined ? {} : { prioridad }),
      // La lectura no trae ni la fecha de liberación ni los valores: se dice
      // que hay resultado liberado, sin inventar lo demás.
      resultado: liberado ? { liberadoEn: null, valores: [], archivos: [] } : null,
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
            // Sólo si el reemplazo llegó en esta lectura: un enlace a un nodo
            // que no está no lleva a ningún lado.
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
            // Una derivación que llegó o tiene contrarreferencia fue aceptada
            // aunque el estado ya diga «completada».
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
 * Lo que el filtro deja ver, cruzado con el filtro por tipo del expediente.
 *
 * Los dos son ids; vacío en uno quiere decir «todo» en ese criterio. Devuelve
 * `null` cuando ninguno filtra (la red dibuja todo) y un arreglo —quizá
 * vacío— cuando alguno lo hace: vacío es «nada pasa», que la red no puede
 * recibir como `visibles` (para ella vacío es «todo»).
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
