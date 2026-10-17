import type {
  BranchQaCase,
  BranchResult,
  FlowBranch,
  FlowBranchKind,
  FlowCoverage,
  FlowDetail,
  FlowEndpoint,
  FlowNode,
  FlowQaSummary,
  FlowSummary,
} from '../../data-access/admin-portal/flows.types';
import { notFound, reply, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    Backend simulado del catálogo de flujos (`/admin/qa/flows*`).

    Reproduce las reglas de la API real: la lista trae resumen + módulos; el
    detalle trae el árbol en orden de recorrido con el padre de cada nodo; un
    `coverage` desconocido es 400 y un flujo inexistente 404; nunca hay cuerpos
    ni cabeceras de los casos. Hay dos flujos de muestra: el 2.7 (con y sin
    seguro, sin sembrar) y el 1.3 (sembrado, con una rama fallida).
    ========================================================================== */

const OBSERVADO = '2026-10-17';
const SIN_CASO_JOURNEY =
  'Journey con variable: necesita un identificador producido por el paso anterior y el runner aún no encadena respuestas.';
const SIN_CASO_DECISION = 'Decisión del recorrido: no llama a la API; sus caminos se prueban en los nodos a los que lleva.';
const SIN_ENDPOINT = 'Sin endpoint en el contrato: no hay qué probar.';

const COVERAGE: ReadonlySet<string> = new Set<FlowCoverage>(['SEEDED', 'NOT_SEEDED', 'RAN', 'NEVER_RAN']);

interface CasoBase {
  code: string;
  method: string;
  path: string;
  status: number;
  seeded: boolean;
  result?: BranchResult;
}

function caso(c: CasoBase): BranchQaCase {
  return {
    code: c.code,
    method: c.method,
    path: c.path,
    expectedStatus: c.status,
    observedOn: OBSERVADO,
    seeded: c.seeded,
    caseId: c.seeded ? `case-${c.code}` : null,
    drifted: false,
    lastResult: c.result ?? null,
  };
}

function rama(
  kind: FlowBranchKind,
  condition: string,
  expected: string,
  destino: { next?: string; loopsTo?: string },
  qaCase: BranchQaCase | null,
  reason: string | null = null,
): FlowBranch {
  return { kind, condition, expected, next: destino.next ?? null, loopsTo: destino.loopsTo ?? null, reason: qaCase ? null : reason, qaCase };
}

function nodo(
  id: string,
  parentId: string | null,
  kind: FlowNode['kind'],
  title: string,
  actor: string,
  sourceRef: string,
  branches: readonly FlowBranch[],
  extra: { endpoint?: FlowEndpoint; gap?: string; uiRoute?: string; effects?: readonly string[] } = {},
): FlowNode {
  return {
    id,
    parentId,
    kind,
    title,
    actor,
    uiRoute: extra.uiRoute ?? null,
    endpoint: extra.endpoint ?? null,
    gap: extra.gap ?? null,
    effects: extra.effects ?? [],
    sourceRef,
    branches,
  };
}

const declarado = (method: string, path: string, operationId: string): FlowEndpoint => ({ method, path, operationId, contract: 'DECLARED' });
const ausente = (method: string, path: string): FlowEndpoint => ({ method, path, operationId: null, contract: 'MISSING' });

const GAP_QR =
  'No se encontró un endpoint que emita un QR por un monto de consulta. Lo más cercano: `POST /payments/checkout-sessions` y `PUT /practitioners/me/sites/{siteId}/bank-qr`.';
const U = '00000000-0000-4000-8000-0000000000aa';

/** Qué casos se sembraron y qué corrió, para que la pantalla muestre todos los estados. */
function qa(
  flowId: string,
  nodes: readonly FlowNode[],
  opciones: { seeded: boolean; lastRun: FlowQaSummary['lastRun'] },
): FlowQaSummary {
  const casos = nodes.flatMap((n) => n.branches.map((b) => b.qaCase).filter((c): c is BranchQaCase => c !== null));
  const linked = casos.filter((c) => c.seeded).length;
  const veredictos = casos.map((c) => c.lastResult?.status);
  return {
    suiteCode: `FLOW-${flowId}`,
    suiteId: opciones.seeded ? `suite-${flowId}` : null,
    seeded: opciones.seeded,
    casesExpected: casos.length,
    casesLinked: linked,
    casesMissing: casos.length - linked,
    branchesNotRunnable: nodes.flatMap((n) => n.branches).filter((b) => b.qaCase === null).length,
    passed: veredictos.filter((s) => s === 'RESULT_PASSED').length,
    failed: veredictos.filter((s) => s === 'RESULT_FAILED').length,
    lastRun: opciones.lastRun,
  };
}

function detalle(base: Omit<FlowDetail, 'counts' | 'contract' | 'qa'>, opciones: Parameters<typeof qa>[2]): FlowDetail {
  const ramas = base.nodes.flatMap((n) => n.branches);
  const porTipo = (k: FlowBranchKind) => ramas.filter((b) => b.kind === k).length;
  const endpoints = base.nodes.filter((n) => n.endpoint);
  const declared = endpoints.filter((n) => n.endpoint?.contract === 'DECLARED').length;
  const gaps = base.nodes.filter((n) => n.gap !== null).length;
  return {
    ...base,
    counts: {
      nodes: base.nodes.length,
      apiCalls: base.nodes.filter((n) => n.kind === 'API_CALL').length,
      gaps,
      branches: { HAPPY_PATH: porTipo('HAPPY_PATH'), EDGE: porTipo('EDGE'), NEGATIVE: porTipo('NEGATIVE') },
      withCase: ramas.filter((b) => b.qaCase).length,
      withoutCase: ramas.filter((b) => !b.qaCase).length,
    },
    contract: { endpoints: endpoints.length, declared, missing: endpoints.length - declared, gaps },
    qa: qa(base.id, base.nodes, opciones),
  };
}

const REGISTRO = { document: 'SALUD/📋 Registro de procesos por módulo.md' };

const FLUJO_27: FlowDetail = detalle(
  {
    id: '2.7',
    module: '2 · Médico',
    title: 'Facturación y/o pago por la consulta médica',
    source: { ...REGISTRO, section: '2.7 · Facturación y/o pago por la consulta medica' },
    actors: ['PRACTITIONER', 'PATIENT', 'INSURER'],
    frontRoutes: ['/medical-records/:profileId/consultation'],
    root: 'decidir-seguro',
    openQuestions: [
      'Quién adjudica la autorización del seguro y si AloVida es la pasarela de pagos son decisiones que no son del equipo; el QR depende de la segunda.',
      'La fuente no dice cómo la app sabe si el paciente tiene seguro ni de dónde sale el monto del coaseguro.',
    ],
    nodes: [
      nodo('decidir-seguro', null, 'DECISION', '¿El paciente tiene seguro?', 'PRACTITIONER', 'ítems 1 y 2', [
        rama('HAPPY_PATH', 'El paciente no tiene seguro (simulación 1)', 'El QR es por el monto total de la consulta', { next: 'qr-monto-total' }, null, SIN_CASO_DECISION),
        rama('EDGE', 'El paciente tiene seguro (simulación 2)', 'El QR es sólo por el coaseguro', { next: 'qr-coaseguro' }, null, SIN_CASO_DECISION),
      ]),
      nodo('qr-monto-total', 'decidir-seguro', 'API_CALL', 'Emitir un QR por el monto total', 'PRACTITIONER', 'ítem 1.1', [
        rama('HAPPY_PATH', 'El médico emite el cobro', 'El paciente ve un QR por el monto total', { next: 'registrar-pago' }, null, SIN_ENDPOINT),
      ], { gap: GAP_QR }),
      nodo('registrar-pago', 'qr-monto-total', 'API_CALL', 'Registrar el pago del paciente', 'PATIENT', 'ítems 1.2 y 2.2', [
        rama('HAPPY_PATH', 'El cobro existe y el paciente pagó', 'Queda el pago y el paciente recibe un aviso', { next: 'quiere-factura' }, null, SIN_CASO_JOURNEY),
        rama(
          'NEGATIVE',
          'Falta el cuerpo del pago',
          'Rechaza la petición (400)',
          { loopsTo: 'registrar-pago' },
          caso({ code: 'FLOW-2.7-registrar-pago-NEGATIVE-01', method: 'POST', path: `/billing/simulated/charges/${U}/payment`, status: 400, seeded: false }),
        ),
      ], { endpoint: declarado('POST', '/billing/simulated/charges/{chargeId}/payment', 'BillingSimulatedController_registerPayment') }),
      nodo('quiere-factura', 'registrar-pago', 'DECISION', '¿El paciente quiere factura?', 'PATIENT', 'ítems 1.2 y 1.3', [
        rama('HAPPY_PATH', 'No quiere factura', 'Recibe sólo un comprobante de pago en su app', { next: 'tiene-seguro' }, null, SIN_CASO_DECISION),
        rama('EDGE', 'Quiere factura', 'Se piden NIT y razón social', { next: 'emitir-factura' }, null, SIN_CASO_DECISION),
      ]),
      nodo('emitir-factura', 'quiere-factura', 'API_CALL', 'Emitir la factura', 'PRACTITIONER', 'ítem 1.3.3', [
        rama('HAPPY_PATH', 'Hay NIT y razón social', 'Emite la factura al NIT', { next: 'tiene-seguro' }, null, SIN_CASO_JOURNEY),
        rama(
          'NEGATIVE',
          'Falta el cuerpo de la factura',
          'Rechaza la petición (400)',
          { loopsTo: 'emitir-factura' },
          caso({ code: 'FLOW-2.7-emitir-factura-NEGATIVE-01', method: 'POST', path: `/billing/simulated/charges/${U}/invoices`, status: 400, seeded: false }),
        ),
      ], { endpoint: declarado('POST', '/billing/simulated/charges/{chargeId}/invoices', 'BillingSimulatedController_issueInvoice') }),
      nodo('tiene-seguro', 'quiere-factura', 'DECISION', '¿Falta cobrar a la aseguradora?', 'PRACTITIONER', 'ítem 2.4', [
        rama('HAPPY_PATH', 'El paciente no tiene seguro', 'No hay nada más que cobrar', { next: 'fin-sin-seguro' }, null, SIN_CASO_DECISION),
        rama('EDGE', 'El paciente tiene seguro', 'Se factura a la aseguradora el monto restante', { next: 'reclamo-aseguradora' }, null, SIN_CASO_DECISION),
      ]),
      nodo('fin-sin-seguro', 'tiene-seguro', 'OUTCOME', 'Consulta cobrada (paciente sin seguro)', 'PRACTITIONER', 'ítem 1', []),
      nodo('reclamo-aseguradora', 'tiene-seguro', 'API_CALL', 'Facturar el monto restante a la aseguradora', 'PRACTITIONER', 'ítem 2.4', [
        rama('HAPPY_PATH', 'Hay coaseguro pagado y monto restante', 'Crea el reclamo con el detalle del paciente', { next: 'fin-con-seguro' }, null, SIN_CASO_JOURNEY),
        rama(
          'NEGATIVE',
          'Falta el cuerpo del reclamo',
          'Rechaza la petición (400)',
          { loopsTo: 'reclamo-aseguradora' },
          caso({ code: 'FLOW-2.7-reclamo-aseguradora-NEGATIVE-01', method: 'POST', path: '/insurance-claims', status: 400, seeded: false }),
        ),
      ], { endpoint: declarado('POST', '/insurance-claims', 'InsuranceClaimsController_create') }),
      nodo('fin-con-seguro', 'reclamo-aseguradora', 'OUTCOME', 'Consulta cobrada y facturada a la aseguradora', 'PRACTITIONER', 'ítem 2', []),
      nodo('qr-coaseguro', 'decidir-seguro', 'API_CALL', 'Emitir un QR por el monto del coaseguro', 'PRACTITIONER', 'ítem 2.1', [
        rama('HAPPY_PATH', 'El médico emite el cobro', 'El paciente ve un QR por el coaseguro', { next: 'registrar-pago' }, null, SIN_ENDPOINT),
      ], { gap: GAP_QR }),
    ],
  },
  { seeded: false, lastRun: null },
);

const FLUJO_13: FlowDetail = detalle(
  {
    id: '1.3',
    module: '1 · Paciente',
    title: 'Agendar hora para consultas médicas',
    source: { ...REGISTRO, section: '1.3 · Agendar Hora para Consultas Medicas' },
    actors: ['PATIENT', 'PRACTITIONER', 'SYSTEM'],
    frontRoutes: ['/directory', '/my-account/appointments'],
    root: 'buscar-api',
    openQuestions: ['El ítem 6 («Datos de la facturación…») no dice quién carga los datos ni cuándo; se ubicó después de confirmar.'],
    nodes: [
      nodo('buscar-api', null, 'API_CALL', 'Listar médicos disponibles', 'PATIENT', 'ítem 1', [
        rama(
          'HAPPY_PATH',
          'Hay médicos que cumplen el filtro',
          'Devuelve la lista paginada',
          { next: 'ver-disponibilidad' },
          caso({
            code: 'FLOW-1.3-buscar-api-HAPPY_PATH-01',
            method: 'GET',
            path: '/public/search/practitioners',
            status: 200,
            seeded: true,
            result: { runId: 'run-1', runNumber: 'R-0001', status: 'RESULT_PASSED', observedStatus: 200, message: null, finishedAt: '2026-10-17T10:00:00.000Z' },
          }),
        ),
      ], { endpoint: declarado('GET', '/public/search/practitioners', 'DirectoryController_search'), uiRoute: '/directory' }),
      nodo('ver-disponibilidad', 'buscar-api', 'API_CALL', 'Consultar cupos disponibles', 'PATIENT', 'ítem 3', [
        rama('HAPPY_PATH', 'Hay una ventana de fechas válida', 'Devuelve los cupos de la ventana', { next: 'fin-agendada' }, null, SIN_CASO_JOURNEY),
        rama(
          'NEGATIVE',
          'Faltan from y to',
          'Rechaza la petición (400)',
          { loopsTo: 'buscar-api' },
          caso({
            code: 'FLOW-1.3-ver-disponibilidad-NEGATIVE-01',
            method: 'GET',
            path: '/scheduling/slots',
            status: 400,
            seeded: true,
            result: { runId: 'run-1', runNumber: 'R-0001', status: 'RESULT_FAILED', observedStatus: 200, message: 'Se esperaba 400', finishedAt: '2026-10-17T10:00:00.000Z' },
          }),
        ),
      ], // Ausente a propósito: la maqueta tiene que poder mostrar el estado «no existe en el contrato».
      { endpoint: ausente('GET', '/scheduling/slots'), uiRoute: '/my-account/appointments' }),
      nodo('fin-agendada', 'ver-disponibilidad', 'OUTCOME', 'Cita agendada', 'PATIENT', 'ítems 3, 5 y 6', []),
    ],
  },
  { seeded: true, lastRun: { id: 'run-1', runNumber: 'R-0001', status: 'RUN_FAILED_STATUS', finishedAt: '2026-10-17T10:00:00.000Z' } },
);

const FLUJOS: readonly FlowDetail[] = [FLUJO_13, FLUJO_27];

function resumen(flujo: FlowDetail): FlowSummary {
  const { id, module, title, source, actors, frontRoutes, counts, contract, qa: cobertura } = flujo;
  return { id, module, title, source, actors, frontRoutes, counts, contract, qa: cobertura };
}

export function registrarFlujos(router: MockRouter): void {
  router.get('/admin/qa/flows', (req: MockRequest) => {
    const coverage = req.query.get('coverage');
    if (coverage && !COVERAGE.has(coverage)) {
      return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Error de validación', error: 'Bad Request' });
    }
    const modulo = req.query.get('module');
    const texto = req.query.get('search')?.trim().toLowerCase();
    const items = FLUJOS.filter((f) => (!modulo || f.module === modulo) && (!texto || `${f.id} ${f.title} ${f.module}`.toLowerCase().includes(texto)))
      .map(resumen)
      .filter((f) => {
        switch (coverage) {
          case 'SEEDED':
            return f.qa.seeded;
          case 'NOT_SEEDED':
            return !f.qa.seeded;
          case 'RAN':
            return f.qa.lastRun !== null;
          case 'NEVER_RAN':
            return f.qa.lastRun === null;
          default:
            return true;
        }
      });
    return { items, modules: [...new Set(FLUJOS.map((f) => f.module))].sort() };
  });

  router.get('/admin/qa/flows/:flowId', (req: MockRequest) => {
    const flujo = FLUJOS.find((f) => f.id === req.params['flowId']);
    return flujo ?? notFound('Flujo no encontrado');
  });
}
