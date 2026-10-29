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
  PaymentProof,
  RegisterPaymentInput,
  SimulatedCharge,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { PAYMENT_PROOF_MAX_BYTES, PAYMENT_PROOF_MIME_TYPES } from '../../data-access/billing-simulated/billing-simulated.types';
import { cobroPendienteDeReserva, initialCharges, SIMULATED_ISSUERS, SIMULATED_REGISTRY } from '../billing-sim/simulated-data';
import { PACIENTE } from '../fixtures/people';
import { reservas } from '../fixtures/agenda';
import { SimulatedInvoicing, type InvoicingError, type Result } from '../billing-sim/simulated-invoicing';
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
import { SiatSimulatedAdapter } from '../siat-sim/siat-simulated.adapter';
import { registrarPagoConfirmadoDeReserva } from './scheduling.handlers';

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
function sembrarFacturas(motor: SimulatedInvoicing, pacienteDeLaDemo: string | undefined): void {
  const cobros = motor.listCharges();
  if (cobros.some((c) => c.latestInvoice !== null)) return;
  const facturables = cobros
    .filter((c) => c.payment !== null && c.suggestedBuyer.documentNumber !== '')
    .reverse(); // de la más vieja a la más nueva: el correlativo sube con la fecha.
  const deLaDemo = facturables.filter((c) => c.patientProfileId === pacienteDeLaDemo);
  const deOtros = facturables.filter((c) => c.patientProfileId !== pacienteDeLaDemo).slice(-FACTURAS_SEMBRADAS_DE_OTROS);
  const elegidos = new Set([...deLaDemo, ...deOtros].map((c) => c.id));
  for (const cobro of facturables.filter((c) => elegidos.has(c.id))) {
    const { name, documentTypeCode, documentNumber, email } = cobro.suggestedBuyer;
    motor.issueInvoice(cobro.id, { buyer: { name, documentTypeCode, documentNumber, complement: null, email } }, 'semilla-demo');
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

function crearMotor(opciones: OpcionesDeFacturacionSimulada): SimulatedInvoicing {
  const persistir = opciones.persistir ?? true;
  const siat = new SiatSimulatedAdapter({
    padron: SIMULATED_REGISTRY,
    ...(opciones.reloj === undefined ? {} : { reloj: opciones.reloj }),
    ...(persistir ? { clavePersistencia: 'mock.billingSim.siat' } : {}),
  });
  return new SimulatedInvoicing({
    siat,
    emisores: SIMULATED_ISSUERS,
    cobros: initialCharges(),
    ...(opciones.reloj === undefined ? {} : { reloj: opciones.reloj }),
    ...(persistir ? { clavePersistencia: 'mock.billingSim.mantra' } : {}),
  });
}

function aRespuesta<T>(resultado: Result<T>, estadoOk = 200): MockReply {
  if (resultado.ok) return reply(estadoOk, resultado.value);
  return errorHttp(resultado.error);
}

function errorHttp(error: InvoicingError): MockReply {
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

/**
 * El comprobante del cuerpo, o el motivo por el que no sirve.
 *
 * Se valida en el servidor y no sólo en el formulario: la pantalla no es una
 * barrera. `undefined` es válido —el aviso sin archivo sigue existiendo—.
 */
function comprobanteDelCuerpo(cuerpoDePeticion: { readonly proof?: unknown }): PaymentProof | undefined | { readonly problem: string } {
  const crudo = cuerpoDePeticion.proof;
  if (crudo === undefined || crudo === null) return undefined;
  if (typeof crudo !== 'object') return { problem: 'El comprobante no tiene el formato esperado' };
  const { fileName, mimeType, sizeBytes, dataUrl } = crudo as Partial<PaymentProof>;
  if (typeof fileName !== 'string' || fileName.trim() === '' || typeof dataUrl !== 'string') {
    return { problem: 'El comprobante no tiene el formato esperado' };
  }
  if (typeof mimeType !== 'string' || !(PAYMENT_PROOF_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { problem: 'El comprobante tiene que ser una imagen JPG, PNG o WEBP, o un PDF' };
  }
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > PAYMENT_PROOF_MAX_BYTES || !dataUrl.startsWith(`data:${mimeType};base64,`)) {
    return { problem: 'El comprobante pesa más de 3 MB o está dañado' };
  }
  return { fileName: fileName.trim().slice(0, 120), mimeType, sizeBytes, dataUrl };
}

/** Los ids con que un cobro puede apuntar a una reserva: la reserva misma o su cita clínica. */
function referenciasDeReserva(bookingId: string | null): ReadonlySet<string> | null {
  if (bookingId === null) return null;
  const reserva = reservas.get(bookingId);
  return new Set([bookingId, reserva?.appointmentId].filter((id): id is string => id !== null && id !== undefined));
}

export function registrarFacturacionSimulada(router: MockRouter, opciones: OpcionesDeFacturacionSimulada = {}): void {
  const activa = opciones.activa ?? (() => environment.billingSiatDemo);
  let motor: SimulatedInvoicing | null = null;
  // Perezoso: los cobros salen de fixtures de agenda y farmacia; no se arman
  // hasta que alguien entra a facturación.
  const facturacion = (): SimulatedInvoicing => {
    if (motor === null) {
      motor = crearMotor(opciones);
      if (opciones.sembrarFacturas ?? opciones.persistir ?? true) {
        sembrarFacturas(motor, opciones.pacienteDeLaDemo ?? PACIENTE.id);
      }
    }
    return motor;
  };

  const pacienteActivo = (request: MockRequest): string | MockReply => {
    if (!environment.paymentDemo || !activa()) return notFound('Los pagos QR de demostración están apagados');
    if (request.user === null) return unauthorized('Sin sesión');
    if (!request.user.roles.includes('PATIENT') || request.user.patientProfileId === undefined) {
      return forbidden('Esta pantalla es para pacientes');
    }
    return request.user.patientProfileId;
  };

  // El portal del paciente sólo accede a cobros propios. El QR no registra
  // un pago: deja el comprobante como recibido y pendiente de revisión.
  router.get('/billing/simulated/patient/charges', (request) => {
    const paciente = pacienteActivo(request);
    if (isMockReply(paciente)) return paciente;
    const bookingId = request.query.get('bookingId');
    const referencias = referenciasDeReserva(bookingId);
    const propia = bookingId === null ? undefined : reservas.get(bookingId);
    // Una cita propia siempre abre su pago: si no tenía cobro, se crea.
    if (propia !== undefined && propia.patientProfileId === paciente) facturacion().asegurarCobro(cobroPendienteDeReserva(propia));
    const items = facturacion().listCharges().filter((c) =>
      c.source === 'CONSULTATION' && c.patientProfileId === paciente &&
      (referencias === null || referencias.has(c.sourceRef) || c.plan?.instances.some((i) => i.bookingId === bookingId)),
    );
    return { items, count: items.length, simulated: true };
  });

  router.post('/billing/simulated/patient/charges/:chargeId/report', (request) => {
    const paciente = pacienteActivo(request);
    if (isMockReply(paciente)) return paciente;
    const cobro = facturacion().charge(request.params['chargeId']!);
    if (cobro === null || cobro.source !== 'CONSULTATION' || cobro.patientProfileId !== paciente) return notFound('El cobro no existe');
    const comprobante = comprobanteDelCuerpo(cuerpo<{ proof: unknown }>(request));
    if (comprobante !== undefined && 'problem' in comprobante) {
      return validation('El comprobante no es válido', [{ field: 'proof', message: comprobante.problem }]);
    }
    return aRespuesta(facturacion().informarPagoDelPaciente(cobro.id, comprobante), 201);
  });

  // «Ver pagos» en la consulta: quien atiende ve los avisos recibidos y puede
  // confirmarlos. La confirmación crea SimulatedPayment, que es lo que cuenta
  // para facturación e ingresos.
  router.get('/billing/simulated/payment-reports', (request) => {
    if (request.user === null) return unauthorized('Sin sesión');
    const profesional = request.user.practitionerProfileId;
    const tieneAlcance = request.user.roles.some((rol) => ROLES_DE_FACTURACION.includes(rol)) ||
      (profesional !== undefined && request.user.roles.some((rol) => ROLES_DEL_CONSULTORIO.includes(rol)));
    if (!tieneAlcance) return forbidden('Su rol no permite revisar pagos');
    const items = facturacion().listCharges().filter((c) =>
      c.patientPaymentReport !== null && c.patientPaymentReport !== undefined &&
      (request.user!.roles.some((rol) => ROLES_DE_FACTURACION.includes(rol)) || c.practitionerProfileId === profesional) &&
      (request.query.get('patientProfileId') === null || c.patientProfileId === request.query.get('patientProfileId')),
    );
    return { items, count: items.length, simulated: true };
  });

  router.post('/billing/simulated/payment-reports/:chargeId/confirm', (request) => {
    if (request.user === null) return unauthorized('Sin sesión');
    const profesional = request.user.practitionerProfileId;
    const tieneAlcance = request.user.roles.some((rol) => ROLES_DE_FACTURACION.includes(rol)) ||
      (profesional !== undefined && request.user.roles.some((rol) => ROLES_DEL_CONSULTORIO.includes(rol)));
    if (!tieneAlcance) return forbidden('Su rol no permite confirmar pagos');
    const cobro = facturacion().charge(request.params['chargeId']!);
    if (cobro === null || (profesional !== undefined && !request.user.roles.some((rol) => ROLES_DE_FACTURACION.includes(rol)) && cobro.practitionerProfileId !== profesional)) {
      return notFound('El cobro no existe');
    }
    const resultado = facturacion().confirmarPagoInformado(cobro.id);
    if (resultado.ok && cobro.source === 'CONSULTATION') registrarPagoConfirmadoDeReserva(cobro.sourceRef, cobro.total);
    return aRespuesta(resultado);
  });

  /**
   * Apagada → 404; sin sesión → 401; sin rol → 403. Con `consultorio`, quien
   * atiende también entra —si tiene perfil profesional— y el manejador recibe
   * su alcance: los cobros de las citas que atendió.
   */
  const con =
    (
      manejador: (request: MockRequest, motor: SimulatedInvoicing, alcance: Alcance) => MockReply | unknown,
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
  const cobroDe = (m: SimulatedInvoicing, id: string, alcance: Alcance): SimulatedCharge | MockReply => {
    const cobro = m.charge(id);
    if (cobro === null || !dentroDelAlcance(cobro, alcance)) return notFound('El cobro no existe');
    return cobro;
  };

  router.get(
    '/billing/simulated/status',
    con(
      (_, m, alcance) => {
        const estado = m.statusFiscal();
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
    con((_, m) => m.catalogs(), { consultorio: true }),
  );

  // `?patientProfileId=` acota a una persona: es la lectura de «Pagos» dentro
  // de la consulta. Sin él, la lista entera (la pantalla de facturación).
  router.get(
    '/billing/simulated/charges',
    con(
      (request, m, alcance) => {
        const paciente = request.query.get('patientProfileId');
        const bookingId = request.query.get('bookingId');
        const referencias = referenciasDeReserva(bookingId);
        // Quien atiende ve el cobro de la cita aunque nadie lo haya cargado todavía.
        const cita = bookingId === null ? undefined : reservas.get(bookingId);
        const pendiente = cita === undefined ? null : cobroPendienteDeReserva(cita);
        if (pendiente !== null && (alcance.todo || pendiente.practitionerProfileId === alcance.profesional)) {
          m.asegurarCobro(pendiente);
        }
        const items = m
          .listCharges()
          .filter((c) => dentroDelAlcance(c, alcance))
          .filter((c) => paciente === null || paciente === '' || c.patientProfileId === paciente)
          .filter((c) => referencias === null || referencias.has(c.sourceRef) || (c.plan?.instances.some((i) => i.bookingId === bookingId) ?? false));
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
        return aRespuesta(m.registerPayment(cobro.id, Number(datos.methodCode)), 201);
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
          m.instanceRegisterPayment(cobro.id, request.params['instanceId']!, {
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
        return aRespuesta(m.issueInvoice(cobro.id, datos, usuario), 201);
      },
      { consultorio: true },
    ),
  );

  router.get(
    '/billing/simulated/invoices/:invoiceId',
    con(
      (request, m, alcance) => {
        const factura = m.invoice(request.params['invoiceId']!);
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
      return aRespuesta(m.void(request.params['invoiceId']!, Number(datos.reasonCode)));
    }),
  );

  router.post(
    '/billing/simulated/invoices/:invoiceId/annulment-reversal',
    con((request, m) => aRespuesta(m.revertVoiding(request.params['invoiceId']!))),
  );

  router.post(
    '/billing/simulated/invoices/:invoiceId/email',
    con((request, m) => {
      const datos = cuerpo<EmailInvoiceInput>(request);
      return aRespuesta(m.enqueueEmail(request.params['invoiceId']!, String(datos.to ?? '')), 201);
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
    const emisores = new Map(SIMULATED_ISSUERS.map((e) => [e.issuer.id, e.issuer]));
    const items: MyInvoiceItem[] = m
      .listCharges()
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
    const factura = m.invoice(request.params['invoiceId']!);
    const cobro = factura === null ? null : m.charge(factura.chargeId);
    if (factura === null || cobro === null || !alcanceDeMisFacturas(request.user).incluye(cobro)) {
      return notFound('La factura no existe');
    }
    return factura;
  });

  router.get(
    '/billing/simulated/outbox',
    con((_, m) => {
      const items = m.outputInbox();
      return { items, count: items.length, simulated: true };
    }),
  );
}
