import { orderList, type SimulatedOrder } from '../fixtures/clinic';
import { STATUS } from '../fixtures/concepts';
import { MEDICAL } from '../fixtures/people';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import {
  DUPLICATE_STUDY_WINDOW_DAYS,
  estudioDuplicado,
  estudioPrevio,
  informes,
  labInboxOrders,
} from './diagnostics.handlers';
import { categoriaDeLaOrden, esRechazo, validarNotas } from './service-request-category.mock';
import { pickPerformerFields } from './service-request-performer.mock';
import {
  camposDeDetalle,
  claveDeItem,
  guardarDetalleDeOrden,
  rechazoDeDetalle,
  rechazoDeOrden,
  validarItemDeOrden,
  type ItemDeOrden,
  type ItemValidado,
} from './service-request-detail.mock';

/* ============================================================================
    `POST /clinical/requisitions` y `GET /clinical/service-requests/:id`
    (C4 y C5) en el simulador.

    Una requisición crea un renglón de `orderList` por estudio, todos o
    ninguno: se valida cada renglón (V1-V9 y antiduplicación) antes de escribir
    nada, y el primero que falla responde 422 con `details.itemIndex`.

    ## Idempotency-Key (obligatoria)

    Por usuario + clave. La misma clave con el mismo cuerpo devuelve la misma
    requisición con `replayed: true`; con otro cuerpo, 409
    `REQUISITION_IDEMPOTENCY_KEY_CONFLICT`. Sólo se recuerdan los éxitos.
    ========================================================================== */

const TOPE_DE_RENGLONES = 30;
const MIN_JUSTIFICACION = 20;

interface RenglonDeRequisicion extends ItemDeOrden {
  readonly duplicateDecision?: {
    readonly previousDiagnosticReportId?: string;
    readonly reusePreviousReport?: boolean;
    readonly duplicateOverrideReason?: string;
  };
}

interface CuerpoDeRequisicion {
  readonly patientProfileId?: string;
  readonly encounterId?: string;
  readonly formInstanceId?: string;
  readonly priorityConceptId?: string;
  readonly basedOnNoteIds?: unknown;
  readonly performerTenantId?: string;
  readonly custodianTenantId?: string;
  readonly items?: unknown;
}

const respuestasRecordadas = new Map<string, { readonly huella: string; readonly cuerpo: Record<string, unknown> }>();

/** JSON con las claves ordenadas: el orden en que viajan no cambia la huella. */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

/** Un renglón creado, con la forma de `GET /clinical/service-requests/:id`. */
export function registroDeOrden(orden: SimulatedOrder) {
  const category = categoriaDeLaOrden(orden.categoryConceptId);
  return {
    id: orden.id,
    patientProfileId: orden.patientProfileId,
    formInstanceId: orden.formInstanceId ?? null,
    ...(category === undefined ? {} : { category }),
    basedOnNoteIds: [...(orden.basedOnNoteIds ?? [])],
    status: orden.statusConceptId === STATUS['ST-SATISFIED-BY-PRIOR'] ? 'SATISFIED_BY_PRIOR' : 'ACTIVE',
    intent: 'ORDER',
    ...pickPerformerFields(orden as unknown as Record<string, string>),
    codeConceptId: orden.codeConceptId,
    ...camposDeDetalle(orden.id, orden.codeConceptId),
    createdAt: orden.createdAt,
  };
}

/** Si dos renglones piden lo mismo (V10 dentro de la misma requisición). */
function repiteAlAnterior(a: RenglonDeRequisicion, b: RenglonDeRequisicion): boolean {
  if (a.codeConceptId !== b.codeConceptId) return false;
  const ca = claveDeItem(a);
  const cb = claveDeItem(b);
  if (ca.bodySiteConceptId != null || cb.bodySiteConceptId != null) {
    return ca.bodySiteConceptId === cb.bodySiteConceptId && ca.lateralityConceptId === cb.lateralityConceptId;
  }
  const previos = new Set(ca.componentConceptIds ?? []);
  const nuevos = cb.componentConceptIds ?? [];
  return nuevos.length === 0 || previos.size === 0 || nuevos.some((id) => previos.has(id));
}

function esClinico(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return ['CLINICIAN', 'PRACTITIONER', 'SUPERADMIN'].some((r) => roles.includes(r));
}

export function registrarRequisiciones(router: MockRouter): void {
  router.post('/clinical/requisitions', (request) => {
    if (!esClinico(request)) return forbidden('Pedir estudios requiere rol clínico');
    const key = request.headers.get('Idempotency-Key');
    if (key === null || key.trim() === '' || key !== key.trim() || key.length > 255) {
      return validation('Idempotency-Key inválida', [
        { field: 'Idempotency-Key', message: 'must be a non-empty string without spaces of up to 255 characters' },
      ]);
    }
    const datos = cuerpo<CuerpoDeRequisicion>(request);
    const scope = `${request.user?.id ?? 'anonymous'} ${key}`;
    const huella = canonico(request.body ?? null);
    const previa = respuestasRecordadas.get(scope);
    if (previa !== undefined) {
      if (previa.huella !== huella) {
        return conflict('La clave de idempotencia ya se usó con otra requisición.', {
          reason: 'REQUISITION_IDEMPOTENCY_KEY_CONFLICT',
        });
      }
      return { status: 201, body: { ...previa.cuerpo, replayed: true } };
    }

    if (!Array.isArray(datos.items) || datos.items.length < 1 || datos.items.length > TOPE_DE_RENGLONES) {
      return validation(`items debe traer de 1 a ${TOPE_DE_RENGLONES} estudios.`, [
        { field: 'items', message: `items must contain from 1 to ${TOPE_DE_RENGLONES} elements` },
      ]);
    }
    const renglones = datos.items as RenglonDeRequisicion[];
    if (renglones.some((r) => typeof r !== 'object' || r === null || typeof r.codeConceptId !== 'string')) {
      return validation('Cada estudio necesita codeConceptId.');
    }
    const patientProfileId = datos.patientProfileId ?? '';
    const notas = validarNotas(datos.basedOnNoteIds, patientProfileId, datos.encounterId);
    if (esRechazo(notas)) return rechazoDeOrden(notas);

    // Todo se valida antes de escribir nada: la requisición es atómica.
    const validados: ItemValidado[] = [];
    const reutilizados = new Set<number>();
    for (const [i, renglon] of renglones.entries()) {
      const item = validarItemDeOrden(renglon, i);
      if ('rechazo' in item) return item.rechazo;
      validados.push(item.valido);

      const decision = renglon.duplicateDecision;
      const previoIgual = renglones.findIndex((otro, j) => j < i && repiteAlAnterior(otro, renglon));
      if (decision === undefined && previoIgual >= 0) {
        return preconditionFailed('El estudio se repite dentro de la requisición.', {
          reason: 'DUPLICATE_STUDY_DETECTED',
          itemIndex: i,
          duplicateOfItemIndex: previoIgual,
        });
      }
      const hallado = estudioDuplicado(patientProfileId, renglon.codeConceptId!, DUPLICATE_STUDY_WINDOW_DAYS, claveDeItem(renglon));
      if (decision === undefined) {
        if (hallado !== null) {
          return preconditionFailed('Ya existe un estudio igual reciente.', {
            reason: 'DUPLICATE_STUDY_DETECTED',
            itemIndex: i,
            previousStudy: estudioPrevio(hallado.informe, hallado.performedAt, request.user),
          });
        }
        continue;
      }
      const reutiliza = decision.reusePreviousReport === true;
      const justificacion = decision.duplicateOverrideReason;
      if (reutiliza === (justificacion !== undefined) || (justificacion !== undefined && justificacion.trim().length < MIN_JUSTIFICACION)) {
        return validation(
          `duplicateDecision: reutilizá el informe previo o justificá la repetición (mínimo ${MIN_JUSTIFICACION} caracteres), no ambas.`,
        );
      }
      const previo = informes.get(decision.previousDiagnosticReportId ?? '');
      if (previo === undefined || previo.patientProfileId !== patientProfileId) {
        return rechazoDeDetalle('DUPLICATE_STUDY_NOT_FOUND', 'duplicateDecision.previousDiagnosticReportId', 'El informe previo no existe', i);
      }
      if (hallado?.informe.id !== previo.id) {
        return rechazoDeDetalle('DUPLICATE_STUDY_MISMATCH', 'duplicateDecision.previousDiagnosticReportId', 'El informe previo ya no es el que satisface el pedido', i);
      }
      if (reutiliza) reutilizados.add(i);
    }

    const requisitionId = nuevoId('requisition');
    const creadaEn = ahora();
    const tenant = datos.custodianTenantId ?? request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? TENANT_CLINICA;
    const items = renglones.map((renglon, i) => {
      const valido = validados[i]!;
      const decision = renglon.duplicateDecision;
      const orden = orderList.agregar({
        id: nuevoId('order'),
        patientProfileId,
        codeConceptId: renglon.codeConceptId!,
        categoryConceptId: valido.categoryConceptId ?? '',
        ...(notas.noteIds.length === 0 ? {} : { basedOnNoteIds: notas.noteIds }),
        priorityConceptId: datos.priorityConceptId ?? '',
        statusConceptId: reutilizados.has(i) ? STATUS['ST-SATISFIED-BY-PRIOR']! : STATUS['ST-PENDING']!,
        requesterProfileId: request.user?.practitionerProfileId ?? MEDICAL.id,
        ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
        ...(datos.formInstanceId === undefined ? {} : { formInstanceId: datos.formInstanceId }),
        reasonText: '',
        createdAt: creadaEn,
        ...pickPerformerFields(request.body as Record<string, string>),
        ...(decision === undefined
          ? {}
          : {
              previousDiagnosticReportId: decision.previousDiagnosticReportId!,
              ...(decision.duplicateOverrideReason === undefined ? {} : { duplicateOverrideReason: decision.duplicateOverrideReason }),
            }),
      });
      guardarDetalleDeOrden(orden, valido, {
        requisitionId,
        performerTenantId: datos.performerTenantId,
        requestingTenantId: tenant,
        agregarABandeja: (fila) => labInboxOrders.agregar(fila),
      });
      return registroDeOrden(orden);
    });

    const cuerpoCreado = { requisitionId, replayed: false, items };
    respuestasRecordadas.set(scope, { huella, cuerpo: cuerpoCreado });
    return reply(201, cuerpoCreado);
  });

  router.get('/clinical/service-requests/:id', (request) => {
    if (!esClinico(request)) return forbidden('Leer una orden requiere rol clínico');
    const orden = orderList.get(request.params['id']!);
    if (orden === undefined) return notFound('La orden de servicio no existe');
    return registroDeOrden(orden);
  });
}
