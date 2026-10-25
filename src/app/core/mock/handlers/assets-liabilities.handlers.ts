import type { AssetDepreciation } from '../../data-access/assets-liabilities/assets-liabilities.types';
import { STATUS } from '../fixtures/concepts';
import { notFound, preconditionFailed, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, isoDia, nuevoId, texto, uuid } from '../mock-store';
import { PRACTICAS } from './practice.handlers';

/* ============================================================================
    Activos y pasivos del profesional (FT-26), separados de `finance.handlers`
    al sumar el histórico de depreciación y el cronograma (T26 · criterios 6 y
    11): el archivo madre estaba en su techo de líneas. `activos` se exporta
    porque la corrida de amortización del plano SAP también lo recorre.
    ========================================================================== */

function d(n: number): string {
  return n.toFixed(2);
}

/* ---- activos y pasivos ---------------------------------------------------------- */

export const activos = new Coleccion<{ id: string; practiceId: string; code: string; name: string; statusConceptId: string; bookValue: string; acquisitionCost: string; automated: boolean; depreciations?: readonly AssetDepreciation[] }>([
  { id: uuid('asset-ecg'), practiceId: PRACTICAS[0]!.id, code: 'EQ-001', name: 'Electrocardiógrafo Nihon Kohden', statusConceptId: STATUS['ST-ACTIVE']!, bookValue: '17883.34', acquisitionCost: '18500.00', automated: true },
  { id: uuid('asset-eco'), practiceId: PRACTICAS[0]!.id, code: 'EQ-002', name: 'Ecógrafo portátil GE Vscan', statusConceptId: STATUS['ST-ACTIVE']!, bookValue: '41250.00', acquisitionCost: '45000.00', automated: true },
  { id: uuid('asset-camilla'), practiceId: PRACTICAS[0]!.id, code: 'MOB-001', name: 'Camilla de examen eléctrica', statusConceptId: STATUS['ST-ACTIVE']!, bookValue: '5200.00', acquisitionCost: '6500.00', automated: false },
  { id: uuid('asset-pc'), practiceId: PRACTICAS[2]!.id, code: 'IT-001', name: 'Computadora del consultorio', statusConceptId: STATUS['ST-ACTIVE']!, bookValue: '2100.00', acquisitionCost: '4200.00', automated: true },
  { id: uuid('asset-viejo'), practiceId: PRACTICAS[0]!.id, code: 'EQ-000', name: 'Tensiómetro de mercurio (dado de baja)', statusConceptId: STATUS['ST-ARCHIVED']!, bookValue: '0.00', acquisitionCost: '350.00', automated: false },
]);

const pasivos = new Coleccion<{ id: string; practiceId: string; code: string; name: string; creditorName: string; principalAmount: string; outstandingAmount: string; statusConceptId: string; automated: boolean; cuotas: number; pagadas: number; startDate: string; interestRate: string }>([
  { id: uuid('liability-bnb'), practiceId: PRACTICAS[0]!.id, code: 'PR-001', name: 'Préstamo equipamiento BNB', creditorName: 'Banco Nacional de Bolivia', principalAmount: '40000.00', outstandingAmount: '36666.67', statusConceptId: STATUS['ST-ACTIVE']!, automated: true, cuotas: 12, pagadas: 1, startDate: isoDia(-50), interestRate: '12.00' },
  { id: uuid('liability-eco'), practiceId: PRACTICAS[0]!.id, code: 'PR-002', name: 'Financiación del ecógrafo', creditorName: 'GE Healthcare Bolivia', principalAmount: '45000.00', outstandingAmount: '30000.00', statusConceptId: STATUS['ST-ACTIVE']!, automated: false, cuotas: 18, pagadas: 6, startDate: isoDia(-200), interestRate: '8.50' },
  { id: uuid('liability-pagado'), practiceId: PRACTICAS[2]!.id, code: 'PR-000', name: 'Anticipo de alquiler (saldado)', creditorName: 'Inmobiliaria Urubó', principalAmount: '9000.00', outstandingAmount: '0.00', statusConceptId: STATUS['ST-CLOSED']!, automated: false, cuotas: 3, pagadas: 3, startDate: isoDia(-400), interestRate: '0.00' },
]);

function cronograma(principal: number, cuotas: number, pagadas: number, startDate: string, tasa: number) {
  const capital = principal / cuotas;
  return Array.from({ length: cuotas }, (_, i) => {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + i + 1);
    const interes = ((principal - capital * i) * tasa) / 100 / 12;
    return { id: uuid(`schedule-${startDate}-${i}`), installmentNumber: i + 1, dueDate: due.toISOString().slice(0, 10), principalDue: d(capital), interestDue: d(interes), paidAmount: i < pagadas ? d(capital + interes) : '0.00', statusConceptId: i < pagadas ? STATUS['ST-COMPLETED']! : STATUS['ST-PENDING']! };
  });
}

export function registrarActivosYPasivos(router: MockRouter): void {
  /* ---- activos y pasivos ---------------------------------------------------
     Con el prefijo `/accounting/practitioner`, que es el que arma
     `AssetsLiabilitiesClient.url()`. Registradas como `/assets` y
     `/liabilities` a secas no las encontraba nadie: la petición caía en
     `respuestaGenerica`, que para una lectura sin `limit` devuelve `{}`, y la
     pantalla —que espera un arreglo— moría con `t[Symbol.iterator] is not a
     function`. El manejador existía y los datos también; sólo colgaban de la
     ruta equivocada. */

  router.get('/accounting/practitioner/assets', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return activos.filtrar((a) => practiceId === null || a.practiceId === practiceId).map(({ practiceId: _p, depreciations: _d, ...a }) => a);
  });

  router.post('/accounting/practitioner/assets', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; acquisitionCost: string }>(request);
    const nuevo = activos.agregar({ id: nuevoId('asset'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'EQ-NUEVO', name: datos.name ?? 'Activo nuevo', statusConceptId: STATUS['ST-ACTIVE']!, bookValue: datos.acquisitionCost ?? '0.00', acquisitionCost: datos.acquisitionCost ?? '0.00', automated: true });
    return { status: 201, body: { id: nuevo.id } };
  });

  router.patch('/accounting/practitioner/assets/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    activos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/accounting/practitioner/assets/:id/progress', ({ params }) => {
    const a = activos.get(params['id']!);
    if (a === undefined) return notFound('Activo no encontrado');
    const cuotaMensual = Number(a.acquisitionCost) / 60;
    const bookValueAfter = d(Math.max(0, Number(a.bookValue) - cuotaMensual)), transactionId = nuevoId('journal');
    activos.actualizar(a.id, { bookValue: bookValueAfter, depreciations: [...(a.depreciations ?? []), { id: nuevoId('depreciation'), fiscalPeriodId: uuid(`period-${isoDia(0).slice(0, 7)}`), fiscalPeriodCode: isoDia(0).slice(0, 7), periodStartDate: null, periodEndDate: null, amount: d(cuotaMensual), bookValueAfter, transactionId, registeredAt: new Date().toISOString() }] });
    return { status: 201, body: { transactionId, amount: d(cuotaMensual) } };
  });

  router.get('/accounting/practitioner/assets/:id/depreciations', ({ params }) => {
    const a = activos.get(params['id']!);
    return a === undefined ? notFound('Activo no encontrado') : { assetId: a.id, code: a.code, acquisitionCost: a.acquisitionCost, accumulatedDepreciation: d(Math.max(0, Number(a.acquisitionCost) - Number(a.bookValue))), bookValue: a.bookValue, depreciations: a.depreciations ?? [] };
  });
  router.get('/accounting/practitioner/liabilities', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return pasivos.filtrar((p) => practiceId === null || p.practiceId === practiceId).map(({ practiceId: _p, cuotas: _c, pagadas: _q, startDate: _s, interestRate: _i, ...p }) => p);
  });

  router.post('/accounting/practitioner/liabilities', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; creditorName?: string; principalAmount: string; interestRate?: string; installments: number; startDate: string; automated?: boolean }>(request);
    const nuevo = pasivos.agregar({ id: nuevoId('liability'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'PR-NUEVO', name: datos.name ?? 'Pasivo nuevo', creditorName: datos.creditorName ?? 'Acreedor', principalAmount: datos.principalAmount ?? '0.00', outstandingAmount: datos.principalAmount ?? '0.00', statusConceptId: STATUS['ST-ACTIVE']!, automated: datos.automated ?? true, cuotas: datos.installments ?? 12, pagadas: 0, startDate: datos.startDate ?? isoDia(0), interestRate: datos.interestRate ?? '0' });
    return { status: 201, body: { id: nuevo.id, code: nuevo.code, schedule: cronograma(Number(nuevo.principalAmount), nuevo.cuotas, 0, nuevo.startDate, Number(nuevo.interestRate)) } };
  });

  router.get('/accounting/practitioner/liabilities/:id/schedule', ({ params }) => {
    const p = pasivos.get(params['id']!);
    return p === undefined ? notFound('Pasivo no encontrado') : { liabilityId: p.id, code: p.code, principalAmount: p.principalAmount, outstandingAmount: p.outstandingAmount, schedule: cronograma(Number(p.principalAmount), p.cuotas, p.pagadas, p.startDate, Number(p.interestRate)) };
  });
  router.patch('/accounting/practitioner/liabilities/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    pasivos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/accounting/practitioner/liabilities/:id/progress', ({ params }) => {
    const p = pasivos.get(params['id']!);
    if (p === undefined) return notFound('Pasivo no encontrado');
    if (p.pagadas >= p.cuotas) return preconditionFailed('El pasivo ya está saldado');
    const capital = Number(p.principalAmount) / p.cuotas;
    pasivos.actualizar(p.id, { pagadas: p.pagadas + 1, outstandingAmount: d(Math.max(0, Number(p.outstandingAmount) - capital)), statusConceptId: p.pagadas + 1 >= p.cuotas ? STATUS['ST-CLOSED']! : p.statusConceptId });
    return { status: 201, body: { transactionId: nuevoId('journal'), installmentNumber: p.pagadas + 1, amount: d(capital) } };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
activos.persistirEn('mock.finance.activos');
pasivos.persistirEn('mock.finance.pasivos');
