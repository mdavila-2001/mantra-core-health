/* ============================================================================
    Rutas de la facturación SIMULADA (FACT-SIAT-MOCK): `/billing/simulated/*`.

    Deliberadamente fuera del espacio de rutas productivo —el nombre lo dice—
    y apagadas si `environment.billingSiatDemo` es falso. Detrás está
    `FacturacionSimulada` («MANTRA facturación») hablando con el SIAT simulado
    por `FiscalProviderPort`. Nada sale del navegador.

    Roles: los mismos de la sección «Facturación» del menú
    (`navigation.map.ts`), más `SUPERADMIN`.
    ========================================================================== */

import { environment } from '../../../../environments/environment';
import type {
  AnnulInvoiceInput,
  EmailInvoiceInput,
  IssueInvoiceInput,
  RegisterPaymentInput,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { cobrosIniciales, EMISORES_SIMULADOS, PADRON_SIMULADO } from '../billing-sim/datos-simulados';
import { FacturacionSimulada, type ErrorDeFacturacion, type Resultado } from '../billing-sim/facturacion-simulada';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  unauthorized,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { cuerpo } from '../mock-store';
import { SiatSimuladoAdapter } from '../siat-sim/siat-simulado.adapter';

export const ROLES_DE_FACTURACION: readonly string[] = ['BILLING', 'FINANCE', 'CASHIER', 'PAYMENTS_ADMIN', 'SUPERADMIN'];

/** Las opciones con las que se arma el motor; las pruebas lo arman con las suyas. */
export interface OpcionesDeFacturacionSimulada {
  readonly activa?: () => boolean;
  readonly reloj?: () => Date;
  readonly persistir?: boolean;
}

function crearMotor(opciones: OpcionesDeFacturacionSimulada): FacturacionSimulada {
  const persistir = opciones.persistir ?? true;
  const siat = new SiatSimuladoAdapter({
    padron: PADRON_SIMULADO,
    ...(opciones.reloj === undefined ? {} : { reloj: opciones.reloj }),
    ...(persistir ? { clavePersistencia: 'mock.billingSim.siat' } : {}),
  });
  return new FacturacionSimulada({
    siat,
    emisores: EMISORES_SIMULADOS,
    cobros: cobrosIniciales(),
    ...(opciones.reloj === undefined ? {} : { reloj: opciones.reloj }),
    ...(persistir ? { clavePersistencia: 'mock.billingSim.mantra' } : {}),
  });
}

function aRespuesta<T>(resultado: Resultado<T>, estadoOk = 200): MockReply {
  if (resultado.ok) return reply(estadoOk, resultado.value);
  return errorHttp(resultado.error);
}

function errorHttp(error: ErrorDeFacturacion): MockReply {
  switch (error.code) {
    case 'NOT_FOUND':
      return notFound(error.message);
    case 'ALREADY_PAID':
    case 'ALREADY_INVOICED':
      return conflict(error.message, { reason: error.code });
    case 'PAYMENT_REQUIRED':
      return preconditionFailed(error.message, { reason: error.code });
    case 'INVALID_INPUT':
      return validation(error.message, error.issues ?? []);
    case 'FISCAL_CREDENTIALS':
      return preconditionFailed(error.message, { reason: error.code });
  }
}

export function registrarFacturacionSimulada(router: MockRouter, opciones: OpcionesDeFacturacionSimulada = {}): void {
  const activa = opciones.activa ?? (() => environment.billingSiatDemo);
  let motor: FacturacionSimulada | null = null;
  // Perezoso: los cobros salen de fixtures de agenda y farmacia; no se arman
  // hasta que alguien entra a facturación.
  const facturacion = (): FacturacionSimulada => (motor ??= crearMotor(opciones));

  /** Apagada → 404; sin sesión → 401; sin rol de facturación → 403. */
  const con =
    (manejador: (request: MockRequest, motor: FacturacionSimulada) => MockReply | unknown) =>
    (request: MockRequest): MockReply | unknown => {
      if (!activa()) return notFound('La facturación simulada está apagada (billingSiatDemo = false)');
      if (request.user === null) return unauthorized('Sin sesión');
      if (!request.user.roles.some((rol) => ROLES_DE_FACTURACION.includes(rol))) {
        return forbidden('Tu rol no permite operar la facturación');
      }
      return manejador(request, facturacion());
    };

  router.get(
    '/billing/simulated/status',
    con((_, m) => m.estadoFiscal()),
  );

  router.get(
    '/billing/simulated/catalogs',
    con((_, m) => m.catalogos()),
  );

  router.get(
    '/billing/simulated/charges',
    con((_, m) => {
      const items = m.listarCobros();
      return { items, count: items.length, simulated: true };
    }),
  );

  router.post(
    '/billing/simulated/charges/:chargeId/payment',
    con((request, m) => {
      const datos = cuerpo<RegisterPaymentInput>(request);
      return aRespuesta(m.registrarPago(request.params['chargeId']!, Number(datos.methodCode)), 201);
    }),
  );

  router.post(
    '/billing/simulated/charges/:chargeId/invoices',
    con((request, m) => {
      const datos = cuerpo<IssueInvoiceInput>(request) as IssueInvoiceInput;
      const usuario = request.user?.email.split('@')[0] ?? 'operador-simulado';
      return aRespuesta(m.emitirFactura(request.params['chargeId']!, datos, usuario), 201);
    }),
  );

  router.get(
    '/billing/simulated/invoices/:invoiceId',
    con((request, m) => m.factura(request.params['invoiceId']!) ?? notFound('La factura no existe')),
  );

  router.post(
    '/billing/simulated/invoices/:invoiceId/annulment',
    con((request, m) => {
      const datos = cuerpo<AnnulInvoiceInput>(request);
      return aRespuesta(m.anular(request.params['invoiceId']!, Number(datos.reasonCode)));
    }),
  );

  router.post(
    '/billing/simulated/invoices/:invoiceId/annulment-reversal',
    con((request, m) => aRespuesta(m.revertirAnulacion(request.params['invoiceId']!))),
  );

  router.post(
    '/billing/simulated/invoices/:invoiceId/email',
    con((request, m) => {
      const datos = cuerpo<EmailInvoiceInput>(request);
      return aRespuesta(m.encolarCorreo(request.params['invoiceId']!, String(datos.to ?? '')), 201);
    }),
  );

  router.get(
    '/billing/simulated/outbox',
    con((_, m) => {
      const items = m.bandejaDeSalida();
      return { items, count: items.length, simulated: true };
    }),
  );
}
