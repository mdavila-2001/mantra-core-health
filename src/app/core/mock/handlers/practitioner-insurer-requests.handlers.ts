import { PROFESSIONALS } from '../fixtures/people';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { IDS } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, uuid } from '../mock-store';
import {
  aseguradoraDelCatalogo,
  CARRIER_DE_LA_SESION,
  perteneceALaAseguradora,
} from './insurance.handlers';

/**
 * Simulador de la solicitud médico → aseguradora (API v4.2.64,
 * `insurance.practitioner_insurer_requests`).
 *
 * Mismo contrato que `PractitionerInsurerRequestsController` e
 * `InsurerPractitionerRequestsController`: los estados viajan como clave, una
 * fila por médico y aseguradora, lo rechazado o retirado se reabre, y la
 * aseguradora sólo ve y decide lo suyo.
 */

export type EstadoDeSolicitud = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface SolicitudAAseguradora {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly carrierId: string;
  readonly status: EstadoDeSolicitud;
  readonly decisionReasonText: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

const MEDICA = IDS.medica.practitionerProfileId;

/**
 * La médica demo arranca con una de cada: aprobada, pendiente y rechazada con
 * motivo. Es lo que hace falta para ver la hoja de ruta y la bandeja completas
 * sin tener que jugar del otro lado.
 */
const SEMILLA: readonly SolicitudAAseguradora[] = [
  {
    id: uuid('ins-req-medica-andina'),
    practitionerProfileId: MEDICA,
    carrierId: uuid('carrier-andina'),
    status: 'PENDING',
    decisionReasonText: null,
    createdAt: iso(-2, 10, 5),
    decidedAt: null,
  },
  {
    id: uuid('ins-req-medica-vitalicia'),
    practitionerProfileId: MEDICA,
    carrierId: uuid('carrier-vitalicia'),
    status: 'APPROVED',
    decisionReasonText: null,
    createdAt: iso(-9, 9, 30),
    decidedAt: iso(-7, 16, 12),
  },
  {
    id: uuid('ins-req-medica-alianza'),
    practitionerProfileId: MEDICA,
    carrierId: uuid('carrier-alianza'),
    status: 'REJECTED',
    decisionReasonText:
      'Por ahora no sumamos prestadores en su especialidad. Puede volver a pedirlo en tres meses.',
    createdAt: iso(-12, 11, 0),
    decidedAt: iso(-10, 15, 40),
  },
  // Para que la bandeja de la aseguradora demo no arranque vacía.
  ...PROFESSIONALS.slice(2, 4).map((p, i) => ({
    id: uuid(`ins-req-${p.id}-andina`),
    practitionerProfileId: p.id,
    carrierId: uuid('carrier-andina'),
    status: 'PENDING' as const,
    decisionReasonText: null,
    createdAt: iso(-1 - i, 8 + i, 20),
    decidedAt: null,
  })),
];

export const solicitudesAAseguradoras = new Coleccion<SolicitudAAseguradora>(
  SEMILLA,
  'mock:practitioner-insurer-requests',
);

function nombreDeAseguradora(carrierId: string): string {
  return aseguradoraDelCatalogo(carrierId)?.name ?? '';
}

function vistaPropia(s: SolicitudAAseguradora) {
  return {
    id: s.id,
    carrierId: s.carrierId,
    carrierName: nombreDeAseguradora(s.carrierId),
    status: s.status,
    decisionReasonText: s.decisionReasonText,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt,
  };
}

function vistaRecibida(s: SolicitudAAseguradora) {
  const p = PROFESSIONALS.find((x) => x.id === s.practitionerProfileId);
  return {
    id: s.id,
    practitionerProfileId: s.practitionerProfileId,
    practitionerName: p?.displayName ?? null,
    professionalTitle: p?.professionalTitle ?? null,
    status: s.status,
    decisionReasonText: s.decisionReasonText,
    createdAt: s.createdAt,
    decidedAt: s.decidedAt,
  };
}

/**
 * Pide varias aseguradoras para un profesional, con las reglas de la API.
 * Lo usa también el alta simulada (`/iam/auth/register-practitioner`).
 *
 * @returns Las creadas o reabiertas; `null` si alguna aseguradora no existe.
 */
export function pedirAseguradoras(
  practitionerProfileId: string,
  carrierIds: readonly string[],
): { pedidas: SolicitudAAseguradora[]; vivas: number } | null {
  const ids = [...new Set(carrierIds)];
  if (ids.some((id) => aseguradoraDelCatalogo(id) === undefined)) {
    return null;
  }
  const pedidas: SolicitudAAseguradora[] = [];
  let vivas = 0;
  for (const carrierId of ids) {
    const existente = solicitudesAAseguradoras.filtrar(
      (s) => s.practitionerProfileId === practitionerProfileId && s.carrierId === carrierId,
    )[0];
    if (
      existente !== undefined &&
      (existente.status === 'PENDING' || existente.status === 'APPROVED')
    ) {
      vivas += 1;
      continue;
    }
    const fila: SolicitudAAseguradora = {
      id: existente?.id ?? uuid(`ins-req-${practitionerProfileId}-${carrierId}`),
      practitionerProfileId,
      carrierId,
      status: 'PENDING',
      decisionReasonText: null,
      createdAt: ahora(),
      decidedAt: null,
    };
    if (existente === undefined) {
      solicitudesAAseguradoras.agregar(fila);
    } else {
      solicitudesAAseguradoras.actualizar(fila.id, fila);
    }
    pedidas.push(fila);
  }
  return { pedidas, vivas };
}

function propias(practitionerProfileId: string) {
  const items = solicitudesAAseguradoras
    .filtrar((s) => s.practitionerProfileId === practitionerProfileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(vistaPropia);
  return { items, count: items.length };
}

function decidir(request: MockRequest, estado: 'APPROVED' | 'REJECTED', motivo: string | null) {
  if (!perteneceALaAseguradora(request)) {
    return forbidden(
      'Sólo la aseguradora activa puede ver y decidir las solicitudes de profesionales',
    );
  }
  const fila = solicitudesAAseguradoras.get(request.params['id']!);
  if (fila === undefined || fila.carrierId !== CARRIER_DE_LA_SESION) {
    return notFound('Solicitud no encontrada');
  }
  if (fila.status !== 'PENDING') {
    return preconditionFailed('La solicitud ya fue decidida o retirada', { id: fila.id });
  }
  const decidida = solicitudesAAseguradoras.actualizar(fila.id, {
    status: estado,
    decisionReasonText: motivo,
    decidedAt: ahora(),
  });
  return { status: 200, body: vistaRecibida(decidida ?? fila) };
}

export function registerPractitionerInsurerRequests(router: MockRouter): void {
  router.get('/practitioners/me/insurer-requests', (request) => {
    const hpid = request.user?.practitionerProfileId;
    if (hpid === undefined) {
      return preconditionFailed('La cuenta no tiene un perfil profesional asociado');
    }
    return propias(hpid);
  });

  router.post('/practitioners/me/insurer-requests', (request) => {
    const hpid = request.user?.practitionerProfileId;
    if (hpid === undefined) {
      return preconditionFailed('La cuenta no tiene un perfil profesional asociado');
    }
    const datos = cuerpo<{ carrierIds: string[] }>(request);
    const resultado = pedirAseguradoras(hpid, datos.carrierIds ?? []);
    if (resultado === null) {
      return preconditionFailed('Alguna de las aseguradoras indicadas no existe o no está activa');
    }
    if (resultado.pedidas.length === 0) {
      return conflict('Ya pidió trabajar con esas aseguradoras');
    }
    return { status: 201, body: propias(hpid) };
  });

  router.post('/practitioners/me/insurer-requests/:id/withdraw', (request) => {
    const hpid = request.user?.practitionerProfileId;
    const fila = solicitudesAAseguradoras.get(request.params['id']!);
    if (fila === undefined || fila.practitionerProfileId !== hpid) {
      return notFound('Solicitud no encontrada');
    }
    if (fila.status !== 'PENDING') {
      return preconditionFailed('Sólo se puede retirar una solicitud pendiente', { id: fila.id });
    }
    const retirada = solicitudesAAseguradoras.actualizar(fila.id, { status: 'WITHDRAWN' });
    return { status: 200, body: vistaPropia(retirada ?? fila) };
  });

  router.get('/insurance/practitioner-requests', (request) => {
    if (!perteneceALaAseguradora(request)) {
      return forbidden(
        'Sólo la aseguradora activa puede ver y decidir las solicitudes de profesionales',
      );
    }
    const mias = solicitudesAAseguradoras.filtrar(
      (s) => s.carrierId === CARRIER_DE_LA_SESION && s.status !== 'WITHDRAWN',
    );
    const pendientes = mias
      .filter((s) => s.status === 'PENDING')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const decididas = mias
      .filter((s) => s.status !== 'PENDING')
      .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
    const items = [...pendientes, ...decididas].map(vistaRecibida);
    return { items, count: items.length };
  });

  router.post('/insurance/practitioner-requests/:id/approve', (request) =>
    decidir(request, 'APPROVED', null),
  );

  router.post('/insurance/practitioner-requests/:id/reject', (request) => {
    const motivo = cuerpo<{ reason: string }>(request).reason?.trim();
    return decidir(request, 'REJECTED', motivo === undefined || motivo === '' ? null : motivo);
  });
}
