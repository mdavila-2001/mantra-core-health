import { conceptoPorId } from '../fixtures/conceptos';
import { PACIENTES, PROFESIONALES, type ProfesionalSimulado } from '../fixtures/personas';
import { conflict, forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, isoDia, uuid } from '../mock-store';
import { nombreDeAseguradora, perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Solicitudes recibidas por la aseguradora — `GET /insurance/received-claims`.

    La cara de quien paga del mismo `insurance_claims` que el prestador ve en
    «Solicitudes de seguro». La API todavía no la expone; el contrato está en
    `docs/contracts/insurer-received-claims.md` (repo del front).

    Nadie real aparece acá: los médicos son los escritos de la maqueta y los
    `DEMO` —nunca los de la red de una aseguradora ni los registrados, porque
    atribuirles una prestación sería afirmar algo sobre alguien que existe— y
    los pacientes son los escritos y los generados, no las personas de
    `USUARIO_PACIENTES_1.md`.

    Además de leer, la aseguradora **dictamina**: aprueba, aprueba en parte o
    rechaza. El dictamen es definitivo (409 si ya hay uno) y, si es favorable,
    emite en el mismo acto la factura del prestador por el monto aprobado. La
    factura se puede anular con motivo y volver a emitir; el dictamen, no.
    ========================================================================== */

/** Cuántas solicitudes siembra el simulador: suficientes para paginar y filtrar. */
const SOLICITUDES_SEMBRADAS = 180;

/** Tope que declara el contrato: por encima, `truncated: true`. */
const TOPE_DE_SOLICITUDES = 500;

/** Pacientes escritos + los primeros generados; los registrados quedan fuera. */
const PACIENTES_ELEGIBLES = PACIENTES.slice(0, 60);

const BOB = { code: 'BOB', display: 'Boliviano' };
const money = (amount: string) => ({ amount, currency: BOB });

const SERVICIOS: readonly (readonly [code: string, display: string, precioBase: number])[] = [
  ['SVC_CONSULTA_ESPECIALIDAD', 'Consulta de especialidad', 250],
  ['SVC_CONSULTA_GENERAL', 'Consulta general', 150],
  ['SVC_ECOGRAFIA', 'Ecografía', 320],
  ['SVC_ECG', 'Electrocardiograma', 120],
  ['SVC_HEMOGRAMA', 'Hemograma completo', 80],
  ['SVC_PERFIL_LIPIDICO', 'Perfil lipídico', 90],
  ['SVC_RX_TORAX', 'Radiografía de tórax', 180],
  ['SVC_FISIOTERAPIA', 'Sesión de fisioterapia', 110],
  ['SVC_CIRUGIA_MENOR', 'Cirugía menor', 1200],
  ['SVC_INTERNACION_DIA', 'Internación (día)', 900],
];

/** Estado y qué fracción del monto aprueba (`null` = sin dictamen todavía). */
const ESTADOS: readonly (readonly [code: string, display: string, aprobado: number | null])[] = [
  ['SUBMITTED', 'Enviada', null],
  ['IN_REVIEW', 'En revisión', null],
  ['APPROVED', 'Aprobada', 0.8],
  ['PARTIAL', 'Aprobada parcialmente', 0.5],
  ['REJECTED', 'Rechazada', 0],
  ['PAID', 'Pagada', 0.8],
];

const PLANES = ['Plan Integral', 'Plan Familiar', 'Plan Oro'] as const;

/** Estados en los que la solicitud todavía espera dictamen. */
const ABIERTOS: ReadonlySet<string> = new Set(['SUBMITTED', 'IN_REVIEW']);

const DICTAMEN = {
  APPROVED: ['APPROVED', 'Aprobada'],
  PARTIAL: ['PARTIAL', 'Aprobada parcialmente'],
  REJECTED: ['REJECTED', 'Rechazada'],
} as const;

type Resultado = keyof typeof DICTAMEN;

/** Motivos con los que la maqueta siembra los dictámenes ya tomados. */
const MOTIVO_SEMBRADO: Readonly<Record<string, string | null>> = {
  APPROVED: null,
  PAID: null,
  PARTIAL: 'El plan cubre la mitad de este servicio.',
  REJECTED: 'El servicio no está cubierto por el plan de la póliza.',
};

const QUIEN_DICTAMINA_SEMBRADO = 'Patricia Suárez';

const DECIMAL = /^\d+(\.\d{1,2})?$/;

interface RenglonSimulado {
  readonly sequence: number;
  readonly code: string;
  readonly display: string;
  readonly quantity: number;
  readonly unitPrice: ReturnType<typeof money>;
  readonly billedAmount: ReturnType<typeof money>;
}

interface FacturaSimulada {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly amount: ReturnType<typeof money>;
  readonly status: 'ISSUED' | 'ANNULLED';
  readonly issuedAt: string;
  readonly annulledAt: string | null;
  readonly annulmentReason: string | null;
  readonly previous: readonly FacturaSimulada[];
}

function centavos(importe: string): number {
  const [entero, decimales = ''] = importe.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

function importe(totalCentavos: number): string {
  return `${Math.floor(totalCentavos / 100)}.${String(totalCentavos % 100).padStart(2, '0')}`;
}

/**
 * Los renglones de una solicitud: el servicio principal y los adicionales.
 * Salen de otra semilla que la de la sala para no mover ningún dato de los
 * que ya existían; el principal absorbe el redondeo y nunca queda por debajo
 * de un adicional, que es lo que el contrato promete de `service`.
 */
function renglonesDe(
  indice: number,
  principal: readonly [code: string, display: string],
  adicionales: number,
  total: string,
): RenglonSimulado[] {
  const r = azar(7_000_000 + indice);
  const otros = SERVICIOS.filter(([code]) => code !== principal[0]);
  const totalCentavos = centavos(total);
  const porAdicional = Math.min(8_500, Math.floor(totalCentavos / (adicionales + 1)));
  const renglones: RenglonSimulado[] = [];
  const principalCentavos = totalCentavos - porAdicional * adicionales;
  renglones.push(renglon(1, principal, principalCentavos));
  for (let k = 0; k < adicionales; k++) {
    const [code, display] = elegir(otros, r);
    renglones.push(renglon(k + 2, [code, display], porAdicional));
  }
  return renglones;
}

function renglon(sequence: number, [code, display]: readonly [string, string], monto: number): RenglonSimulado {
  return { sequence, code, display, quantity: 1, unitPrice: money(importe(monto)), billedAmount: money(importe(monto)) };
}

let correlativoDeFactura = 0;

function nuevaFactura(semilla: string, monto: string, emitidaEn: string, previas: readonly FacturaSimulada[] = []): FacturaSimulada {
  correlativoDeFactura += 1;
  return {
    id: uuid(`received-claim-invoice-${semilla}-${previas.length}`),
    invoiceNumber: `FAC-${String(4_100 + correlativoDeFactura).padStart(6, '0')}`,
    amount: money(monto),
    status: 'ISSUED',
    issuedAt: emitidaEn,
    annulledAt: null,
    annulmentReason: null,
    previous: previas,
  };
}

/** Generador congruencial: la misma semilla da siempre la misma sala. */
function azar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1_664_525) + 1_013_904_223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}

function elegir<T>(lista: readonly T[], r: () => number): T {
  return lista[Math.floor(r() * lista.length)]!;
}

function medicosElegibles(): readonly ProfesionalSimulado[] {
  return PROFESIONALES.filter((p) => p.origen === undefined || p.origen === 'DEMO');
}

function especialidadDe(medico: ProfesionalSimulado): string | null {
  const id = medico.especialidades[0];
  return id === undefined ? null : (conceptoPorId(id)?.display ?? null);
}

function sembrar() {
  const r = azar(20_260_927);
  const medicos = medicosElegibles();
  const aseguradora = nombreDeAseguradora(0);

  return Array.from({ length: SOLICITUDES_SEMBRADAS }, (_, i) => {
    const paciente = elegir(PACIENTES_ELEGIBLES, r);
    const medico = elegir(medicos, r);
    const [code, display, precioBase] = elegir(SERVICIOS, r);
    const adicionales = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0;
    const monto = precioBase * (0.9 + r() * 0.4) + adicionales * 85;
    // Las recientes siguen abiertas; las viejas ya tienen dictamen o pago.
    const diasAtras = Math.floor(r() * 180);
    const estado =
      diasAtras < 7
        ? elegir(ESTADOS.slice(0, 2), r)
        : diasAtras < 30
          ? elegir(ESTADOS.slice(1, 5), r)
          : elegir(ESTADOS.slice(2), r);
    const [estadoCode, estadoDisplay, fraccion] = estado;
    const prestacionDiasAtras = diasAtras + Math.floor(r() * 10);
    const total = monto.toFixed(2);
    const aprobado = fraccion === null ? null : (monto * fraccion).toFixed(2);
    const submittedAt = iso(-diasAtras, 8 + (i % 10), (i * 7) % 60);
    // El dictamen, a los dos días de recibida (o hoy, si todavía no pasaron).
    const decididaEn = iso(-Math.max(0, diasAtras - 2), 11, (i * 13) % 60);
    const decidida = fraccion !== null;

    return {
      id: uuid(`received-claim-${i}`),
      claimIdentifier: `CLM-2026-${String(1000 + i).padStart(4, '0')}`,
      patient: {
        id: paciente.id,
        displayName: paciente.displayName,
        patientCode: paciente.patientCode,
        memberIdentifier: `AF-${paciente.patientCode.slice(4)}`,
      },
      practitioner: {
        id: medico.id,
        displayName: medico.displayName,
        specialty: especialidadDe(medico),
      },
      providerName: medico.organizacion,
      service: { code, display },
      additionalServiceCount: adicionales,
      billedTotal: money(total),
      approvedTotal: aprobado === null ? null : money(aprobado),
      submittedAt,
      serviceDate: isoDia(-prestacionDiasAtras),
      policyIdentifier: `POL-${200300 + i * 13}`,
      planName: `${aseguradora} · ${elegir(PLANES, r)}`,
      status: { code: estadoCode, display: estadoDisplay },
      lines: renglonesDe(i, [code, display], adicionales, total),
      decision: decidida
        ? {
            outcome: estadoCode === 'PAID' ? 'APPROVED' : estadoCode,
            decidedAt: decididaEn,
            decidedBy: QUIEN_DICTAMINA_SEMBRADO,
            reason: MOTIVO_SEMBRADO[estadoCode] ?? null,
          }
        : null,
      invoice: decidida && estadoCode !== 'REJECTED' ? nuevaFactura(String(i), aprobado!, decididaEn) : null,
    };
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

type SolicitudSimulada = ReturnType<typeof sembrar>[number];

function puedeVer(request: MockRequest): boolean {
  return perteneceALaAseguradora(request) || (request.user?.roles.includes('SUPERADMIN') ?? false);
}

function quienDictamina(request: MockRequest): string {
  return request.user?.displayName.split(' · ')[0] ?? 'Aseguradora';
}

export interface OpcionesDeSolicitudesRecibidas {
  /** Las pruebas la apagan: cada una arranca de la siembra limpia. */
  readonly persistir?: boolean;
}

export function registerInsurerReceivedClaims(
  router: MockRouter,
  { persistir = true }: OpcionesDeSolicitudesRecibidas = {},
): void {
  // Se siembra una vez, al primer pedido; los dictámenes y las anulaciones
  // sobreviven a la recarga para que «no se puede revertir» se pueda comprobar.
  let tabla: Coleccion<SolicitudSimulada> | null = null;
  const solicitudes = (): Coleccion<SolicitudSimulada> =>
    (tabla ??= new Coleccion(sembrar(), persistir ? 'mock.insurerReceivedClaims' : undefined));

  const ordenadas = () =>
    solicitudes()
      .todos()
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  router.get('/insurance/received-claims', (request) => {
    if (!puedeVer(request)) return forbidden();
    const todas = ordenadas();
    return {
      items: todas.slice(0, TOPE_DE_SOLICITUDES),
      truncated: todas.length > TOPE_DE_SOLICITUDES,
    };
  });

  router.post('/insurance/received-claims/:id/decision', (request) => {
    if (!puedeVer(request)) return forbidden();
    const actual = solicitudes().get(request.params['id']!);
    if (actual === undefined) return notFound('La solicitud no existe');
    if (!ABIERTOS.has(actual.status.code) || actual.decision !== null) {
      return conflict('La solicitud ya tiene dictamen y no se puede cambiar', { reason: 'ALREADY_DECIDED' });
    }

    const datos = cuerpo<{ outcome: string; approvedAmount: string; reason: string }>(request);
    const outcome = datos.outcome as Resultado;
    if (!(outcome in DICTAMEN)) {
      return validation('Dictamen inválido', [{ field: 'outcome', problem: 'APPROVED, PARTIAL o REJECTED' }]);
    }
    const motivo = (datos.reason ?? '').trim();
    if (outcome !== 'APPROVED' && motivo.length < 5) {
      return validation('Falta el motivo', [{ field: 'reason', problem: 'Al menos 5 caracteres' }]);
    }

    const solicitado = centavos(actual.billedTotal.amount);
    let aprobado = outcome === 'APPROVED' ? solicitado : 0;
    if (outcome === 'PARTIAL') {
      const pedido = String(datos.approvedAmount ?? '');
      if (!DECIMAL.test(pedido) || centavos(pedido) <= 0 || centavos(pedido) >= solicitado) {
        return validation('Monto aprobado inválido', [
          { field: 'approvedAmount', problem: 'Mayor que cero y menor que el monto solicitado' },
        ]);
      }
      aprobado = centavos(pedido);
    }

    const [code, display] = DICTAMEN[outcome];
    const decididaEn = ahora();
    const monto = importe(aprobado);
    return solicitudes().actualizar(actual.id, {
      status: { code, display },
      approvedTotal: money(monto),
      decision: { outcome, decidedAt: decididaEn, decidedBy: quienDictamina(request), reason: motivo === '' ? null : motivo },
      invoice: outcome === 'REJECTED' ? null : nuevaFactura(actual.id, monto, decididaEn),
    });
  });

  router.post('/insurance/received-claims/:id/invoice/annulment', (request) => {
    if (!puedeVer(request)) return forbidden();
    const actual = solicitudes().get(request.params['id']!);
    if (actual === undefined) return notFound('La solicitud no existe');
    if (actual.invoice === null || actual.invoice.status !== 'ISSUED') {
      return conflict('La solicitud no tiene una factura vigente', { reason: 'NO_ACTIVE_INVOICE' });
    }
    if (actual.status.code === 'PAID') {
      return conflict('La factura ya está pagada: se corrige con una nota de crédito', { reason: 'ALREADY_PAID' });
    }
    const motivo = (cuerpo<{ reason: string }>(request).reason ?? '').trim();
    if (motivo.length < 5) {
      return validation('Falta el motivo', [{ field: 'reason', problem: 'Al menos 5 caracteres' }]);
    }
    return solicitudes().actualizar(actual.id, {
      invoice: { ...actual.invoice, status: 'ANNULLED', annulledAt: ahora(), annulmentReason: motivo },
    });
  });

  router.post('/insurance/received-claims/:id/invoice', (request) => {
    if (!puedeVer(request)) return forbidden();
    const actual = solicitudes().get(request.params['id']!);
    if (actual === undefined) return notFound('La solicitud no existe');
    if (actual.invoice === null || actual.invoice.status !== 'ANNULLED' || actual.approvedTotal === null) {
      return conflict('Sólo se vuelve a facturar una solicitud aprobada cuya factura se anuló', {
        reason: 'NOTHING_TO_REISSUE',
      });
    }
    const { previous, ...anulada } = actual.invoice;
    return solicitudes().actualizar(actual.id, {
      invoice: nuevaFactura(actual.id, actual.approvedTotal.amount, ahora(), [{ ...anulada, previous: [] }, ...previous]),
    });
  });
}
