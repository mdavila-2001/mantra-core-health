import { HttpHeaders } from '@angular/common/http';

import type { WireSupportAgenda } from '../../data-access/support-access/support-agenda.wire';
import type { SupportInboxPage } from '../../data-access/support-access/support-inbox.types';
import { ajustesDeAgenda, permisos, SUAREZ, vinculos } from '../fixtures/support-hospital';
import { agendaDePartida } from '../fixtures/support-hospital-agenda';
import { aprobaciones, banderasDePacientes } from '../fixtures/support-hospital-governance';
import { pacienteDeConversacion } from '../fixtures/support-hospital-inbox';
import { patientList } from '../fixtures/people';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { iso, uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import { perfilDelDoctor } from './support-access.agenda-view';
import { CODIGO_DE_PRUEBA } from './iam-mfa.store';
import { reiniciarElGobiernoDeAccesos, reiniciarLaSesionDelSimulador } from './mock-reset';
import { negarSiNoPuede } from './support-access.core';
import { reiniciarTopeDeBusquedas } from './support-access.patients.handlers';

/**
 * Los **desafíos** de agenda, bandeja, búsqueda de pacientes y caja en el simulador: la API dice «falta algo» (motivo, segundo paso,
 * aprobación) en vez de «no», con la forma del mapa DENY/CHALLENGE → HTTP. Cada prueba parte del piloto de fábrica.
 */
let router: MockRouter;
const marcos = buscarUsuario('marcos')!;
const ana = buscarUsuario('ana')!;
/** Mario (caja): cuenta del simulador con el vínculo del piloto. */
const mario: MockUser = buscarUsuario('mario')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}
interface Fallo {
  reason?: string;
  details?: Record<string, unknown>;
}

function llamar<T = unknown>(
  user: MockUser,
  method: MockMethod,
  path: string,
  body?: unknown,
  encabezados: Record<string, string> = {},
): Respuesta<T> {
  const [ruta, cadena] = path.split('?');
  const match = router.match(method, ruta!);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path: ruta!,
    params: match.params,
    query: new URLSearchParams(cadena ?? ''),
    body: body ?? null,
    headers: new HttpHeaders({ 'X-Tenant-Id': TENANT_HOSPITAL_PILOTO, ...encabezados }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}
const conPasoExtra = (user: MockUser): void => {
  expect(llamar(user, 'POST', '/iam/me/step-up', { code: CODIGO_DE_PRUEBA }).status).toBe(200);
};

/** Una cita de Suárez en el norte (lo que cubre Marcos) que empieza dentro de `desdeHoras`..`hastaHoras`, ocupada y con su paciente. */
function citaDeSuarez(
  desdeHoras: number,
  hastaHoras: number,
): { readonly id: string; readonly start: string } {
  const fila = agendaDePartida().find((f) => {
    const horas = (new Date(f.start).getTime() - Date.now()) / 3_600_000;
    return (
      f.doctorId === SUAREZ.id &&
      horas > desdeHoras &&
      horas < hastaHoras &&
      negarSiNoPuede(marcos, f, 'schedule.cancel') === null
    );
  });
  expect(fila, 'el piloto trae una cita de Suárez en esa ventana').toBeDefined();
  ajustesDeAgenda.agregar({
    id: fila!.id,
    status: 'CONFIRMED',
    patientLabel: 'Rosa Mamani · CI ***556',
    reasonLabel: 'Control de rutina',
  });
  return { id: fila!.id, start: fila!.start };
}

const cancelar = (
  user: MockUser,
  id: string,
  cuerpo: Record<string, unknown>,
  encabezados?: Record<string, string>,
) =>
  llamar<Fallo>(
    user,
    'POST',
    `/scheduling/bookings/${id}/cancel`,
    { cancelledBy: 'PROVIDER', ...cuerpo },
    encabezados,
  );

/** Una aprobación de acción ya dada a Marcos para cancelar, vigente una hora. */
function aprobadaParaMarcos(
  atom = 'agenda.appointment.cancel',
  estado: 'APPROVED' | 'PENDING' = 'APPROVED',
): string {
  const id = uuid(`spec-aprobacion-${atom}-${estado}`);
  aprobaciones.agregar({
    id,
    tenantId: TENANT_HOSPITAL_PILOTO,
    kind: 'ACTION',
    status: estado,
    approverKind: 'DOCTOR',
    atom,
    requesterUserId: marcos.id,
    subjectUserId: marcos.id,
    reasonText: 'El paciente avisó que no viene.',
    createdAt: iso(0, 8, 0),
    expiresAt: iso(1, 8, 0),
    summary: 'Marcos Ribera pide cancelar una cita.',
    ...(estado === 'APPROVED'
      ? { approvedUntil: new Date(Date.now() + 3_600_000).toISOString() }
      : {}),
  });
  return id;
}

describe('desafíos de agenda, bandeja, búsqueda y caja en el simulador', () => {
  afterAll(() => {
    // Este archivo mueve citas, permisos, aprobaciones y banderas: el siguiente parte del piloto de fábrica.
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    reiniciarTopeDeBusquedas();
  });

  beforeEach(() => {
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    reiniciarTopeDeBusquedas();
    router = crearRouterSimulado();
  });

  describe('agenda: cancelar con poca antelación', () => {
    it('sin motivo es 422 REASON_REQUIRED; con motivo y sin aprobación, 403 APPROVAL_REQUIRED con quién aprueba y para qué', () => {
      const cita = citaDeSuarez(0.2, 20);
      expect(cancelar(marcos, cita.id, {}).body).toMatchObject({ reason: 'REASON_REQUIRED' });

      const r = cancelar(marcos, cita.id, { reasonText: 'La mamá avisó que no puede venir.' });

      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({
        reason: 'APPROVAL_REQUIRED',
        details: { approverKind: 'DOCTOR', atom: 'agenda.appointment.cancel', ttlMinutes: 60 },
      });
      expect(ajustesDeAgenda.get(cita.id)?.status).toBe('CONFIRMED');
    });

    it('con la aprobación del doctor en `X-Approval-Id` se cancela y la aprobación se consume una sola vez', () => {
      const cita = citaDeSuarez(0.2, 20);
      const aprobacion = aprobadaParaMarcos();

      const hecho = cancelar(
        marcos,
        cita.id,
        { reasonText: 'La mamá avisó que no puede venir.' },
        { 'X-Approval-Id': aprobacion },
      );

      expect(hecho.status).toBe(200);
      expect(ajustesDeAgenda.get(cita.id)?.status).toBe('FREE');
      expect(aprobaciones.get(aprobacion)).toMatchObject({ status: 'CONSUMED' });

      // La misma aprobación no sirve para otra cita.
      const otra = citaDeSuarez(0.2, 22);
      ajustesDeAgenda.agregar({
        id: otra.id,
        status: 'CONFIRMED',
        patientLabel: 'Juan Carlos Vaca · CI ***102',
      });
      const repetida = cancelar(
        marcos,
        otra.id,
        { reasonText: 'Otra cancelación distinta.' },
        { 'X-Approval-Id': aprobacion },
      );
      expect(repetida.status).toBe(409);
      expect(repetida.body).toMatchObject({ reason: 'FOUR_EYES_ALREADY_CONSUMED' });
    });

    it('una aprobación de otra acción es 409 FOUR_EYES_PAYLOAD_CHANGED; una que aún no se decidió vuelve a pedir la aprobación', () => {
      const cita = citaDeSuarez(0.2, 20);
      const deOtraAccion = aprobadaParaMarcos('agenda.appointment.reschedule');
      expect(
        cancelar(
          marcos,
          cita.id,
          { reasonText: 'La mamá avisó que no puede venir.' },
          { 'X-Approval-Id': deOtraAccion },
        ).body,
      ).toMatchObject({ reason: 'FOUR_EYES_PAYLOAD_CHANGED' });

      const pendiente = aprobadaParaMarcos('agenda.appointment.cancel', 'PENDING');
      const r = cancelar(
        marcos,
        cita.id,
        { reasonText: 'La mamá avisó que no puede venir.' },
        { 'X-Approval-Id': pendiente },
      );
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({
        reason: 'APPROVAL_REQUIRED',
        details: { approvalProblem: 'FOUR_EYES_PENDING' },
      });
    });

    it('con antelación suficiente no hay desafío: es un solo paso', () => {
      const cita = citaDeSuarez(30, 24 * 8);
      expect(
        cancelar(marcos, cita.id, { reasonText: 'La mamá avisó que no puede venir.' }).status,
      ).toBe(200);
    });

    it('el doctor aprueba desde su bandeja y la aprobación sirve para reintentar', () => {
      const cita = citaDeSuarez(0.2, 20);
      expect(
        cancelar(marcos, cita.id, { reasonText: 'La mamá avisó que no puede venir.' }).status,
      ).toBe(403);
      const pedida = llamar<{ id: string }>(marcos, 'POST', '/me/support-approvals', {
        tenantId: TENANT_HOSPITAL_PILOTO,
        atom: 'agenda.appointment.cancel',
        reasonText: 'La mamá avisó que no viene.',
      });
      // Ya existía la de la demostración (Marcos, A4): la pendiente es la misma.
      const idPendiente =
        pedida.status === 201 ? pedida.body.id : uuid('demo-gov-approval-marcos-a4');
      const suarez = buscarUsuario('suarez')!;
      expect(
        llamar(suarez, 'POST', `/approvals/${idPendiente}/decision`, { decision: 'APPROVE' })
          .status,
      ).toBe(200);

      expect(
        cancelar(
          marcos,
          cita.id,
          { reasonText: 'La mamá avisó que no puede venir.' },
          { 'X-Approval-Id': idPendiente },
        ).status,
      ).toBe(200);
    });
  });

  describe('bandeja y búsqueda de pacientes reservados', () => {
    const primeraConversacion = (): { id: string; patientProfileId: string } => {
      const bandeja = llamar<SupportInboxPage>(
        ana,
        'GET',
        `/me/support-inbox?tenantId=${TENANT_HOSPITAL_PILOTO}`,
      ).body;
      const item = bandeja.items.find(
        (i) => pacienteDeConversacion(i.conversationId) !== undefined,
      )!;
      return {
        id: item.conversationId,
        patientProfileId: pacienteDeConversacion(item.conversationId)!.id,
      };
    };
    const marcar = (patientProfileId: string): void => {
      banderasDePacientes.agregar({
        id: uuid(`spec-bandera-${patientProfileId}`),
        patientProfileId,
        flag: 'VIP',
        reason: 'Autoridad pública',
        validFrom: iso(-1),
      });
    };

    it('la conversación de un paciente con bandera sale como «Reservado» en la lista, sin nombre ni texto', () => {
      const { id, patientProfileId } = primeraConversacion();
      marcar(patientProfileId);

      const item = llamar<SupportInboxPage>(
        ana,
        'GET',
        `/me/support-inbox?tenantId=${TENANT_HOSPITAL_PILOTO}`,
      ).body.items.find((i) => i.conversationId === id)!;

      expect(item).toMatchObject({
        denialReason: 'RESERVED',
        patientLabel: 'Reservado',
        lastMessagePreview: '',
      });
      expect(item.lastPatientMessage).toBeUndefined();
    });

    it('responder en nombre del doctor a un paciente reservado pide el segundo paso; sin bandera, no', () => {
      const { id, patientProfileId } = primeraConversacion();
      const bandeja = llamar<SupportInboxPage>(
        ana,
        'GET',
        `/me/support-inbox?tenantId=${TENANT_HOSPITAL_PILOTO}`,
      ).body;
      const item = bandeja.items.find((i) => i.conversationId === id)!;
      const cuerpo = {
        senderProfileId: item.doctorPublicProfileId,
        onBehalfOfProfileId: item.doctorPublicProfileId,
        bodyText: 'Su cita sigue en pie.',
      };
      expect(
        llamar<Fallo>(ana, 'POST', `/community/conversations/${id}/messages`, cuerpo).body.reason,
      ).not.toBe('STEP_UP_REQUIRED');

      marcar(patientProfileId);
      const r = llamar<Fallo>(ana, 'POST', `/community/conversations/${id}/messages`, cuerpo);
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({
        reason: 'STEP_UP_REQUIRED',
        details: { maxAgeMinutes: 10, enrolled: true },
      });
      conPasoExtra(ana);
      expect(
        llamar<Fallo>(ana, 'POST', `/community/conversations/${id}/messages`, cuerpo).body.reason,
      ).not.toBe('STEP_UP_REQUIRED');
    });

    /**
     * Pendiente 58: la API real NO desafía en la búsqueda de pacientes (`SupportPatientSearchDto` no admite motivo y la ruta no
     * emite `STEP_UP_REQUIRED`): lo que protege a un paciente reservado lo decide el servidor. El mock no inventa un desafío que la
     * API no emite (los de agenda, bandeja, respuesta, explain, permisos y aprobaciones sí quedan).
     */
    it('buscar por documento a un paciente reservado NO pide el segundo paso: la API real no desafía en la búsqueda', () => {
      const paciente = patientList.todos().find(
        (p) =>
          llamar<{ items: unknown[] }>(ana, 'POST', '/me/support-patient-search', {
            tenantId: TENANT_HOSPITAL_PILOTO,
            nationalId: p.nationalId,
          }).body.items?.length > 0,
      )!;
      marcar(paciente.id);

      const r = llamar<{ items: { displayName: string }[] } & Fallo>(ana, 'POST', '/me/support-patient-search', {
        tenantId: TENANT_HOSPITAL_PILOTO,
        nationalId: paciente.nationalId,
      });
      expect(r.status).toBe(200);
      expect(r.body.reason).toBeUndefined();
      expect(r.body.items[0]!.displayName).toBe(paciente.displayName);
    });
  });

  describe('agenda: bloques «Reservado»', () => {
    it('una cita de un paciente con bandera sale sin paciente ni acciones, con `RESERVED`, para quien ve al doctor', () => {
      const paciente = patientList.todos()[0]!;
      const etiqueta = `${paciente.displayName} · CI ***${paciente.nationalId.slice(-3)}`;
      const fila = agendaDePartida().find(
        (f) =>
          f.doctorId === SUAREZ.id &&
          f.start > new Date().toISOString() &&
          negarSiNoPuede(marcos, f, 'schedule.view') === null,
      )!;
      ajustesDeAgenda.agregar({
        id: fila.id,
        status: 'CONFIRMED',
        patientLabel: etiqueta,
        reasonLabel: 'Control',
      });
      const pedir = (): WireSupportAgenda['items'][number] => {
        const desde = encodeURIComponent(new Date(Date.parse(fila.start) - 60_000).toISOString());
        const hasta = encodeURIComponent(new Date(Date.parse(fila.start) + 60_000).toISOString());
        const agenda = llamar<WireSupportAgenda>(
          marcos,
          'GET',
          `/me/support-agenda?org=${TENANT_HOSPITAL_PILOTO}&from=${desde}&to=${hasta}`,
        ).body;
        return agenda.items.find(
          (i) =>
            i.startAt === fila.start && i.practitionerProfileId === perfilDelDoctor(fila.doctorId),
        )!;
      };
      expect(pedir().patientName).toBe(etiqueta);

      banderasDePacientes.agregar({
        id: uuid('spec-bandera-agenda'),
        patientProfileId: paciente.id,
        flag: 'CONFIDENTIAL',
        reason: 'Pedido del paciente',
        validFrom: iso(-1),
      });

      const reservado = pedir();
      expect(reservado).toMatchObject({ denialReason: 'RESERVED', allowedActions: [] });
      expect(reservado.patientName).toBeUndefined();
      expect(reservado.patientProfileId).toBeUndefined();
      expect(reservado.bookingId).toBeUndefined();
    });
  });

  /**
   * Pendiente 58 (y 45): la API real no tiene un PEP de facturación (`billing.receipt.void` no consulta la política). El mock no
   * anula con motivo, segundo paso y aprobación de un segundo administrador, que la API no pide: pasa como cualquier cuenta.
   */
  describe('caja: anular un comprobante no desafía (la API real no tiene PEP de facturación)', () => {
    const anular = (user: MockUser, cuerpo: Record<string, unknown> = {}) =>
      llamar<Fallo>(user, 'POST', '/billing/simulated/invoices/factura-1/annulment', { reasonCode: 1, ...cuerpo });
    const DESAFIOS = ['REASON_REQUIRED', 'REASON_PLACEHOLDER', 'STEP_UP_REQUIRED', 'APPROVAL_REQUIRED'];

    it('una persona de apoyo, con o sin el permiso, no recibe motivo, segundo paso ni aprobación', () => {
      const suyos = vinculos.filtrar((v) => v.userId === mario.id).map((v) => v.id);
      const fila = permisos.filtrar((p) => suyos.includes(p.engagementId) && p.status === 'ACTIVE' && p.atoms !== undefined)[0]!;
      permisos.actualizar(fila.id, { atoms: [...fila.atoms!, 'billing.receipt.void'] });
      for (const cuerpo of [{}, { reasonText: 'El comprobante salió con el monto equivocado.' }]) {
        const r = anular(mario, cuerpo);
        expect(DESAFIOS).not.toContain(r.body.reason);
      }
    });

    it('el administrador de la facturación tampoco pasa por desafíos', () => {
      expect(DESAFIOS).not.toContain(anular(buscarUsuario('admin')!).body.reason);
    });
  });
});
