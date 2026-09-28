/* ============================================================================
    Rutas de la facturación SIMULADA (FACT-SIAT-MOCK): `/billing/simulated/*`.

    Deliberadamente fuera del espacio de rutas productivo —el nombre lo dice—
    y apagadas si `environment.billingSiatDemo` es falso. Detrás está
    `FacturacionSimulada` («MANTRA facturación») hablando con el SIAT simulado
    por `FiscalProviderPort`. Nada sale del navegador.

    Roles: los mismos de la sección «Facturación» del menú
    (`navigation.map.ts`), más `SUPERADMIN`. Quien atiende (`PRACTITIONER`)
    opera además, desde la consulta, **sus** cobros de consulta —los de las
    citas que atendió (`practitionerProfileId`)—: cobrar, la nota de venta de
    cada instancia del plan y la factura. No ve farmacia ni los cobros de otro
    profesional (404: no se revela que existen), no anula, no ve la bandeja de
    correo ni las credenciales fiscales.
    ========================================================================== */

import { environment } from '../../../../environments/environment';
import type {
  AnnulInvoiceInput,
  EmailInvoiceInput,
  IssueInvoiceInput,
  RegisterInstancePaymentInput,
  RegisterPaymentInput,
  SimulatedCharge,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { cobrosIniciales, EMISORES_SIMULADOS, PADRON_SIMULADO } from '../billing-sim/datos-simulados';
import { FacturacionSimulada, type ErrorDeFacturacion, type Resultado } from '../billing-sim/facturacion-simulada';
import {
  conflict,
  forbidden,
  isMockReply,
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

/** Quien atiende factura sus consultas: sólo los cobros de las citas que atendió. */
export const ROLES_DEL_CONSULTORIO: readonly string[] = ['PRACTITIONER'];

/** Lo que alcanza a ver quien opera: todo (facturación) o los cobros de un profesional. */
type Alcance = { readonly todo: true } | { readonly todo: false; readonly profesional: string };

function dentroDelAlcance(cobro: SimulatedCharge, alcance: Alcance): boolean {
  return alcance.todo || (cobro.source === 'CONSULTATION' && cobro.practitionerProfileId === alcance.profesional);
}

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
    case 'PLAN_REQUIRED':
    case 'NOT_A_PLAN':
      return conflict(error.message, { reason: error.code });
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

  /**
   * Apagada → 404; sin sesión → 401; sin rol → 403. Con `consultorio`, quien
   * atiende también entra —si tiene perfil profesional— y el manejador recibe
   * su alcance: los cobros de las citas que atendió.
   */
  const con =
    (
      manejador: (request: MockRequest, motor: FacturacionSimulada, alcance: Alcance) => MockReply | unknown,
      { consultorio = false }: { readonly consultorio?: boolean } = {},
    ) =>
    (request: MockRequest): MockReply | unknown => {
      if (!activa()) return notFound('La facturación simulada está apagada (billingSiatDemo = false)');
      if (request.user === null) return unauthorized('Sin sesión');
      const roles = request.user.roles;
      if (roles.some((rol) => ROLES_DE_FACTURACION.includes(rol))) return manejador(request, facturacion(), { todo: true });
      const profesional = request.user.practitionerProfileId;
      if (consultorio && profesional !== undefined && roles.some((rol) => ROLES_DEL_CONSULTORIO.includes(rol))) {
        return manejador(request, facturacion(), { todo: false, profesional });
      }
      return forbidden('Tu rol no permite operar la facturación');
    };

  /**
   * El cobro de la ruta, o 404: si no existe **o** si está fuera del alcance
   * de quien lo pide. Un 403 diría que el cobro de otro profesional existe.
   */
  const cobroDe = (m: FacturacionSimulada, id: string, alcance: Alcance): SimulatedCharge | MockReply => {
    const cobro = m.cobro(id);
    if (cobro === null || !dentroDelAlcance(cobro, alcance)) return notFound('El cobro no existe');
    return cobro;
  };

  router.get(
    '/billing/simulated/status',
    con(
      (_, m, alcance) => {
        const estado = m.estadoFiscal();
        // Quien atiende necesita el emisor de su consultorio para la nota de
        // venta; no las credenciales fiscales ni el emisor de farmacia.
        return alcance.todo
          ? estado
          : { ...estado, issuers: estado.issuers.filter((e) => e.kind === 'PRACTICE'), credentials: [] };
      },
      { consultorio: true },
    ),
  );

  router.get(
    '/billing/simulated/catalogs',
    con((_, m) => m.catalogos(), { consultorio: true }),
  );

  // `?patientProfileId=` acota a una persona: es la lectura de «Pagos» dentro
  // de la consulta. Sin él, la lista entera (la pantalla de facturación).
  router.get(
    '/billing/simulated/charges',
    con(
      (request, m, alcance) => {
        const paciente = request.query.get('patientProfileId');
        const items = m
          .listarCobros()
          .filter((c) => dentroDelAlcance(c, alcance))
          .filter((c) => paciente === null || paciente === '' || c.patientProfileId === paciente);
        return { items, count: items.length, simulated: true };
      },
      { consultorio: true },
    ),
  );

  router.post(
    '/billing/simulated/charges/:chargeId/payment',
    con(
      (request, m, alcance) => {
        const cobro = cobroDe(m, request.params['chargeId']!, alcance);
        if (isMockReply(cobro)) return cobro;
        const datos = cuerpo<RegisterPaymentInput>(request);
        return aRespuesta(m.registrarPago(cobro.id, Number(datos.methodCode)), 201);
      },
      { consultorio: true },
    ),
  );

  // El pago de una instancia del plan: responde el cobro con la nota de venta.
  router.post(
    '/billing/simulated/charges/:chargeId/instances/:instanceId/payments',
    con(
      (request, m, alcance) => {
        const cobro = cobroDe(m, request.params['chargeId']!, alcance);
        if (isMockReply(cobro)) return cobro;
        const datos = cuerpo<RegisterInstancePaymentInput>(request);
        return aRespuesta(
          m.registrarPagoDeInstancia(cobro.id, request.params['instanceId']!, {
            methodCode: Number(datos.methodCode),
            amount: String(datos.amount ?? ''),
          }),
          201,
        );
      },
      { consultorio: true },
    ),
  );

  router.post(
    '/billing/simulated/charges/:chargeId/invoices',
    con(
      (request, m, alcance) => {
        const cobro = cobroDe(m, request.params['chargeId']!, alcance);
        if (isMockReply(cobro)) return cobro;
        const datos = cuerpo<IssueInvoiceInput>(request) as IssueInvoiceInput;
        const usuario = request.user?.email.split('@')[0] ?? 'operador-simulado';
        return aRespuesta(m.emitirFactura(cobro.id, datos, usuario), 201);
      },
      { consultorio: true },
    ),
  );

  router.get(
    '/billing/simulated/invoices/:invoiceId',
    con(
      (request, m, alcance) => {
        const factura = m.factura(request.params['invoiceId']!);
        if (factura === null) return notFound('La factura no existe');
        const cobro = cobroDe(m, factura.chargeId, alcance);
        return isMockReply(cobro) ? cobro : factura;
      },
      { consultorio: true },
    ),
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
