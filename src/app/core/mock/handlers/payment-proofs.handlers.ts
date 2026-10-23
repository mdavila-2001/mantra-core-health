/* ============================================================================
    C-01 · Comprobantes de pago del paciente, en el simulador.

    Mismas rutas, mismos códigos y mismo alcance que la API real
    (`mantra-core-health-api`, `PaymentProofsController`, 2026-10-23):

      GET  /billing/me/charges/:chargeId/payment-context      paciente
      POST /billing/me/charges/:chargeId/payment-proofs       paciente
      GET  /billing/charges/:chargeId/payment-proofs          médico / caja
      POST /billing/payment-proofs/:id/accept                 médico / caja
      POST /billing/payment-proofs/:id/reject                 médico / caja
      GET  /billing/me/provider-payment-table                 médico / caja

    El cargo de una consulta ES el encuentro; acá, el cobro de consulta de la
    demo (`initialCharges`). Fuera del alcance de quien pide: 404. Sin pago
    confirmado, la API responde 422 PRECONDITION_FAILED / PAYMENT_REQUIRED.
    La parte del seguro es el doble declarado de C-02: siempre `NO_COVERAGE`.
    ========================================================================== */

import type {
  ChargePaymentStatus,
  PaymentProof,
  PaymentProofMethod,
  ProviderPaymentRow,
} from '../../data-access/billing/payment-proofs.types';
import { initialCharges } from '../billing-sim/simulated-data';
import type { InitialCharge } from '../billing-sim/simulated-invoicing';
import {
  conflict,
  forbidden,
  notFound,
  reply,
  unauthorized,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import type { MockUser } from '../mock-session';
import { uuid } from '../mock-store';

const ROLES_DE_CAJA: readonly string[] = ['BILLING', 'FINANCE', 'CASHIER', 'PAYMENTS_ADMIN', 'SUPERADMIN'];
const ROLES_DEL_CONSULTORIO: readonly string[] = ['PRACTITIONER', 'CLINICIAN'];

type Alcance = { readonly todo: true } | { readonly todo: false; readonly profesional: string };

interface Cargo {
  readonly id: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly practitionerProfileId: string | null;
  readonly startAt: string;
  readonly amountMinor: number;
  /** Pagado por la caja (cobro de la demo) o por un comprobante aceptado. */
  pagadoEnCaja: boolean;
}

export interface EstadoDeComprobantes {
  readonly cargos: Map<string, Cargo>;
  readonly comprobantes: PaymentProof[];
}

function centavos(texto: string): number {
  const [entero, dec = ''] = texto.split('.');
  return Number(entero) * 100 + Number(dec.padEnd(2, '0').slice(0, 2));
}

function totalDe(c: InitialCharge): number {
  return c.lines.reduce((s, l) => s + centavos(l.subtotal), 0);
}

/** El estado sembrado: los cobros de consulta de la demo y dos comprobantes. */
export function sembrarComprobantes(cobros: readonly InitialCharge[] = initialCharges()): EstadoDeComprobantes {
  const cargos = new Map<string, Cargo>();
  for (const c of cobros) {
    if (c.source !== 'CONSULTATION') continue;
    cargos.set(c.id, {
      id: c.id,
      patientProfileId: c.patientProfileId,
      patientName: c.patientName,
      practitionerProfileId: c.practitionerProfileId ?? null,
      startAt: c.createdAt,
      amountMinor: totalDe(c),
      pagadoEnCaja: c.payment !== null,
    });
  }
  const comprobantes: PaymentProof[] = [];
  const pendientes = [...cargos.values()].filter((c) => !c.pagadoEnCaja && c.amountMinor > 0);
  const primero = pendientes[0];
  if (primero !== undefined) {
    comprobantes.push({
      id: uuid(`comprobante-pendiente-${primero.id}`),
      chargeId: primero.id,
      patientProfileId: primero.patientProfileId,
      method: 'QR_TRANSFER',
      fileId: null,
      amountMinor: primero.amountMinor,
      currency: 'BOB',
      status: 'PENDING_REVIEW',
      rejectionReason: null,
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: primero.startAt,
    });
  }
  const segundo = pendientes[1];
  if (segundo !== undefined) {
    comprobantes.push({
      id: uuid(`comprobante-rechazado-${segundo.id}`),
      chargeId: segundo.id,
      patientProfileId: segundo.patientProfileId,
      method: 'CASH',
      fileId: null,
      amountMinor: segundo.amountMinor,
      currency: 'BOB',
      status: 'REJECTED',
      rejectionReason: 'El monto declarado no coincide con la consulta',
      reviewedAt: segundo.startAt,
      reviewedByUserId: null,
      createdAt: segundo.startAt,
    });
  }
  return { cargos, comprobantes };
}

function alcanceDe(usuario: MockUser): Alcance | null {
  if (usuario.roles.some((r) => ROLES_DE_CAJA.includes(r))) return { todo: true };
  if (usuario.practitionerProfileId !== undefined && usuario.roles.some((r) => ROLES_DEL_CONSULTORIO.includes(r))) {
    return { todo: false, profesional: usuario.practitionerProfileId };
  }
  return null;
}

function dentro(cargo: Cargo, alcance: Alcance): boolean {
  return alcance.todo || cargo.practitionerProfileId === alcance.profesional;
}

function estadoDelCargo(estado: EstadoDeComprobantes, cargo: Cargo): ChargePaymentStatus {
  if (cargo.amountMinor === 0) return 'NOT_PRICED';
  const aceptado = estado.comprobantes.some((p) => p.chargeId === cargo.id && p.status === 'ACCEPTED');
  return cargo.pagadoEnCaja || aceptado ? 'PAID' : 'PENDING';
}

function delCargo(estado: EstadoDeComprobantes, chargeId: string): PaymentProof[] {
  return estado.comprobantes
    .filter((p) => p.chargeId === chargeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const sinSeguro = (amountMinor: number) => ({
  coveragePercent: 0,
  patientAmountMinor: amountMinor,
  insurerAmountMinor: 0,
  approval: { status: 'NO_COVERAGE' as const, reason: 'C-02 pendiente: el paciente paga el total' },
});

/** Registra las rutas de C-01. `estadoInicial` es para las pruebas. */
export function registrarComprobantesDePago(
  router: MockRouter,
  estadoInicial: () => EstadoDeComprobantes = () => sembrarComprobantes(),
): void {
  let estado: EstadoDeComprobantes | null = null;
  const st = (): EstadoDeComprobantes => (estado ??= estadoInicial());

  const paciente = (request: MockRequest): string | MockReply => {
    if (request.user === null) return unauthorized('Sin sesión');
    const id = request.user.patientProfileId;
    if (id === undefined || !request.user.roles.includes('PATIENT')) {
      return forbidden('Sólo el paciente paga sus consultas');
    }
    return id;
  };
  const operador = (request: MockRequest): Alcance | MockReply => {
    if (request.user === null) return unauthorized('Sin sesión');
    return alcanceDe(request.user) ?? forbidden('Su rol no permite revisar comprobantes');
  };
  const esRespuesta = (x: unknown): x is MockReply =>
    typeof x === 'object' && x !== null && 'status' in x && 'body' in x;

  router.get('/billing/me/charges/:chargeId/payment-context', (request: MockRequest) => {
    const yo = paciente(request);
    if (esRespuesta(yo)) return yo;
    const cargo = st().cargos.get(request.params['chargeId'] ?? '');
    if (cargo === undefined || cargo.patientProfileId !== yo) return notFound('El cargo no existe');
    const proofs = delCargo(st(), cargo.id);
    return reply(200, {
      chargeId: cargo.id,
      amountMinor: cargo.amountMinor,
      currency: 'BOB',
      status: estadoDelCargo(st(), cargo),
      patientShare: sinSeguro(cargo.amountMinor),
      site: { id: uuid('sede-demo-consultorio'), name: 'Consultorio de la demo', bankQrFileId: null },
      proofs,
      latestProof: proofs[0] ?? null,
    });
  });

  router.post('/billing/me/charges/:chargeId/payment-proofs', (request: MockRequest) => {
    const yo = paciente(request);
    if (esRespuesta(yo)) return yo;
    const cargo = st().cargos.get(request.params['chargeId'] ?? '');
    if (cargo === undefined || cargo.patientProfileId !== yo) return notFound('El cargo no existe');
    const body = (request.body ?? {}) as { method?: unknown; fileId?: unknown; amountMinor?: unknown };
    const method = body.method;
    if (method !== 'QR_TRANSFER' && method !== 'CASH') {
      return validation('Método inválido', [{ field: 'method', message: 'debe ser QR_TRANSFER o CASH' }]);
    }
    if (typeof body.amountMinor !== 'number' || !Number.isInteger(body.amountMinor) || body.amountMinor < 1) {
      return validation('Monto inválido', [{ field: 'amountMinor', message: 'entero ≥ 1' }]);
    }
    if (estadoDelCargo(st(), cargo) === 'PAID') return conflict('El cargo ya está pagado', { reason: 'ALREADY_PAID' });
    if (method === 'QR_TRANSFER' && typeof body.fileId !== 'string') {
      return reply(422, {
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        message: 'Una transferencia por QR necesita la captura del comprobante',
        details: { reason: 'FILE_REQUIRED', field: 'fileId' },
      });
    }
    if (st().comprobantes.some((p) => p.chargeId === cargo.id && p.status === 'PENDING_REVIEW')) {
      return conflict('Ya hay un comprobante pendiente de revisión para este cargo', { reason: 'PROOF_ALREADY_PENDING' });
    }
    const id = uuid(`comprobante-${cargo.id}-${st().comprobantes.length}`);
    st().comprobantes.push({
      id,
      chargeId: cargo.id,
      patientProfileId: yo,
      method: method as PaymentProofMethod,
      fileId: typeof body.fileId === 'string' ? body.fileId : null,
      amountMinor: body.amountMinor,
      currency: 'BOB',
      status: 'PENDING_REVIEW',
      rejectionReason: null,
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: new Date().toISOString(),
    });
    return reply(201, { id, status: 'PENDING_REVIEW' });
  });

  router.get('/billing/charges/:chargeId/payment-proofs', (request: MockRequest) => {
    const alcance = operador(request);
    if (esRespuesta(alcance)) return alcance;
    const cargo = st().cargos.get(request.params['chargeId'] ?? '');
    if (cargo === undefined || !dentro(cargo, alcance)) return notFound('El cargo no existe');
    return reply(200, {
      chargeId: cargo.id,
      status: estadoDelCargo(st(), cargo),
      amountMinor: cargo.amountMinor,
      currency: 'BOB',
      items: delCargo(st(), cargo.id),
    });
  });

  const revisar = (request: MockRequest, resultado: 'ACCEPTED' | 'REJECTED'): MockReply => {
    const alcance = operador(request);
    if (esRespuesta(alcance)) return alcance;
    const indice = st().comprobantes.findIndex((p) => p.id === request.params['id']);
    const actual = st().comprobantes[indice];
    const cargo = actual === undefined ? undefined : st().cargos.get(actual.chargeId);
    if (actual === undefined || cargo === undefined || !dentro(cargo, alcance)) {
      return notFound('El comprobante no existe');
    }
    let motivo: string | null = null;
    if (resultado === 'REJECTED') {
      const reason = ((request.body ?? {}) as { reason?: unknown }).reason;
      if (typeof reason !== 'string' || reason.trim().length < 3) {
        return validation('Falta el motivo', [{ field: 'reason', message: 'mínimo 3 caracteres' }]);
      }
      motivo = reason.trim();
    }
    if (actual.status !== 'PENDING_REVIEW') {
      return conflict('El comprobante ya fue revisado', { reason: 'PROOF_NOT_PENDING', proofId: actual.id });
    }
    st().comprobantes[indice] = {
      ...actual,
      status: resultado,
      rejectionReason: motivo,
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: request.user?.id ?? null,
    };
    return reply(200, { id: actual.id, status: resultado, chargeStatus: estadoDelCargo(st(), cargo) });
  };
  router.post('/billing/payment-proofs/:id/accept', (request: MockRequest) => revisar(request, 'ACCEPTED'));
  router.post('/billing/payment-proofs/:id/reject', (request: MockRequest) => revisar(request, 'REJECTED'));

  router.get('/billing/me/provider-payment-table', (request: MockRequest) => {
    const alcance = operador(request);
    if (esRespuesta(alcance)) return alcance;
    const persona = request.query.get('patientProfileId');
    const limite = Math.min(100, Math.max(1, Number(request.query.get('limit') ?? 20) || 20));
    const desde = Number(request.query.get('cursor') ?? 0) || 0;
    const filas: ProviderPaymentRow[] = [...st().cargos.values()]
      .filter((c) => dentro(c, alcance) && (persona === null || c.patientProfileId === persona))
      .sort((a, b) => b.startAt.localeCompare(a.startAt) || b.id.localeCompare(a.id))
      .map((c) => {
        const propios = delCargo(st(), c.id);
        const proof = propios.find((p) => p.status === 'ACCEPTED') ?? propios[0] ?? null;
        return {
          chargeId: c.id,
          startAt: c.startAt,
          patientProfileId: c.patientProfileId,
          patientName: c.patientName,
          amountMinor: c.amountMinor,
          currency: 'BOB',
          patientAmountMinor: c.amountMinor,
          insurerAmountMinor: 0,
          coverageStatus: 'NO_COVERAGE',
          status: estadoDelCargo(st(), c),
          proof,
          invoiced: false,
        };
      });
    const pagina = filas.slice(desde, desde + limite);
    const totals = { sessions: 0, amountMinor: 0, paidMinor: 0, pendingMinor: 0 };
    for (const f of pagina) {
      totals.sessions += 1;
      totals.amountMinor += f.amountMinor;
      if (f.status === 'PAID') totals.paidMinor += f.amountMinor;
      if (f.status === 'PENDING') totals.pendingMinor += f.amountMinor;
    }
    return reply(200, {
      items: pagina,
      nextCursor: desde + limite < filas.length ? String(desde + limite) : null,
      totals,
    });
  });
}
