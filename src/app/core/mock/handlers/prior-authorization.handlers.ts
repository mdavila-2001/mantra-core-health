import { PACIENTES } from '../fixtures/personas';
import { forbidden, reply, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, texto, uuid } from '../mock-store';
import { perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Solicitudes de aprobación (autorización previa) del lado de la aseguradora
    — registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
    órdenes de Aprobación».

    Mismo contrato que la API real:
      GET  /prior-authorization-requests/inbox?status=PENDING|DETERMINED
      GET  /prior-authorization-requests/:id
      POST /prior-authorization-requests/:id/determinations  { items: [...] }

    Mismas reglas: sólo la aseguradora ve y decide; cada ítem se decide
    exactamente una vez; NO APROBADO exige la cláusula; la decisión global la
    deriva el servidor; una solicitud ya determinada no admite otra.
    ========================================================================== */

interface ItemSimulado {
  readonly id: string;
  readonly sequence: number;
  readonly description: string;
  readonly requestedQuantity: string;
  readonly requestedAmount: string;
  readonly decision: {
    readonly decision: 'APPROVED' | 'DENIED';
    readonly approvedQuantity: string | null;
    readonly approvedAmount: string | null;
    readonly policyClauseReference: string | null;
    readonly denialRationale: string | null;
    readonly decidedAt: string;
  } | null;
}

interface SolicitudSimulada {
  readonly id: string;
  readonly origin: 'PHARMACY' | 'DIAGNOSTIC' | 'GENERIC';
  readonly status: 'SUBMITTED' | 'IN_REVIEW' | 'DETERMINED';
  readonly decision: 'APPROVED' | 'DENIED' | 'PARTIAL' | null;
  readonly pacienteIndice: number;
  readonly planName: string;
  readonly submittedAt: string;
  readonly decidedAt: string | null;
  readonly items: readonly ItemSimulado[];
}

function item(
  solicitud: string,
  sequence: number,
  description: string,
  requestedQuantity: string,
  requestedAmount: string,
): ItemSimulado {
  return {
    id: uuid(`pa-item-${solicitud}-${sequence}`),
    sequence,
    description,
    requestedQuantity,
    requestedAmount,
    decision: null,
  };
}

const SOLICITUDES: readonly SolicitudSimulada[] = [
  {
    id: uuid('pa-receta-1'),
    origin: 'PHARMACY',
    status: 'SUBMITTED',
    decision: null,
    pacienteIndice: 0,
    planName: 'Andina Integral',
    submittedAt: iso(0, 8, 40),
    decidedAt: null,
    items: [
      item('receta-1', 1, 'Amoxicilina 500 mg', '21', '84.00'),
      item('receta-1', 2, 'Ibuprofeno 400 mg', '20', '36.00'),
      item('receta-1', 3, 'Omeprazol 20 mg', '14', '42.00'),
      item('receta-1', 4, 'Loratadina 10 mg', '10', '25.00'),
      item('receta-1', 5, 'Vitamina C 1 g efervescente', '10', '48.00'),
    ],
  },
  {
    id: uuid('pa-lab-1'),
    origin: 'DIAGNOSTIC',
    status: 'SUBMITTED',
    decision: null,
    pacienteIndice: 1,
    planName: 'Andina Familiar',
    submittedAt: iso(0, 7, 15),
    decidedAt: null,
    items: [item('lab-1', 1, 'Hemograma completo', '1', '120.00')],
  },
  {
    id: uuid('pa-imagen-1'),
    origin: 'DIAGNOSTIC',
    status: 'SUBMITTED',
    decision: null,
    pacienteIndice: 2,
    planName: 'Andina Oro',
    submittedAt: iso(-1, 16, 5),
    decidedAt: null,
    items: [item('imagen-1', 1, 'Resonancia magnética de rodilla', '1', '1450.00')],
  },
  {
    id: uuid('pa-receta-2'),
    origin: 'PHARMACY',
    status: 'DETERMINED',
    decision: 'PARTIAL',
    pacienteIndice: 3,
    planName: 'Andina Integral',
    submittedAt: iso(-3, 10),
    decidedAt: iso(-3, 10, 12),
    items: [
      {
        ...item('receta-2', 1, 'Metformina 850 mg', '60', '90.00'),
        decision: {
          decision: 'APPROVED',
          approvedQuantity: '60',
          approvedAmount: '90.00',
          policyClauseReference: null,
          denialRationale: null,
          decidedAt: iso(-3, 10, 12),
        },
      },
      {
        ...item('receta-2', 2, 'Colágeno hidrolizado', '1', '210.00'),
        decision: {
          decision: 'DENIED',
          approvedQuantity: null,
          approvedAmount: null,
          policyClauseReference: 'Cláusula 9.2 — suplementos nutricionales excluidos',
          denialRationale: 'El plan no cubre suplementos sin indicación terapéutica.',
          decidedAt: iso(-3, 10, 12),
        },
      },
    ],
  },
];

const solicitudes = new Coleccion<SolicitudSimulada>(SOLICITUDES).persistirEn(
  'mock.insurance.autorizaciones',
);

/** Suma exacta de importes con dos decimales, en centavos. */
function sumar(importes: readonly string[]): string {
  const centavos = importes.reduce(
    (total, importe) => total + Math.round(Number(importe) * 100),
    0,
  );
  return (centavos / 100).toFixed(2);
}

function resumen(s: SolicitudSimulada) {
  const paciente = PACIENTES[s.pacienteIndice % PACIENTES.length]!;
  return {
    id: s.id,
    origin: s.origin,
    status: s.status,
    decision: s.decision,
    patient: {
      id: paciente.id,
      displayName: paciente.displayName,
      patientCode: paciente.patientCode,
      memberIdentifier: `AND-${paciente.patientCode}`,
    },
    planName: s.planName,
    currencyCode: 'BOB',
    itemCount: s.items.length,
    totalRequestedAmount: sumar(s.items.map((i) => i.requestedAmount)),
    submittedAt: s.submittedAt,
  };
}

function detalle(s: SolicitudSimulada) {
  return { ...resumen(s), decidedAt: s.decidedAt, items: s.items };
}

/** Como la API: `PreconditionFailedException` sale con 422 y `PRECONDITION_FAILED`. */
function precondicion(message: string) {
  return reply(422, {
    statusCode: 422,
    code: 'PRECONDITION_FAILED',
    message,
    error: 'Unprocessable Entity',
  });
}

interface DecisionEntrante {
  readonly priorAuthorizationItemId?: unknown;
  readonly decision?: unknown;
  readonly policyClauseReference?: unknown;
  readonly denialRationale?: unknown;
}

export function registrarAutorizacionesPrevias(router: MockRouter): void {
  router.get('/prior-authorization-requests/inbox', (request) => {
    if (!perteneceALaAseguradora(request)) return forbidden();
    const status = texto(request.query, 'status');
    const filas = solicitudes
      .todos()
      .filter((s) =>
        status === 'PENDING'
          ? s.status !== 'DETERMINED'
          : status === 'DETERMINED'
            ? s.status === 'DETERMINED'
            : true,
      )
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { items: filas.map(resumen) };
  });

  router.get('/prior-authorization-requests/:id', (request) => {
    if (!perteneceALaAseguradora(request)) return forbidden();
    const s = solicitudes.get(request.params['id']!);
    // Ajena o inexistente: el mismo 403, como la API.
    if (s === undefined) return forbidden('No hay acceso a esa solicitud de seguro');
    return detalle(s);
  });

  router.post('/prior-authorization-requests/:id/determinations', (request) => {
    if (!perteneceALaAseguradora(request)) return forbidden();
    const s = solicitudes.get(request.params['id']!);
    if (s === undefined) return forbidden('No hay acceso a esa solicitud de seguro');
    if (s.status === 'DETERMINED') {
      return precondicion('La solicitud no admite determinación en su estado actual');
    }
    const body = cuerpo<{ items?: readonly DecisionEntrante[] }>(request);
    const entrantes = body.items ?? [];
    // Mismas validaciones que el DTO de la API (400 VALIDATION_FAILED): si el
    // mock fuera más permisivo, un cuerpo mal armado pasaría acá y fallaría
    // contra el servidor real.
    const invalido = (message: string) =>
      reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message, error: 'Bad Request' });
    if (entrantes.some((d) => d.decision !== 'APPROVED' && d.decision !== 'DENIED')) {
      return invalido('decision debe ser APPROVED o DENIED');
    }
    const sinClausula = entrantes.some(
      (d) =>
        d.decision === 'DENIED' &&
        (typeof d.policyClauseReference !== 'string' || d.policyClauseReference.trim() === ''),
    );
    if (sinClausula) {
      return invalido('La referencia de cláusula contractual es obligatoria al denegar un ítem');
    }
    if (
      entrantes.some(
        (d) =>
          (typeof d.policyClauseReference === 'string' && d.policyClauseReference.length > 255) ||
          (typeof d.denialRationale === 'string' && d.denialRationale.length > 4000),
      )
    ) {
      return invalido('La cláusula admite hasta 255 caracteres y la justificación hasta 4000');
    }
    const porItem = new Map(entrantes.map((d) => [d.priorAuthorizationItemId, d]));
    if (
      porItem.size !== entrantes.length ||
      entrantes.length !== s.items.length ||
      s.items.some((i) => !porItem.has(i.id))
    ) {
      return precondicion('La determinación debe decidir todos los ítems de la solicitud');
    }
    const decididoEn = ahora();
    const items = s.items.map((i): ItemSimulado => {
      const d = porItem.get(i.id)!;
      const aprobado = d.decision === 'APPROVED';
      return {
        ...i,
        decision: {
          decision: aprobado ? 'APPROVED' : 'DENIED',
          approvedQuantity: aprobado ? i.requestedQuantity : null,
          approvedAmount: aprobado ? i.requestedAmount : null,
          policyClauseReference: aprobado ? null : String(d.policyClauseReference).trim(),
          denialRationale:
            !aprobado && typeof d.denialRationale === 'string' && d.denialRationale.trim() !== ''
              ? d.denialRationale.trim()
              : null,
          decidedAt: decididoEn,
        },
      };
    });
    const aprobados = items.filter((i) => i.decision?.decision === 'APPROVED').length;
    const decision =
      aprobados === items.length ? 'APPROVED' : aprobados === 0 ? 'DENIED' : 'PARTIAL';
    solicitudes.actualizar(s.id, { status: 'DETERMINED', decision, decidedAt: decididoEn, items });
    return { status: 201, body: { id: uuid(`pa-det-${s.id}`) } };
  });
}

/** Sólo para pruebas: vuelve la bandeja al fixture. */
export function reiniciarAutorizacionesPrevias(): void {
  for (const s of solicitudes.todos()) solicitudes.borrar(s.id);
  for (const s of SOLICITUDES) solicitudes.agregar(s);
}

