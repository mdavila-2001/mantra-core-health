// `cobros-en-pantalla.ts` (los importes) arrastra `@angular/common/http`, que
// fuera del builder de Angular necesita el compilador JIT para cargarse.
import '@angular/compiler';

import { afterEach, beforeEach, test, vi } from 'vitest';

import type {
  SimulatedCharge,
  SimulatedIssuer,
  SimulatedPlanInstance,
  SimulatedSalesNote,
} from '../../src/app/core/data-access/billing-simulated/billing-simulated.types';
import { buildSalesNotePdf } from '../../src/app/features/billing/sales-note';
import { loadBrandFonts, savePdf, useSampleSignature } from './sample-setup';

/**
 * La muestra de la nota de venta SIMULADA: el segundo pago a cuenta de un plan
 * de consulta más tres reconsultas. Todo es ficticio (NIT 0000000000, CI
 * 0000000, nombres inventados). La firma de muestra se carga a propósito: la
 * nota tiene que salir **sin** ella.
 */

const EMISOR: SimulatedIssuer = {
  id: 'emisor-muestra',
  kind: 'PRACTICE',
  nit: '0000000000',
  legalName: 'Consultorio Médico Illimani S.R.L.',
  municipality: 'La Paz',
  address: 'Av. 6 de Agosto N.º 0000, Sopocachi',
  phone: '2 000 0000',
  branchCode: 0,
  pointOfSaleCode: 0,
  documentSector: 1,
  simulated: true,
};

function nota(numero: number, instanceId: string, amount: string, issuedAt: string): SimulatedSalesNote {
  return {
    id: `nota-muestra-${numero}`,
    number: `NV-${String(numero).padStart(6, '0')}`,
    instanceId,
    amount,
    methodCode: 1,
    methodLabel: 'Efectivo',
    issuedAt,
    simulated: true,
  };
}

const PRIMERA = nota(41, 'instancia-1', '250.00', '2026-10-10T14:05:00.000Z');
const SEGUNDA = nota(42, 'instancia-2', '1200.00', '2026-10-24T14:32:00.000Z');

const INSTANCIAS: SimulatedPlanInstance[] = [
  { id: 'instancia-1', sequence: 1, kind: 'CONSULTATION', label: 'Consulta inicial', expectedAmount: '250.00', paidAmount: '250.00', balance: '0.00', bookingId: null, scheduledAt: null, salesNotes: [PRIMERA] },
  { id: 'instancia-2', sequence: 2, kind: 'FOLLOW_UP', label: 'Reconsulta 1 de 3', expectedAmount: '1200.00', paidAmount: '1200.00', balance: '0.00', bookingId: null, scheduledAt: null, salesNotes: [SEGUNDA] },
  { id: 'instancia-3', sequence: 3, kind: 'FOLLOW_UP', label: 'Reconsulta 2 de 3', expectedAmount: '150.00', paidAmount: '0.00', balance: '150.00', bookingId: null, scheduledAt: null, salesNotes: [] },
  { id: 'instancia-4', sequence: 4, kind: 'FOLLOW_UP', label: 'Reconsulta 3 de 3', expectedAmount: '150.00', paidAmount: '0.00', balance: '150.00', bookingId: null, scheduledAt: null, salesNotes: [] },
];

const COBRO: SimulatedCharge = {
  id: 'cobro-muestra',
  source: 'CONSULTATION',
  sourceRef: 'cita-muestra',
  issuerId: EMISOR.id,
  patientProfileId: 'PAC-000123',
  patientName: 'María Fernanda Quispe Mamani',
  practitionerProfileId: null,
  description: 'Tratamiento de fisioterapia con reconsultas',
  lines: [],
  total: '1750.00',
  currency: 'BOB',
  createdAt: '2026-10-10T14:00:00.000Z',
  payment: null,
  suggestedBuyer: { name: 'María Fernanda Quispe Mamani', documentTypeCode: 1, documentNumber: '0000000', email: null },
  latestInvoice: null,
  plan: {
    serviceCode: 'FISIO-PLAN',
    serviceName: 'Plan de fisioterapia: consulta inicial y tres reconsultas',
    instances: INSTANCIAS,
    expectedTotal: '1750.00',
    paidTotal: '1450.00',
    balance: '300.00',
    complete: false,
  },
  simulated: true,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 24, 18, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

test('nota de venta simulada', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildSalesNotePdf(COBRO, INSTANCIAS[1]!, SEGUNDA, EMISOR), 'sales-note.pdf'));
});
