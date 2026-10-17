import type {
  BranchQaCase,
  FlowBranch,
  FlowDetail,
  FlowNode,
  FlowSummary,
} from '../../../core/data-access/admin-portal/flows.types';

/** Datos de prueba de las pantallas del catálogo de flujos: un árbol pequeño pero con todos los casos. */

export function caso(sobrescribir: Partial<BranchQaCase> = {}): BranchQaCase {
  return {
    code: 'FLOW-9.9-paso-HAPPY_PATH-01',
    method: 'GET',
    path: '/cosas',
    expectedStatus: 200,
    observedOn: '2026-10-17',
    seeded: true,
    caseId: 'c-1',
    drifted: false,
    lastResult: null,
    ...sobrescribir,
  };
}

export function rama(sobrescribir: Partial<FlowBranch> = {}): FlowBranch {
  return {
    kind: 'HAPPY_PATH',
    condition: 'Todo en orden',
    expected: 'Sigue',
    next: null,
    loopsTo: null,
    reason: 'Decisión del recorrido.',
    qaCase: null,
    ...sobrescribir,
  };
}

export function nodo(id: string, sobrescribir: Partial<FlowNode> = {}): FlowNode {
  return {
    id,
    parentId: null,
    kind: 'API_CALL',
    title: `Paso ${id}`,
    actor: 'PATIENT',
    uiRoute: null,
    endpoint: null,
    gap: null,
    effects: [],
    sourceRef: 'ítem 1',
    branches: [],
    ...sobrescribir,
  };
}

/**
 * Raíz `decidir` (decisión) → rama «sin seguro» a `cobrar` (llamada declarada, con un caso
 * fallido y otro que pasó) y rama «con seguro» a `reclamo` (llamada AUSENTE del contrato)
 * → ambas convergen en `fin`, que se dibuja una vez. `cobrar` tiene un reintento hacia `decidir`.
 */
export function flujo(sobrescribir: Partial<FlowDetail> = {}): FlowDetail {
  const nodes: FlowNode[] = [
    nodo('decidir', {
      kind: 'DECISION',
      title: '¿Tiene seguro?',
      branches: [
        rama({ kind: 'HAPPY_PATH', condition: 'Sin seguro', expected: 'Cobra el total', next: 'cobrar' }),
        rama({ kind: 'EDGE', condition: 'Con seguro', expected: 'Cobra el coaseguro', next: 'reclamo' }),
      ],
    }),
    nodo('cobrar', {
      parentId: 'decidir',
      title: 'Cobrar',
      endpoint: { method: 'POST', path: '/cobros/{id}', operationId: 'CobrosController_pagar', contract: 'DECLARED' },
      branches: [
        rama({
          kind: 'HAPPY_PATH',
          condition: 'Cobro existente',
          expected: 'Queda pagado',
          next: 'fin',
          reason: 'Journey con variable.',
        }),
        rama({
          kind: 'NEGATIVE',
          condition: 'Falta el cuerpo',
          expected: 'Rechaza (400)',
          loopsTo: 'decidir',
          reason: null,
          qaCase: caso({
            code: 'FLOW-9.9-cobrar-NEGATIVE-01',
            method: 'POST',
            path: '/cobros/00000000-0000-4000-8000-0000000000aa',
            expectedStatus: 400,
            lastResult: { runId: 'r-1', runNumber: 'R-0001', status: 'RESULT_FAILED', observedStatus: 200, message: 'Se esperaba 400', finishedAt: '2026-10-17T10:00:00.000Z' },
          }),
        }),
        rama({
          kind: 'EDGE',
          condition: 'Id inexistente',
          expected: 'Responde 404',
          loopsTo: 'decidir',
          reason: null,
          qaCase: caso({
            code: 'FLOW-9.9-cobrar-EDGE-01',
            method: 'POST',
            path: '/cobros/00000000-0000-4000-8000-0000000000bb',
            expectedStatus: 404,
            lastResult: { runId: 'r-1', runNumber: 'R-0001', status: 'RESULT_PASSED', observedStatus: 404, message: null, finishedAt: '2026-10-17T10:00:00.000Z' },
          }),
        }),
      ],
    }),
    nodo('fin', { parentId: 'cobrar', kind: 'OUTCOME', title: 'Consulta cobrada' }),
    nodo('reclamo', {
      parentId: 'decidir',
      title: 'Reclamar a la aseguradora',
      endpoint: { method: 'POST', path: '/reclamos', operationId: null, contract: 'MISSING' },
      branches: [rama({ kind: 'HAPPY_PATH', condition: 'Hay coaseguro', expected: 'Crea el reclamo', next: 'fin' })],
    }),
    nodo('qr', {
      parentId: 'reclamo',
      title: 'Emitir QR por el monto',
      gap: 'No se encontró un endpoint que emita un QR por un monto de consulta.',
      branches: [rama({ kind: 'HAPPY_PATH', condition: 'Médico emite', expected: 'Paciente ve el QR', next: 'fin', reason: 'Sin endpoint en el contrato.' })],
    }),
  ];
  // `reclamo` lleva a `qr`; así `fin` queda como destino de tres ramas y sólo se dibuja bajo `cobrar`.
  nodes[3] = { ...nodes[3], branches: [rama({ kind: 'HAPPY_PATH', condition: 'Hay coaseguro', expected: 'Crea el reclamo', next: 'qr' })] };
  return {
    id: '9.9',
    module: '9 · Prueba',
    title: 'Cobrar la consulta',
    source: { document: 'SALUD/📋 Registro de procesos por módulo.md', section: '9.9 · Cobro' },
    actors: ['PRACTITIONER', 'PATIENT'],
    frontRoutes: ['/cobros'],
    root: 'decidir',
    openQuestions: ['Quién adjudica la autorización del seguro.'],
    counts: { nodes: nodes.length, apiCalls: 3, gaps: 1, branches: { HAPPY_PATH: 4, EDGE: 2, NEGATIVE: 1 }, withCase: 2, withoutCase: 5 },
    contract: { endpoints: 2, declared: 1, missing: 1, gaps: 1 },
    qa: {
      suiteCode: 'FLOW-9.9',
      suiteId: 's-1',
      seeded: true,
      casesExpected: 2,
      casesLinked: 2,
      casesMissing: 0,
      branchesNotRunnable: 5,
      passed: 1,
      failed: 1,
      lastRun: { id: 'r-1', runNumber: 'R-0001', status: 'RUN_FAILED_STATUS', finishedAt: '2026-10-17T10:00:00.000Z' },
    },
    nodes,
    ...sobrescribir,
  };
}

export function resumenDe(f: FlowDetail = flujo()): FlowSummary {
  const { id, module, title, source, actors, frontRoutes, counts, contract, qa } = f;
  return { id, module, title, source, actors, frontRoutes, counts, contract, qa };
}
