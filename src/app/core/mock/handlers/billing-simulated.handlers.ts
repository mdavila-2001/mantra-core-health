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
  MyInvoiceItem,
  MyInvoicesView,
  RegisterPaymentInput,
  SimulatedCharge,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { cobrosIniciales, EMISORES_SIMULADOS, PADRON_SIMULADO } from '../billing-sim/simulated-data';
import { PACIENTE } from '../fixtures/people';
import { FacturacionSimulada, type ErrorDeFacturacion, type Resultado } from '../billing-sim/simulated-invoicing';
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
import { TENANT_FARMACIA, type MockUser } from '../mock-session';
import { cuerpo } from '../mock-store';
import { SiatSimuladoAdapter } from '../siat-sim/siat-simulated.adapter';

export const ROLES_DE_FACTURACION: readonly string[] = ['BILLING', 'FINANCE', 'CASHIER', 'PAYMENTS_ADMIN', 'SUPERADMIN'];

/** Quien atiende factura sus consultas: sólo los cobros de las citas que atendió. */
export const ROLES_DEL_CONSULTORIO: readonly string[] = ['PRACTITIONER'];

/** Lo que alcanza a ver quien opera: todo (facturación) o los cobros de un profesional. */
type Alcance = { readonly todo: true } | { readonly todo: false; readonly profesional: string };

function dentroDelAlcance(cobro: SimulatedCharge, alcance: Alcance): boolean {
  return alcance.todo || (cobro.source === 'CONSULTATION' && cobro.practitionerProfileId === alcance.profesional);
}

/**
 * **Mis facturas**: qué cobros entran en la lista de una sesión, y de qué lado.
 *
 * - Quien factura (roles de facturación, el médico, la farmacia) ve las que
 *   **emitió**: facturación todo, el médico las de sus consultas, la farmacia
 *   las de sus pedidos.
 * - El paciente ve las que **le emitieron**.
 * - Cualquier otra cuenta (laboratorio, aseguradora…) ve «emitidas», vacía:
 *   su organización todavía no factura en la maqueta, y lo dice.
 */
interface AlcanceDeMisFacturas {
  readonly vista: MyInvoicesView;
  readonly incluye: (cobro: SimulatedCharge) => boolean;
}

export function alcanceDeMisFacturas(usuario: MockUser): AlcanceDeMisFacturas {
  const roles = usuario.roles;
  if (roles.some((rol) => ROLES_DE_FACTURACION.includes(rol))) {
    return { vista: 'ISSUED', incluye: () => true };
  }
  const profesional = usuario.practitionerProfileId;
  if (profesional !== undefined && roles.some((rol) => ROLES_DEL_CONSULTORIO.includes(rol))) {
    return { vista: 'ISSUED', incluye: (c) => dentroDelAlcance(c, { todo: false, profesional }) };
  }
  // La farmacia es `USER` con la membresía del tenant, como en la API. El
  // visitador también cuelga de ese tenant y no factura nada.
  if (usuario.tenants.includes(TENANT_FARMACIA) && !roles.includes('MEDICAL_VISITOR')) {
    return { vista: 'ISSUED', incluye: (c) => c.source === 'PHARMACY' };
  }
  const paciente = usuario.patientProfileId;
  if (paciente !== undefined && roles.includes('PATIENT')) {
    return { vista: 'RECEIVED', incluye: (c) => c.patientProfileId === paciente };
  }
  return { vista: 'ISSUED', incluye: () => false };
}

/**
 * Cuántas facturas de otros pacientes se siembran, además de todas las de la
 * paciente de la demo. Sin semilla, «Mis facturas» abría vacía hasta que
 * alguien emitiera una a mano desde Facturación.
 */
const FACTURAS_SEMBRADAS_DE_OTROS = 6;

/**
 * Emite, una sola vez, las facturas de la demo: la primera vez que se arma el
 * motor persistido y todavía no hay ninguna. Son facturas como cualquier otra
 * —mismo SIAT simulado, mismo correlativo—, así que Facturación las muestra
 * emitidas y se pueden anular.
 */
function sembrarFacturas(motor: FacturacionSimulada, pacienteDeLaDemo: string | undefined): void {
  const cobros = motor.listarCobros();
  if (cobros.some((c) => c.latestInvoice !== null)) return;
  const facturables = cobros
    .filter((c) => c.payment !== null && c.suggestedBuyer.documentNumber !== '')
    .reverse(); // de la más vieja a la más nueva: el correlativo sube con la fecha.
  const deLaDemo = facturables.filter((c) => c.patientProfileId === pacienteDeLaDemo);
  const deOtros = facturables.filter((c) => c.patientProfileId !== pacienteDeLaDemo).slice(-FACTURAS_SEMBRADAS_DE_OTROS);
  const elegidos = new Set([...deLaDemo, ...deOtros].map((c) => c.id));
  for (const cobro of facturables.filter((c) => elegidos.has(c.id))) {
    const { name, documentTypeCode, documentNumber, email } = cobro.suggestedBuyer;
    motor.emitirFactura(cobro.id, { buyer: { name, documentTypeCode, documentNumber, complement: null, email } }, 'semilla-demo');
  }
}

/** Las opciones con las que se arma el motor; las pruebas lo arman con las suyas. */
export interface OpcionesDeFacturacionSimulada {
  readonly activa?: () => boolean;
  readonly reloj?: () => Date;
  readonly persistir?: boolean;
  /** Emitir las facturas de la demo al armar el motor. Por omisión, lo mismo que `persistir`. */
  readonly sembrarFacturas?: boolean;
  /** La paciente cuyas facturas se siembran todas. */
  readonly pacienteDeLaDemo?: string;
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
      return validation(error.message, (error.issues ?? []).map(({ field, problem }) => ({ field, message: problem })));
    case 'FISCAL_CREDENTIALS':
      return preconditionFailed(error.message, { reason: error.code });
  }
}

export function registrarFacturacionSimulada(router: MockRouter, opciones: OpcionesDeFacturacionSimulada = {}): void {
  const activa = opciones.activa ?? (() => environment.billingSiatDemo);
  let motor: FacturacionSimulada | null = null;
  // Perezoso: los cobros salen de fixtures de agenda y farmacia; no se arman
  // hasta que alguien entra a facturación.
  const facturacion = (): FacturacionSimulada => {
    if (motor === null) {
      motor = crearMotor(opciones);
      if (opciones.sembrarFacturas ?? opciones.persistir ?? true) {
        sembrarFacturas(motor, opciones.pacienteDeLaDemo ?? PACIENTE.id);
      }
    }
    return motor;
  };

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
      return forbidden('Su rol no permite operar la facturación');
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

  // «Mis facturas» (propietario, 30/09/2026): el ícono de la barra superior,
  // para toda cuenta. No pasa por `con()`: el paciente y la farmacia no tienen
  // rol de facturación y **sí** tienen facturas que mirar. El alcance lo da
  // `alcanceDeMisFacturas`; fuera de él, 404 como en el resto.
  router.get('/billing/simulated/my-invoices', (request: MockRequest) => {
    if (!activa()) return notFound('La facturación simulada está apagada (billingSiatDemo = false)');
    if (request.user === null) return unauthorized('Sin sesión');
    const alcance = alcanceDeMisFacturas(request.user);
    const m = facturacion();
    const emisores = new Map(EMISORES_SIMULADOS.map((e) => [e.issuer.id, e.issuer]));
    const items: MyInvoiceItem[] = m
      .listarCobros()
      .filter((c) => c.latestInvoice !== null && alcance.incluye(c))
      .map((c) => ({
        invoice: c.latestInvoice!,
        chargeId: c.id,
        source: c.source,
        description: c.description,
        issuerName: emisores.get(c.issuerId)?.legalName ?? 'Emisor simulado',
        issuerNit: emisores.get(c.issuerId)?.nit ?? '',
        patientName: c.patientName,
        simulated: true as const,
      }))
      .sort((a, b) => b.invoice.issuedAt.localeCompare(a.invoice.issuedAt));
    return { view: alcance.vista, items, count: items.length, simulated: true };
  });

  router.get('/billing/simulated/my-invoices/:invoiceId', (request: MockRequest) => {
    if (!activa()) return notFound('La facturación simulada está apagada (billingSiatDemo = false)');
    if (request.user === null) return unauthorized('Sin sesión');
    const m = facturacion();
    const factura = m.factura(request.params['invoiceId']!);
    const cobro = factura === null ? null : m.cobro(factura.chargeId);
    if (factura === null || cobro === null || !alcanceDeMisFacturas(request.user).incluye(cobro)) {
      return notFound('La factura no existe');
    }
    return factura;
  });

  router.get(
    '/billing/simulated/outbox',
    con((_, m) => {
      const items = m.bandejaDeSalida();
      return { items, count: items.length, simulated: true };
    }),
  );
}
