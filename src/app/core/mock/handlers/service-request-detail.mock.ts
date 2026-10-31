import type { AnalysisCategory } from '../../data-access/diagnostics/diagnostics.types';
import type { StudyFamily } from '../../data-access/study-catalog/study-catalog.types';
import { displayOf, membersOf, ORDER_CATEGORY, STATUS } from '../fixtures/concepts';
import {
  esEstudioHeredado,
  estudioDelCatalogo,
  familiaDeEstudio,
  IDS_DE_CONTRASTE,
  IDS_DE_LATERALIDAD,
  IDS_DE_MODALIDAD,
  IDS_DE_MUESTRA,
  regionPorId,
} from '../fixtures/study-catalog';
import { preconditionFailed, reply, validation, type MockReply } from '../mock-router';
import { Coleccion } from '../mock-store';
import { categoriaDeLaOrden, esRechazo, resolverCategoria } from './service-request-category.mock';

/* ============================================================================
    El detalle de la orden en el doble (v4.2.80): muestra, componentes
    marcados y datos de imagen, con las mismas reglas V1-V9 de la API y la
    misma forma de 422.

    Un 422 de estas reglas es `PRECONDITION_FAILED` con **`details.reason`**
    (nunca el `reason` de primer nivel), `details.field` y, en una requisición,
    `details.itemIndex` (base 0). Es la convención de lo nuevo en la API
    (`StudyDetailReason`).

    Este módulo es puro: no importa los handlers del circuito (que lo
    importan a él). El puente a la bandeja del ejecutor y la antiduplicación
    con informes viven en `requisitions.handlers.ts`.
    ========================================================================== */

/** Lo que el cuerpo de un alta (o un renglón de requisición) trae del estudio. */
export interface ItemDeOrden {
  readonly codeConceptId?: string;
  readonly category?: unknown;
  readonly categoryConceptId?: string;
  readonly specimenTypeConceptId?: unknown;
  readonly componentConceptIds?: unknown;
  readonly imaging?: unknown;
}

interface ImagenGuardada {
  readonly modalityConceptId: string | null;
  readonly bodySiteConceptId: string | null;
  readonly lateralityConceptId: string | null;
  readonly contrastConceptId: string | null;
}

/** Lo que se guarda de una orden aparte de la fila de `orderList`; una fila por orden. */
export interface DetalleDeOrden {
  readonly id: string;
  readonly requisitionId: string | null;
  readonly family: StudyFamily | null;
  readonly specimenTypeConceptId: string | null;
  readonly components: readonly { readonly conceptId: string; readonly ordinal: number }[];
  readonly componentsSpecified: boolean;
  readonly imaging: ImagenGuardada | null;
}

export const detallesDeOrden = new Coleccion<DetalleDeOrden>([]).persistirEn(
  'mock.clinica.ordenes.detalle',
);

/** El detalle ya validado de un renglón, listo para guardar con el id de la orden. */
export type DetalleValidado = Omit<DetalleDeOrden, 'id' | 'requisitionId'>;

export interface ItemValidado {
  /** El `categoryConceptId` a guardar. */
  readonly categoryConceptId: string | undefined;
  readonly detalle: DetalleValidado;
}

/* ---- rechazos ------------------------------------------------------------ */

/** El 422 de una regla del detalle. `itemIndex` sólo en una requisición. */
export function rechazoDeDetalle(
  reason: string,
  field: string,
  message: string,
  itemIndex?: number,
): MockReply {
  return preconditionFailed(message, {
    reason,
    field,
    ...(itemIndex === undefined ? {} : { itemIndex }),
  });
}

/** El 422 o el 400 del alta (P40: `reason` también de primer nivel, como la API). */
export function rechazoDeOrden(rechazo: {
  readonly status: 400 | 422;
  readonly reason: string;
  readonly message: string;
}): MockReply {
  if (rechazo.status === 400) return validation(rechazo.message);
  return reply(422, {
    statusCode: 422,
    code: 'PRECONDITION_FAILED',
    message: rechazo.message,
    error: 'Unprocessable Entity',
    reason: rechazo.reason,
    details: { reason: rechazo.reason },
  });
}

/* ---- validación V1-V9 ---------------------------------------------------- */

function listaDeTexto(valor: unknown): readonly string[] | null {
  if (valor === undefined) return [];
  if (!Array.isArray(valor) || valor.some((v) => typeof v !== 'string' || v === '')) return null;
  return valor as readonly string[];
}

const IMAGEN_VACIA: ImagenGuardada = {
  modalityConceptId: null,
  bodySiteConceptId: null,
  lateralityConceptId: null,
  contrastConceptId: null,
};

/** La categoría textual que le corresponde a una familia del catálogo. */
function categoriaDeFamilia(familia: StudyFamily): AnalysisCategory {
  return familia === 'LAB' ? 'LAB' : familia === 'IMAGING' ? 'IMAGING' : 'OTHER';
}

/**
 * Valida un renglón (V1-V9) y arma lo que se guarda, o responde el rechazo.
 *
 * @param item - El cuerpo del alta o el renglón de la requisición.
 * @param itemIndex - Posición en la requisición; ausente en el alta suelta.
 */
export function validarItemDeOrden(
  item: ItemDeOrden,
  itemIndex?: number,
): { readonly valido: ItemValidado } | { readonly rechazo: MockReply } {
  const falla = (reason: string, field: string, message: string) => ({
    rechazo: rechazoDeDetalle(reason, field, message, itemIndex),
  });
  const codeConceptId = item.codeConceptId ?? '';
  const familia = familiaDeEstudio(codeConceptId);
  const estudio = estudioDelCatalogo(codeConceptId);

  // V1: el estudio pertenece al catálogo (nuevo o heredado). El alta suelta
  // sin detalle nuevo conserva su comportamiento de siempre (pide procedimientos y
  // códigos que el simulador no cataloga); la requisición y cualquier alta con
  // muestra, componentes o imagen sí lo exigen.
  const trajoDetalle =
    item.specimenTypeConceptId !== undefined || item.componentConceptIds !== undefined || item.imaging !== undefined;
  if (familia === null && !esEstudioHeredado(codeConceptId) && (itemIndex !== undefined || trajoDetalle)) {
    return falla('STUDY_NOT_IN_CATALOG', 'codeConceptId', 'El estudio no pertenece al catálogo de estudios pedibles');
  }

  // Categoría (P40), con su rechazo de siempre.
  const categoria = resolverCategoria(item.category, item.categoryConceptId);
  if (esRechazo(categoria)) {
    return { rechazo: rechazoDeOrden(categoria) };
  }
  let categoryConceptId = categoria.conceptId;

  // V2: la categoría es la familia que el catálogo da al estudio (los heredados no declaran familia).
  if (estudio !== undefined) {
    const esperada = categoriaDeFamilia(estudio.item.family);
    const declarada = categoriaDeLaOrden(categoryConceptId);
    if (declarada !== undefined && declarada !== esperada) {
      return falla(
        'SERVICE_REQUEST_CATEGORY_STUDY_MISMATCH',
        'category',
        'La categoría no corresponde a la familia del estudio',
      );
    }
    categoryConceptId ??= ORDER_CATEGORY[esperada === 'LAB' ? 'SRQ-LAB' : esperada === 'IMAGING' ? 'SRQ-IMAGING' : 'SRQ-OTHER'];
  }

  // V3: la muestra.
  let specimen: string | null = null;
  if (item.specimenTypeConceptId !== undefined) {
    if (typeof item.specimenTypeConceptId !== 'string' || item.specimenTypeConceptId === '') {
      return { rechazo: validation('specimenTypeConceptId must be a UUID') };
    }
    if (familia !== 'LAB') {
      return falla('SPECIMEN_NOT_ALLOWED_FOR_CATEGORY', 'specimenTypeConceptId', 'La muestra sólo se pide en laboratorio o anatomía patológica');
    }
    if (!IDS_DE_MUESTRA.has(item.specimenTypeConceptId) && !membersOf('VS_SPECIMEN_TYPE').some((m) => m.id === item.specimenTypeConceptId)) {
      return falla('SPECIMEN_TYPE_NOT_IN_CATALOG', 'specimenTypeConceptId', 'La muestra no pertenece al catálogo de muestras');
    }
    specimen = item.specimenTypeConceptId;
  }

  // V4: los componentes marcados.
  const pedidos = listaDeTexto(item.componentConceptIds);
  if (pedidos === null) return { rechazo: validation('componentConceptIds must be an array of UUIDs') };
  const marcados = [...new Set(pedidos)];
  if (estudio?.item.componentsSelectable === true) {
    if (marcados.length === 0) {
      return falla('COMPONENTS_EMPTY', 'componentConceptIds', 'Un panel desplegable se pide con al menos un componente marcado');
    }
    if (marcados.some((id) => !estudio.idsDeComponentes.has(id))) {
      return falla('COMPONENT_NOT_IN_PANEL', 'componentConceptIds', 'Un componente no pertenece al panel pedido');
    }
  } else if (marcados.length > 0) {
    return falla('COMPONENTS_NOT_SELECTABLE', 'componentConceptIds', 'El estudio no es un panel con componentes seleccionables');
  }

  // V5-V9: imagen.
  let imagen: ImagenGuardada | null = null;
  const crudo = item.imaging;
  if (crudo !== undefined && (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo))) {
    return { rechazo: validation('imaging must be an object') };
  }
  const enviado = (crudo ?? {}) as Record<string, unknown>;
  const claves = ['modalityConceptId', 'bodySiteConceptId', 'lateralityConceptId', 'contrastConceptId'] as const;
  if (claves.some((k) => enviado[k] !== undefined && typeof enviado[k] !== 'string')) {
    return { rechazo: validation('imaging: los campos deben ser UUID') };
  }
  const dato = (k: (typeof claves)[number]): string | null => (enviado[k] as string | undefined) ?? null;
  const trae = claves.some((k) => dato(k) !== null);
  if (trae && familia !== 'IMAGING') {
    return falla('IMAGING_FIELDS_NOT_ALLOWED', 'imaging', 'El detalle de imagen sólo se pide en estudios de imagen');
  }
  if (familia === 'IMAGING' && (estudio !== undefined || trae)) {
    // V6: modalidad (la del estudio si no se envía).
    const delEstudio = estudio?.item.modalityConceptId ?? null;
    const modalidad = dato('modalityConceptId') ?? delEstudio;
    if (dato('modalityConceptId') !== null && !IDS_DE_MODALIDAD.has(dato('modalityConceptId')!)) {
      return falla('MODALITY_NOT_IN_CATALOG', 'imaging.modalityConceptId', 'La modalidad no pertenece al catálogo');
    }
    if (delEstudio !== null && dato('modalityConceptId') !== null && dato('modalityConceptId') !== delEstudio) {
      return falla('MODALITY_STUDY_MISMATCH', 'imaging.modalityConceptId', 'La modalidad no es la del estudio pedido');
    }
    if (modalidad === null && estudio !== undefined) {
      return falla('MODALITY_REQUIRED', 'imaging.modalityConceptId', 'El estudio de imagen exige modalidad');
    }
    // V7: región.
    const region = dato('bodySiteConceptId');
    if (region !== null && regionPorId(region) === undefined) {
      return falla('BODY_SITE_NOT_IN_CATALOG', 'imaging.bodySiteConceptId', 'La región no pertenece al catálogo');
    }
    if (region === null && estudio !== undefined) {
      return falla('BODY_SITE_REQUIRED', 'imaging.bodySiteConceptId', 'El estudio de imagen exige región corporal');
    }
    // V8: lateralidad.
    const lado = dato('lateralityConceptId');
    if (lado !== null && !IDS_DE_LATERALIDAD.has(lado)) {
      return falla('LATERALITY_NOT_IN_CATALOG', 'imaging.lateralityConceptId', 'La lateralidad no pertenece al catálogo');
    }
    if (lado !== null && region === null) {
      return falla('LATERALITY_REQUIRES_BODY_SITE', 'imaging.lateralityConceptId', 'La lateralidad exige una región');
    }
    if (lado !== null && regionPorId(region!)?.paired === false) {
      return falla('LATERALITY_NOT_APPLICABLE', 'imaging.lateralityConceptId', 'La región no es par: no admite lateralidad');
    }
    // V9: contraste.
    const contraste = dato('contrastConceptId');
    if (contraste !== null && !IDS_DE_CONTRASTE.has(contraste)) {
      return falla('CONTRAST_NOT_IN_CATALOG', 'imaging.contrastConceptId', 'El contraste no pertenece al catálogo');
    }
    if (contraste !== null && modalidad === null) {
      return falla('CONTRAST_REQUIRES_MODALITY', 'imaging.contrastConceptId', 'El contraste exige modalidad');
    }
    imagen = { ...IMAGEN_VACIA, modalityConceptId: modalidad, bodySiteConceptId: region, lateralityConceptId: lado, contrastConceptId: contraste };
  }

  return {
    valido: {
      categoryConceptId,
      detalle: {
        family: familia,
        specimenTypeConceptId: specimen,
        components: marcados.map((conceptId, i) => ({ conceptId, ordinal: i + 1 })),
        componentsSpecified: marcados.length > 0,
        imaging: imagen,
      },
    },
  };
}

/* ---- lectura ------------------------------------------------------------- */

function conNombre(id: string | null): string | null {
  return id === null ? null : displayOf(id);
}

/**
 * Lo que la API devuelve del detalle de una orden. Una orden sin detalle
 * guardado (sembrada, o anterior a v4.2.80) es «estudio completo, sin
 * detalle»: `componentsSpecified: false`, sin componentes ni imagen.
 */
export function camposDeDetalle(orderId: string, codeConceptId: string) {
  const d = detallesDeOrden.get(orderId);
  const im = d?.imaging ?? null;
  return {
    requisitionId: d?.requisitionId ?? null,
    codeDisplay: displayOf(codeConceptId),
    specimenTypeConceptId: d?.specimenTypeConceptId ?? null,
    specimenTypeDisplay: conNombre(d?.specimenTypeConceptId ?? null),
    components: (d?.components ?? []).map((c) => ({ ...c, display: displayOf(c.conceptId) })),
    componentsSpecified: d?.componentsSpecified ?? false,
    imaging:
      im === null
        ? null
        : {
            modalityConceptId: im.modalityConceptId,
            modalityDisplay: conNombre(im.modalityConceptId),
            bodySiteConceptId: im.bodySiteConceptId,
            bodySiteDisplay: conNombre(im.bodySiteConceptId),
            lateralityConceptId: im.lateralityConceptId,
            lateralityDisplay: conNombre(im.lateralityConceptId),
            contrastConceptId: im.contrastConceptId,
            contrastDisplay: conNombre(im.contrastConceptId),
          },
  };
}

/**
 * El texto de la celda «Estudio» de la bandeja, como `summaryOf` de la API:
 * «Hemograma · 3 componentes», «Radiografía de mano · Mano · Izquierda · Sin contraste».
 */
export function resumenDeOrden(orderId: string, codeConceptId: string): string {
  const c = camposDeDetalle(orderId, codeConceptId);
  const partes = [c.codeDisplay || 'Estudio'];
  if (c.components.length > 0) {
    partes.push(c.components.length === 1 ? '1 componente' : `${c.components.length} componentes`);
  }
  if (c.imaging !== null) {
    for (const p of [c.imaging.bodySiteDisplay, c.imaging.lateralityDisplay, c.imaging.contrastDisplay]) {
      if (p !== null) partes.push(p);
    }
  }
  return partes.join(' · ');
}

/* ---- antiduplicación con detalle (V10) ----------------------------------- */

/** Lo que distingue un pedido de otro del mismo estudio. */
export interface ClaveDeDetalle {
  readonly bodySiteConceptId?: string | null;
  readonly lateralityConceptId?: string | null;
  readonly componentConceptIds?: readonly string[];
}

/**
 * Si un pedido nuevo repite al informe previo de la orden `ordenPrevia`: en
 * imagen, la misma región y lateralidad; en laboratorio, ningún componente que
 * el previo no cubra (pedir componentes NO cubiertos no es duplicado). Un
 * previo sin detalle repite por código, como antes.
 */
export function repiteElDetalle(ordenPrevia: string | undefined, nuevo: ClaveDeDetalle): boolean {
  const previo = ordenPrevia === undefined ? undefined : detallesDeOrden.get(ordenPrevia);
  if (previo === undefined) return true;
  if (previo.imaging !== null && nuevo.bodySiteConceptId != null) {
    return (
      previo.imaging.bodySiteConceptId === nuevo.bodySiteConceptId &&
      previo.imaging.lateralityConceptId === (nuevo.lateralityConceptId ?? null)
    );
  }
  if (previo.componentsSpecified && (nuevo.componentConceptIds?.length ?? 0) > 0) {
    const cubiertos = new Set(previo.components.map((c) => c.conceptId));
    return nuevo.componentConceptIds!.every((id) => cubiertos.has(id));
  }
  return true;
}

/* ---- alta: cuerpo, clave de duplicado y puente a la bandeja -------------- */

/** El cuerpo de `POST /clinical/service-requests` (lo que el simulador lee de él). */
export interface CuerpoDeAlta extends ItemDeOrden {
  readonly patientProfileId?: string;
  readonly basedOnNoteIds?: unknown;
  readonly priorityConceptId?: string;
  readonly reasonText?: string;
  readonly encounterId?: string;
  readonly formInstanceId?: string;
  readonly performerTenantId?: string;
  readonly previousDiagnosticReportId?: string;
  readonly reusePreviousReport?: boolean;
  readonly duplicateOverrideReason?: string;
}

/** Lo que distingue este pedido de otro del mismo estudio, para la antiduplicación. */
export function claveDeItem(item: ItemDeOrden): ClaveDeDetalle {
  const imagen = (typeof item.imaging === 'object' && item.imaging !== null ? item.imaging : {}) as Record<string, unknown>;
  const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    bodySiteConceptId: texto(imagen['bodySiteConceptId']),
    lateralityConceptId: texto(imagen['lateralityConceptId']),
    componentConceptIds: Array.isArray(item.componentConceptIds) ? (item.componentConceptIds as string[]) : [],
  };
}

/** La fila que la bandeja del ejecutor lee (`LabInboxOrderRecord` de los handlers del circuito). */
export interface FilaDeBandeja {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly requesterProfileId: string;
  readonly requestingTenantId: string;
  readonly performerTenantId: string;
  readonly requestedAt: string;
}

/**
 * Guarda el detalle de una orden recién creada y, si el médico la dirigió a un
 * ejecutor (`performerTenantId`) y es de laboratorio o imagen, la pone en su
 * bandeja (puente B2): sin ejecutor la orden no llega a nadie (D9).
 */
export function guardarDetalleDeOrden(
  orden: {
    readonly id: string;
    readonly patientProfileId: string;
    readonly codeConceptId: string;
    readonly categoryConceptId: string;
    readonly priorityConceptId: string;
    readonly statusConceptId: string;
    readonly requesterProfileId: string;
    readonly createdAt: string;
  },
  valido: ItemValidado,
  destino: {
    readonly requisitionId: string | null;
    readonly performerTenantId: string | undefined;
    readonly requestingTenantId: string;
    readonly agregarABandeja: (fila: FilaDeBandeja) => void;
  },
): void {
  detallesDeOrden.agregar({ id: orden.id, requisitionId: destino.requisitionId, ...valido.detalle });
  const { family } = valido.detalle;
  if (destino.performerTenantId === undefined || (family !== 'LAB' && family !== 'IMAGING')) return;
  destino.agregarABandeja({
    id: orden.id,
    patientProfileId: orden.patientProfileId,
    codeConceptId: orden.codeConceptId,
    categoryConceptId: orden.categoryConceptId,
    priorityConceptId: orden.priorityConceptId,
    // Una orden satisfecha por un informe previo no espera nada del ejecutor.
    statusConceptId:
      orden.statusConceptId === STATUS['ST-SATISFIED-BY-PRIOR'] ? orden.statusConceptId : STATUS['ST-ACTIVE']!,
    requesterProfileId: orden.requesterProfileId,
    requestingTenantId: destino.requestingTenantId,
    performerTenantId: destino.performerTenantId,
    requestedAt: orden.createdAt,
  });
}
