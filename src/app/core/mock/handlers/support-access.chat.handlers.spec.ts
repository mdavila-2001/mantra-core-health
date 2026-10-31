import { HttpHeaders } from '@angular/common/http';

import type { WireSupportAgenda } from '../../data-access/support-access/support-agenda.wire';
import type { ConversationAssignment, InternalNote, ReplyTemplate, ReplyTemplatePage, SupportConversation, SupportInboxPage } from '../../data-access/support-access/support-inbox.types';
import { showcaseOf } from '../fixtures/community';
import { patientList } from '../fixtures/people';
import { ROJAS, PEREZ, CESPEDES } from '../fixtures/support-hospital';
import { conversacionId, esMensajeClinico, perfilDeChatDe, reiniciarLaBandejaDeApoyo } from '../fixtures/support-hospital-inbox';
import { crearRouterSimulado } from './index';
import { reiniciarElGobiernoDeAccesos, reiniciarLaSesionDelSimulador } from './mock-reset';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';

/**
 * La bandeja de chat compartida contra el simulador: aislamiento por
 * organización, quién tiene cada conversación, el caso 09 (Ana responde como el
 * Dr. Pérez), lo clínico que se deriva, y lo que ven el paciente y el doctor.
 *
 * El estado vive en `Coleccion`es del módulo: las pruebas **se leen en orden**,
 * como una persona recorriendo la maqueta, y por eso no se barajan.
 */
let router: MockRouter;

const ana = buscarUsuario('ana')!;
const mariela = buscarUsuario('mariela')!;
const lucia = buscarUsuario('lucia')!;
const marcos = buscarUsuario('marcos')!;
const rosa = buscarUsuario('rosa')!;
const perez = buscarUsuario('perez')!;
const hospital = buscarUsuario('hospital_piloto')!;
const paciente = buscarUsuario('paciente')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, opciones: { body?: unknown; query?: Record<string, string>; tenant?: string } = {}): Respuesta<T> {
  const [ruta, cadena] = path.split('?');
  const query = new URLSearchParams(cadena ?? '');
  for (const [k, v] of Object.entries(opciones.query ?? {})) query.set(k, v);
  const match = router.match(method, ruta!);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({ method, path: ruta!, params: match.params, query, body: opciones.body ?? null, headers: opciones.tenant === undefined ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': opciones.tenant }), user });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const bandeja = (user: MockUser, org = TENANT_HOSPITAL_PILOTO, extra: Record<string, string> = {}) =>
  llamar<SupportInboxPage>(user, 'GET', '/me/support-inbox', { query: { org, ...extra } });
const detalle = (user: MockUser, clave: string, org = TENANT_HOSPITAL_PILOTO) =>
  llamar<SupportConversation>(user, 'GET', `/me/support-inbox/${conversacionId(clave)}`, { query: { org } });
const asignar = (user: MockUser, clave: string, doctor: { practitionerProfileId: string }, status: string, assignedUserId?: string) =>
  llamar<ConversationAssignment>(user, 'POST', `/community/conversations/${conversacionId(clave)}/assignment`, {
    body: { practitionerProfileId: doctor.practitionerProfileId, status, ...(assignedUserId === undefined ? {} : { assignedUserId }) },
  });
/** El remitente es el perfil **público** del doctor (`doctorPublicProfileId`), no su perfil profesional. */
const responder = (user: MockUser, clave: string, doctor: Parameters<typeof perfilDeChatDe>[0], bodyText: string, extra: Record<string, unknown> = {}) =>
  llamar<{ id: string; email?: { queued: boolean; skippedReason?: string; requestId?: string } }>(user, 'POST', `/community/conversations/${conversacionId(clave)}/messages`, {
    body: { senderProfileId: perfilDeChatDe(doctor), bodyText, onBehalfOfProfileId: perfilDeChatDe(doctor), ...extra },
  });
/** El motivo de negocio de un rechazo: la API lo manda arriba y en `details.reason`. */
const motivo = (respuesta: Respuesta): unknown => (respuesta.body as { reason?: string; details?: { reason?: string } }).details?.reason;

/**
 * Las pruebas parten de la maqueta de fábrica. El corredor no aísla los módulos entre archivos de un mismo worker
 * (`isolate: false`), y otros archivos dejan cambiadas tablas que esta bandeja lee: el contrato (caso 12) le termina el vínculo
 * a Ana y le revoca la aceptación de Pérez, el gobierno de accesos vuelve los vínculos a los del constructor (y se lleva a
 * Mariela), y los desafíos responden en una conversación de Pérez. Al terminar se devuelve igual para el archivo siguiente.
 */
function deFabrica(): void {
  reiniciarLaSesionDelSimulador();
  reiniciarElGobiernoDeAccesos();
  reiniciarLaBandejaDeApoyo();
}

beforeAll(() => {
  router = crearRouterSimulado();
  deFabrica();
});

afterAll(deFabrica);

describe('bandeja de chat compartida en el simulador', () => {
  describe('aislamiento por organización', () => {
    it('Ana ve las de Pérez, que la autorizó a responder en su nombre; las de Rojas NO salen: ver exige poder responder (no hay solo lectura)', () => {
      const respuesta = bandeja(ana);
      expect(respuesta.status).toBe(200);
      const claves = respuesta.body.items.map((i) => i.conversationId).sort();
      expect(claves).toEqual(['perez-ana-lucia', 'perez-daniela', 'perez-elena', 'perez-jorge'].map(conversacionId).sort());
      expect(new Set(respuesta.body.items.map((i) => i.practitionerName))).toEqual(new Set(['Dr. Andrés Pérez']));
      expect(respuesta.body.items.every((i) => i.organizationName === 'Hospital Piloto Mantra')).toBe(true);
    });

    it('cada fila trae el perfil público del doctor, el nombre público del paciente (sin su documento) y el total', () => {
      const respuesta = bandeja(ana);
      expect(respuesta.body.count).toBe(respuesta.body.items.length);
      for (const item of respuesta.body.items) {
        expect(item.tenantId).toBe(TENANT_HOSPITAL_PILOTO);
        expect(item.doctorPublicProfileId).toBe(perfilDeChatDe(item.practitionerName.includes('Pérez') ? PEREZ : ROJAS));
        expect(item.patientLabel).not.toMatch(/\d{5,}/);
      }
      // La API acepta la organización como `tenantId`.
      expect(bandeja(ana, TENANT_HOSPITAL_PILOTO).body.items).toHaveLength(respuesta.body.items.length);
      const porTenant = llamar<SupportInboxPage>(ana, 'GET', '/me/support-inbox', { query: { tenantId: TENANT_HOSPITAL_PILOTO } });
      expect(porTenant.body.items).toHaveLength(respuesta.body.items.length);
    });

    it('Mariela, que solo cubre a Pérez, ve únicamente las de Pérez', () => {
      const nombres = new Set(bandeja(mariela).body.items.map((i) => i.practitionerName));
      expect(nombres).toEqual(new Set(['Dr. Andrés Pérez']));
    });

    it('los doctores vienen en el mismo orden relativo que en la agenda combinada (de ahí sale el color) y solo los que se ven', () => {
      const { from, to } = { from: new Date(0).toISOString(), to: new Date(9e12).toISOString() };
      const agenda = llamar<WireSupportAgenda>(ana, 'GET', '/me/support-agenda', { query: { org: TENANT_HOSPITAL_PILOTO, from, to } }).body;
      const doctores = bandeja(ana).body.doctors;
      // Rojas no aceptó que Ana responda por ella: no es un doctor de su bandeja, aunque la agenda sí la cubra.
      expect(doctores.map((d) => d.practitionerProfileId)).toEqual([PEREZ.practitionerProfileId]);
      expect(doctores.map((d) => d.practitionerProfileId)).toEqual(agenda.doctors.map((d) => d.practitionerProfileId).filter((id) => id === PEREZ.practitionerProfileId));
    });

    it('Rosa no ve el hospital: pedir su bandeja es 403, y una conversación suya es un 404 que no confirma que exista', () => {
      expect(bandeja(rosa, TENANT_HOSPITAL_PILOTO).status).toBe(403);
      expect(detalle(rosa, 'perez-ana-lucia', TENANT_HOSPITAL_PILOTO).status).toBe(404);
      expect(detalle(rosa, 'perez-ana-lucia', TENANT_CESPEDES).status).toBe(404);
      expect(asignar(rosa, 'perez-ana-lucia', PEREZ, 'TAKEN').status).toBe(404);
      expect(responder(rosa, 'perez-ana-lucia', PEREZ, 'Hola').status).toBe(403);
      // El mismo 404 exista o no la conversación: no se confirma que existe.
      const noExiste = llamar<{ code: string }>(rosa, 'GET', '/me/support-inbox/00000000-0000-4000-8000-00000000dead', { query: { org: TENANT_HOSPITAL_PILOTO } });
      expect(noExiste.status).toBe(404);
      expect(motivo(noExiste)).toBe('CONVERSATION_NOT_FOUND');
      expect(motivo(detalle(rosa, 'perez-ana-lucia'))).toBe('CONVERSATION_NOT_FOUND');
    });

    it('Rosa ve solo las del consultorio de la Dra. Céspedes', () => {
      const respuesta = bandeja(rosa, TENANT_CESPEDES);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.items.map((i) => i.conversationId).sort()).toEqual(['cespedes-elena', 'cespedes-jorge'].map(conversacionId).sort());
      expect(respuesta.body.items.every((i) => i.organizationName === 'Consultorio Dra. Paola Céspedes')).toBe(true);
    });

    it('Ana no ve el consultorio de Céspedes, ni Rosa el hospital en su lista de organizaciones', () => {
      expect(bandeja(ana, TENANT_CESPEDES).status).toBe(403);
    });

    it('quien no tiene mensajes en su permiso recibe 403 con el motivo: Lucía (recepción) y Marcos (call center)', () => {
      for (const persona of [lucia, marcos]) {
        const respuesta = bandeja(persona);
        expect(respuesta.status).toBe(403);
        expect(JSON.stringify(respuesta.body)).toContain('no incluye atender mensajes');
        expect(motivo(respuesta)).toBe('SUPPORT_INBOX_NO_REPLY_PERMISSION');
      }
    });

    it('sin vínculo con la organización, el 403 lo dice con otro motivo', () => {
      expect(motivo(bandeja(rosa, TENANT_HOSPITAL_PILOTO))).toBe('SUPPORT_INBOX_NO_ENGAGEMENT');
    });

    it('sin sesión nadie lee nada', () => {
      expect(llamar(null, 'GET', '/me/support-inbox').status).toBe(403);
    });
  });

  describe('qué dice cada conversación', () => {
    it('lo clínico lo detecta la API: dolor, medicamentos y síntomas sí; citas y costos no', () => {
      const items = bandeja(ana).body.items;
      const clinica = (clave: string) => items.find((i) => i.conversationId === conversacionId(clave))!.isClinical;
      expect(clinica('perez-jorge')).toBe(true);
      expect(clinica('perez-ana-lucia')).toBe(false);
      expect(clinica('perez-daniela')).toBe(false);
      expect(esMensajeClinico('¿Puedo cambiar mi cita del jueves?')).toBe(false);
      expect(esMensajeClinico('Tengo fiebre y vómitos')).toBe(true);
    });

    it('trae el plazo: una vencida, otras por vencer, y nada en lo resuelto', () => {
      const items = bandeja(ana).body.items;
      const porClave = (clave: string) => items.find((i) => i.conversationId === conversacionId(clave))!;
      expect(new Date(porClave('perez-jorge').slaDueAt!).getTime()).toBeLessThan(Date.now());
      expect(new Date(porClave('perez-ana-lucia').slaDueAt!).getTime()).toBeGreaterThan(Date.now());
      expect(porClave('perez-elena').slaDueAt).toBeUndefined();
    });

    it('trae los estados de partida: nueva, en curso de Ana, esperando al doctor y resuelta', () => {
      const items = bandeja(ana).body.items;
      const estado = (clave: string) => items.find((i) => i.conversationId === conversacionId(clave))!;
      expect(estado('perez-ana-lucia').status).toBe('NEW');
      expect(estado('perez-daniela')).toMatchObject({ status: 'TAKEN', assignedToName: 'Ana Gutiérrez', assignedToMe: true });
      // La de Rojas (esperando al doctor, de Ana) no se ve: Rojas no aceptó que Ana responda por ella.
      expect(items.some((i) => i.conversationId === conversacionId('rojas-elena'))).toBe(false);
      expect(estado('perez-elena').status).toBe('RESOLVED');
      // Para Mariela, la de Ana es de otra persona.
      const deMariela = bandeja(mariela).body.items.find((i) => i.conversationId === conversacionId('perez-daniela'))!;
      expect(deMariela).toMatchObject({ status: 'TAKEN', assignedToName: 'Ana Gutiérrez', assignedToMe: false });
    });

    it('filtra por estado y por doctor', () => {
      expect(bandeja(ana, TENANT_HOSPITAL_PILOTO, { status: 'NEW' }).body.items.every((i) => i.status === 'NEW')).toBe(true);
      expect(bandeja(ana, TENANT_HOSPITAL_PILOTO, { doctor: PEREZ.practitionerProfileId }).body.items).toHaveLength(4);
      expect(bandeja(ana, TENANT_HOSPITAL_PILOTO, { doctor: ROJAS.practitionerProfileId }).body.items).toHaveLength(0);
    });

    it('el detalle trae mensajes con autora real, la nota de partida, a quién asignar y el motivo de consulta', () => {
      const elena = detalle(ana, 'perez-elena').body;
      const respuestaDelEquipo = elena.messages.find((m) => m.from === 'DOCTOR_SIDE')!;
      expect(respuestaDelEquipo.authoredByName).toBe('Ana Gutiérrez');
      expect(respuestaDelEquipo.disclosureShown).toBe(true);
      const daniela = detalle(ana, 'perez-daniela').body;
      expect(daniela.notes.map((n) => n.bodyText)).toEqual([expect.stringContaining('Bs 450')]);
      expect(daniela.assignableTo.map((p) => p.name).sort()).toEqual(['Ana Gutiérrez', 'Mariela Soliz']);
      expect(daniela.patientContext.reasonLabel).toBe('Ecocardiograma de control');
      expect(daniela.patientContext.clinicalAccess).toBe('NONE');
    });
  });

  describe('responder en nombre del doctor (caso 09)', () => {
    it('Rojas no autorizó a Ana: la conversación no aparece (404 CONVERSATION_NOT_FOUND, no «solo lectura») y responder es 403', () => {
      const rojas = detalle(ana, 'rojas-daniela');
      expect(rojas.status).toBe(404);
      expect(motivo(rojas)).toBe('CONVERSATION_NOT_FOUND');
      const intento = responder(ana, 'rojas-daniela', ROJAS, 'Hola');
      expect(intento.status).toBe(403);
      expect(JSON.stringify(intento.body)).toContain('todavía no le autorizó');
    });

    it('en lo que se ve, `replyAllowed` es siempre true y no queda ningún motivo de bloqueo', () => {
      const d = detalle(ana, 'perez-daniela').body;
      expect(d.replyAllowed).toBe(true);
      expect(d.replyBlockedReason).toBeUndefined();
    });

    it('responder a una conversación que no está en la bandeja de ese doctor es 404 CONVERSATION_NOT_FOUND', () => {
      const intento = responder(ana, 'rojas-daniela', PEREZ, 'Hola');
      expect(intento.status).toBe(404);
      expect(motivo(intento)).toBe('CONVERSATION_NOT_FOUND');
    });

    it('Ana toma la conversación de Pérez y queda a su nombre', () => {
      const respuesta = asignar(ana, 'perez-ana-lucia', PEREZ, 'TAKEN');
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject({ conversationId: conversacionId('perez-ana-lucia'), status: 'TAKEN', assignedToName: 'Ana Gutiérrez', assignedUserId: ana.id, referredToDoctor: false });
      expect(detalle(ana, 'perez-ana-lucia').body).toMatchObject({ status: 'TAKEN', assignedToMe: true });
    });

    it('otra secretaria (Mariela) no puede tomar la misma ni responderla: 409 con el nombre de quien la tiene', () => {
      const tomar = asignar(mariela, 'perez-ana-lucia', PEREZ, 'TAKEN');
      expect(tomar.status).toBe(409);
      expect(JSON.stringify(tomar.body)).toContain('Ana Gutiérrez ya tiene esta conversación');
      expect(motivo(tomar)).toBe('CONVERSATION_ALREADY_TAKEN');
      const enviar = responder(mariela, 'perez-ana-lucia', PEREZ, 'Yo la respondo');
      expect(enviar.status).toBe(409);
      expect(motivo(enviar)).toBe('CONVERSATION_HELD_BY_OTHER');
      // Tampoco se la puede derivar ni resolver por la espalda.
      expect(asignar(mariela, 'perez-ana-lucia', PEREZ, 'RESOLVED').status).toBe(409);
      expect(asignar(mariela, 'perez-ana-lucia', PEREZ, 'WAITING_DOCTOR').status).toBe(409);
      expect(detalle(mariela, 'perez-ana-lucia').body).toMatchObject({ assignedToMe: false, assignedToName: 'Ana Gutiérrez' });
    });

    it('Ana responde como Pérez: el paciente ve al doctor como remitente y la autora real queda guardada', () => {
      const enviada = responder(ana, 'perez-ana-lucia', PEREZ, 'Hola Ana, le propongo el jueves a las 15:30. ¿Le sirve?');
      expect(enviada.status).toBe(201);

      const deLaPaciente = showcaseOf(paciente.patientProfileId!)!;
      const lectura = llamar<{ items: { id: string; senderProfileId: string; bodyText: string; repliedByTeam?: boolean; teamAuthorName?: string }[] }>(
        paciente,
        'GET',
        `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`,
        { query: { profileId: deLaPaciente.id } },
      ).body.items;
      const respuesta = lectura.find((m) => m.id === enviada.body.id)!;
      // El paciente ve al doctor, no a Ana…
      expect(respuesta.senderProfileId).toBe(perfilDeChatDe(PEREZ));
      // …con la leyenda, porque Pérez la dejó activa…
      expect(respuesta.repliedByTeam).toBe(true);
      // …y sin el nombre de quien escribió.
      expect(respuesta.teamAuthorName).toBeUndefined();
      expect(JSON.stringify(lectura)).not.toContain('Ana Gutiérrez');
    });

    it('el doctor ve en su propio chat quién respondió por él', () => {
      const lectura = llamar<{ items: { senderProfileId: string; bodyText: string; repliedByTeam?: boolean; teamAuthorName?: string }[] }>(
        perez,
        'GET',
        `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`,
        { query: { profileId: perfilDeChatDe(PEREZ) } },
      ).body.items;
      const respuesta = lectura.find((m) => m.bodyText.startsWith('Hola Ana, le propongo'))!;
      expect(respuesta.senderProfileId).toBe(perfilDeChatDe(PEREZ));
      expect(respuesta.teamAuthorName).toBe('Ana Gutiérrez');
      expect(respuesta.repliedByTeam).toBe(true);
    });

    it('el equipo ve la autora real y si el paciente ve el aviso', () => {
      const hilo = detalle(ana, 'perez-ana-lucia').body.messages;
      const respuesta = hilo.find((m) => m.from === 'DOCTOR_SIDE' && m.bodyText.startsWith('Hola Ana, le propongo'))!;
      expect(respuesta).toMatchObject({ authoredByName: 'Ana Gutiérrez', disclosureShown: true });
      expect(bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-ana-lucia'))!.slaDueAt).toBeUndefined();
    });

    it('la bandeja y la bitácora lo registran: la respuesta aparece entre lo que hizo Ana', () => {
      const bitacora = llamar<{ items: { actorName: string; action: string }[] }>(perez, 'GET', '/me/practitioner/support-activity').body.items;
      expect(bitacora.some((b) => b.actorName === 'Ana Gutiérrez' && b.action === 'messages.reply_on_behalf')).toBe(true);
    });

    it('si el doctor decide que el paciente no vea el aviso, la leyenda no sale (Rosa responde como Céspedes)', () => {
      const enviada = responder(rosa, 'cespedes-elena', CESPEDES, 'Hola Elena, tenemos turno el viernes a las 16:00.');
      expect(enviada.status).toBe(201);
      const lectura = llamar<{ items: { id: string; senderProfileId: string; repliedByTeam?: boolean }[] }>(
        null,
        'GET',
        `/community/conversations/${conversacionId('cespedes-elena')}/messages`,
        { query: { profileId: showcaseOf(patientList.todos()[4]!.id)!.id } },
      ).body.items.find((m) => m.id === enviada.body.id)!;
      expect(lectura.senderProfileId).toBe(perfilDeChatDe(CESPEDES));
      expect(lectura.repliedByTeam).toBeUndefined();
      // Pero la autora real queda guardada para el equipo.
      const hilo = detalle(rosa, 'cespedes-elena', TENANT_CESPEDES).body.messages.find((m) => m.authoredByName !== undefined)!;
      expect(hilo).toMatchObject({ authoredByName: 'Rosa Quiroga', disclosureShown: false });
      expect(detalle(rosa, 'cespedes-elena', TENANT_CESPEDES).body.replyDisclosure).toBe('HIDE');
    });
  });

  describe('quién manda y por qué canales', () => {
    it('el remitente es el perfil público del doctor: con su perfil profesional la API lo rechaza con 403', () => {
      const intento = llamar(ana, 'POST', `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`, {
        body: { senderProfileId: PEREZ.practitionerProfileId, onBehalfOfProfileId: PEREZ.practitionerProfileId, bodyText: 'Hola' },
      });
      expect(intento.status).toBe(403);
    });

    it('con correo, la respuesta trae `email` y la cola; sin pedirlo no trae nada de correo', () => {
      const conCorreo = responder(ana, 'perez-ana-lucia', PEREZ, 'Le confirmamos el jueves a las 15:30, hora de Bolivia.', { channels: ['CHAT', 'EMAIL'] });
      expect(conCorreo.status).toBe(201);
      expect(conCorreo.body.email).toMatchObject({ queued: true });
      expect(conCorreo.body.email!.requestId).toEqual(expect.any(String));

      const sinCorreo = responder(ana, 'perez-ana-lucia', PEREZ, 'Quedamos entonces. Que tenga buen día.');
      expect(sinCorreo.status).toBe(201);
      expect(sinCorreo.body.email).toBeUndefined();
    });

    it('el correo solo sale al responder en nombre del doctor: de otro modo es un 422', () => {
      const intento = llamar(paciente, 'POST', `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`, {
        body: { senderProfileId: showcaseOf(paciente.patientProfileId!)!.id, bodyText: 'Gracias', channels: ['EMAIL'] },
      });
      expect(intento.status).toBe(422);
      expect(motivo(intento)).toBe('EMAIL_CHANNEL_REQUIRES_ON_BEHALF');
    });

    it('un texto saliente que suena clínico tampoco lo manda el equipo', () => {
      const intento = responder(ana, 'perez-ana-lucia', PEREZ, 'Tome la mitad de la dosis de su medicamento.');
      expect(intento.status).toBe(422);
      expect(motivo(intento)).toBe('SUPPORT_CLINICAL_CONTENT');
    });
  });

  describe('lo clínico se deriva', () => {
    it('un mensaje clínico no se responde: 422 hasta que se derive', () => {
      const clinica = detalle(ana, 'perez-jorge').body;
      expect(clinica.isClinical).toBe(true);
      const intento = responder(ana, 'perez-jorge', PEREZ, 'Tome la mitad de la dosis.');
      expect(intento.status).toBe(422);
      expect(JSON.stringify(intento.body)).toContain('Derívelo al doctor');
      expect(motivo(intento)).toBe('CLINICAL_REQUIRES_DERIVATION');
    });

    it('derivar la deja esperando al doctor, a nombre de quien la derivó', () => {
      const respuesta = asignar(ana, 'perez-jorge', PEREZ, 'WAITING_DOCTOR');
      expect(respuesta.status).toBe(200);
      expect(detalle(ana, 'perez-jorge').body).toMatchObject({ status: 'WAITING_DOCTOR', assignedToMe: true, isClinical: true });
      expect(bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-jorge'))!.status).toBe('WAITING_DOCTOR');
    });

    it('el doctor ve en su chat que se la derivaron; nadie más lo ve', () => {
      const delDoctor = llamar<{ items: { id: string; awaitingDoctor?: boolean }[] }>(perez, 'GET', '/community/conversations', { query: { profileId: perfilDeChatDe(PEREZ) } }).body.items;
      expect(delDoctor.find((c) => c.id === conversacionId('perez-jorge'))!.awaitingDoctor).toBe(true);
      expect(delDoctor.find((c) => c.id === conversacionId('perez-ana-lucia'))!.awaitingDoctor).toBeUndefined();
      const delPaciente = llamar<{ items: { id: string; awaitingDoctor?: boolean }[] }>(
        paciente,
        'GET',
        '/community/conversations',
        // Su propia bandeja: la de otro perfil es 403 `NOT_OWN_PROFILE`, como en la API.
        { query: { profileId: showcaseOf(paciente.patientProfileId!)!.id } },
      ).body.items;
      expect(delPaciente.length).toBeGreaterThan(0);
      expect(delPaciente.every((c) => c.awaitingDoctor === undefined)).toBe(true);
    });

    it('ya derivada, se puede avisar al paciente (por ejemplo con la plantilla «Lo verá el doctor»)', () => {
      const enviada = responder(ana, 'perez-jorge', PEREZ, 'Hola Jorge, trasladamos su consulta al doctor. Si es urgente, acuda a emergencias.');
      expect(enviada.status).toBe(201);
      // Responder no la saca de «Esperando al doctor».
      expect(detalle(ana, 'perez-jorge').body.status).toBe('WAITING_DOCTOR');
    });
  });

  describe('asignar, liberar, resolver y reabrir', () => {
    it('Ana asigna una nueva a Mariela, que sí cubre a Pérez; a alguien que no la cubre, no', () => {
      const noElegible = asignar(ana, 'perez-daniela', PEREZ, 'TAKEN', lucia.id);
      expect(noElegible.status).toBe(422);
      expect(motivo(noElegible)).toBe('CONVERSATION_ASSIGNEE_NOT_ELIGIBLE');
      const respuesta = asignar(ana, 'perez-daniela', PEREZ, 'TAKEN', mariela.id);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toMatchObject({ assignedUserId: mariela.id, assignedToName: 'Mariela Soliz' });
      expect(detalle(ana, 'perez-daniela').body).toMatchObject({ assignedToMe: false, assignedToName: 'Mariela Soliz' });
      expect(responder(ana, 'perez-daniela', PEREZ, 'Se lo respondo yo').status).toBe(409);
    });

    it('quien la tiene la libera y vuelve a ser de nadie', () => {
      expect(asignar(ana, 'perez-daniela', PEREZ, 'NEW').status).toBe(409);
      expect(asignar(mariela, 'perez-daniela', PEREZ, 'NEW').status).toBe(200);
      expect(detalle(ana, 'perez-daniela').body).toMatchObject({ status: 'NEW' });
      expect(detalle(ana, 'perez-daniela').body.assignedToName).toBeUndefined();
    });

    it('resolver la saca del plazo, y si el paciente escribe de nuevo, se reabre sola', () => {
      expect(asignar(ana, 'perez-daniela', PEREZ, 'RESOLVED').status).toBe(200);
      const resuelta = bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-daniela'))!;
      expect(resuelta).toMatchObject({ status: 'RESOLVED' });
      expect(resuelta.slaDueAt).toBeUndefined();

      const perfilDeDaniela = showcaseOf(patientList.todos()[2]!.id)!.id;
      const escribe = llamar(null, 'POST', `/community/conversations/${conversacionId('perez-daniela')}/messages`, { body: { senderProfileId: perfilDeDaniela, bodyText: 'Una consulta más: ¿atienden los sábados?' } });
      expect(escribe.status).toBe(201);
      expect(bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-daniela'))!.status).toBe('NEW');
    });

    it('reabrir una resuelta la deja en manos de quien la reabre, con plazo nuevo', () => {
      expect(asignar(ana, 'perez-elena', PEREZ, 'TAKEN').status).toBe(200);
      const reabierta = bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-elena'))!;
      expect(reabierta).toMatchObject({ status: 'TAKEN', assignedToMe: true });
      expect(new Date(reabierta.slaDueAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('un estado inventado o un doctor equivocado es un 422 con su motivo', () => {
      const inventado = asignar(ana, 'perez-elena', PEREZ, 'INVENTADO');
      expect(inventado.status).toBe(422);
      expect(motivo(inventado)).toBe('CONVERSATION_STATUS_REQUIRED');
      const equivocado = asignar(ana, 'perez-elena', ROJAS, 'TAKEN');
      expect(equivocado.status).toBe(422);
      expect(motivo(equivocado)).toBe('CONVERSATION_PRACTITIONER_MISMATCH');
    });

    it('la forma explícita con `action` también vale: TAKE toma y ASSIGN reparte', () => {
      const cuerpo = (action: string, extra: Record<string, unknown> = {}) => ({ practitionerProfileId: PEREZ.practitionerProfileId, action, ...extra });
      const toma = llamar<ConversationAssignment>(ana, 'POST', `/community/conversations/${conversacionId('perez-elena')}/assignment`, { body: cuerpo('TAKE') });
      expect(toma.status).toBe(200);
      expect(toma.body).toMatchObject({ status: 'TAKEN', assignedUserId: ana.id });
      const reparte = llamar<ConversationAssignment>(ana, 'POST', `/community/conversations/${conversacionId('perez-elena')}/assignment`, { body: cuerpo('ASSIGN', { assignedUserId: mariela.id }) });
      expect(reparte.body).toMatchObject({ status: 'TAKEN', assignedUserId: mariela.id, assignedToName: 'Mariela Soliz' });
      // Se vuelve a como estaba para las pruebas siguientes.
      expect(asignar(mariela, 'perez-elena', PEREZ, 'TAKEN', ana.id).status).toBe(200);
    });

    it('lo que no cubre no se toca: una conversación de Suárez es un 404 para Ana', () => {
      expect(asignar(ana, 'suarez-martin', PEREZ, 'TAKEN').status).toBe(404);
      expect(detalle(ana, 'suarez-martin').status).toBe(404);
    });
  });

  describe('notas internas', () => {
    it('quedan con su autora y las ve el equipo, nunca el paciente ni el doctor en su chat', () => {
      const respuesta = llamar<InternalNote>(ana, 'POST', `/community/conversations/${conversacionId('perez-ana-lucia')}/internal-notes`, { body: { bodyText: 'La paciente prefiere las tardes.' } });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toMatchObject({ authorName: 'Ana Gutiérrez', bodyText: 'La paciente prefiere las tardes.' });
      expect(detalle(mariela, 'perez-ana-lucia').body.notes.map((n) => n.bodyText)).toContain('La paciente prefiere las tardes.');

      const lecturaDelPaciente = llamar(paciente, 'GET', `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`, { query: { profileId: showcaseOf(paciente.patientProfileId!)!.id } });
      const lecturaDelDoctor = llamar(perez, 'GET', `/community/conversations/${conversacionId('perez-ana-lucia')}/messages`, { query: { profileId: perfilDeChatDe(PEREZ) } });
      expect(JSON.stringify(lecturaDelPaciente.body)).not.toContain('prefiere las tardes');
      expect(JSON.stringify(lecturaDelDoctor.body)).not.toContain('prefiere las tardes');
    });

    it('no se guarda una nota vacía, ni la guarda quien no tiene acceso', () => {
      expect(llamar(ana, 'POST', `/community/conversations/${conversacionId('perez-ana-lucia')}/internal-notes`, { body: { bodyText: '   ' } }).status).toBe(400);
      expect(llamar(rosa, 'POST', `/community/conversations/${conversacionId('perez-ana-lucia')}/internal-notes`, { body: { bodyText: 'Hola' } }).status).toBe(404);
    });
  });

  describe('plantillas', () => {
    it('cada organización lee las suyas, por categoría', () => {
      const delHospital = llamar<ReplyTemplatePage>(ana, 'GET', '/me/support-reply-templates', { query: { org: TENANT_HOSPITAL_PILOTO } });
      expect(delHospital.status).toBe(200);
      expect(new Set(delHospital.body.items.map((t) => t.category))).toEqual(new Set(['GENERAL', 'SCHEDULING', 'BILLING', 'PREPARATION']));
      expect(delHospital.body.items.every((t) => t.bodyText.length > 0)).toBe(true);
      expect(JSON.stringify(delHospital.body)).not.toContain('tenantId');

      const delConsultorio = llamar<ReplyTemplatePage>(rosa, 'GET', '/me/support-reply-templates', { query: { org: TENANT_CESPEDES } });
      expect(delConsultorio.body.items.map((t) => t.title).sort()).toEqual(['Recibimos su mensaje', 'Turnos disponibles']);
      expect(llamar(rosa, 'GET', '/me/support-reply-templates', { query: { org: TENANT_HOSPITAL_PILOTO } }).status).toBe(403);
    });
  });

  describe('administrar las respuestas preparadas (organización)', () => {
    const lista = () => llamar<ReplyTemplatePage>(hospital, 'GET', '/org/reply-templates', { query: { tenantId: TENANT_HOSPITAL_PILOTO } });
    const porTitulo = (titulo: string): ReplyTemplate => lista().body.items.find((t) => t.title === titulo)!;

    it('solo la cuenta de la organización las administra; el personal de apoyo no', () => {
      expect(llamar(ana, 'GET', '/org/reply-templates', { query: { tenantId: TENANT_HOSPITAL_PILOTO } }).status).toBe(403);
      expect(llamar(ana, 'POST', '/org/reply-templates', { query: { tenantId: TENANT_HOSPITAL_PILOTO }, body: { category: 'GENERAL', title: 'X', bodyText: 'Y' } }).status).toBe(403);
      expect(llamar(null, 'GET', '/org/reply-templates').status).not.toBe(200);
    });

    it('la lista trae `version` y `retired` de cada una, y el total', () => {
      const respuesta = lista();
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.count).toBe(respuesta.body.items.length);
      expect(respuesta.body.items.every((t) => t.version !== undefined && t.retired === false)).toBe(true);
    });

    it('crea una (201, versión 1) y la valida: categoría, título y texto', () => {
      const nueva = llamar<ReplyTemplate>(hospital, 'POST', '/org/reply-templates', {
        query: { tenantId: TENANT_HOSPITAL_PILOTO },
        body: { category: 'SCHEDULING', title: 'Reprogramación', bodyText: 'Con gusto le buscamos otro horario.' },
      });
      expect(nueva.status).toBe(201);
      expect(nueva.body).toMatchObject({ category: 'SCHEDULING', title: 'Reprogramación', retired: false, version: 1 });
      for (const malo of [{ category: 'OTRA', title: 'a', bodyText: 'b' }, { category: 'GENERAL', title: '  ', bodyText: 'b' }, { category: 'GENERAL', title: 'a', bodyText: '' }]) {
        expect(llamar(hospital, 'POST', '/org/reply-templates', { query: { tenantId: TENANT_HOSPITAL_PILOTO }, body: malo }).status).toBe(400);
      }
    });

    it('al cambiarla sube la versión; con una versión vieja es un 409 REPLY_TEMPLATE_STALE que dice la actual', () => {
      const antes = porTitulo('Reprogramación');
      const cambio = llamar<ReplyTemplate>(hospital, 'PATCH', `/org/reply-templates/${antes.id}`, {
        query: { tenantId: TENANT_HOSPITAL_PILOTO },
        body: { bodyText: 'Con gusto le buscamos otro horario esta semana.', expectedVersion: antes.version },
      });
      expect(cambio.status).toBe(200);
      expect(cambio.body).toMatchObject({ version: antes.version! + 1, bodyText: 'Con gusto le buscamos otro horario esta semana.' });

      const vieja = llamar<{ details: { currentVersion: number } }>(hospital, 'PATCH', `/org/reply-templates/${antes.id}`, {
        query: { tenantId: TENANT_HOSPITAL_PILOTO },
        body: { title: 'Otro título', expectedVersion: antes.version },
      });
      expect(vieja.status).toBe(409);
      expect(motivo(vieja)).toBe('REPLY_TEMPLATE_STALE');
      expect(vieja.body.details.currentVersion).toBe(antes.version! + 1);
      expect(porTitulo('Reprogramación').version).toBe(antes.version! + 1);
    });

    it('retirarla la saca de lo que ve quien responde, y reactivarla la devuelve', () => {
      const plantilla = porTitulo('Reprogramación');
      const delEquipo = () => llamar<ReplyTemplatePage>(ana, 'GET', '/me/support-reply-templates', { query: { tenantId: TENANT_HOSPITAL_PILOTO } }).body.items.map((t) => t.title);
      expect(delEquipo()).toContain('Reprogramación');
      expect(llamar<ReplyTemplate>(hospital, 'PATCH', `/org/reply-templates/${plantilla.id}`, { query: { tenantId: TENANT_HOSPITAL_PILOTO }, body: { retired: true } }).body.retired).toBe(true);
      expect(delEquipo()).not.toContain('Reprogramación');
      expect(lista().body.items.some((t) => t.title === 'Reprogramación' && t.retired === true)).toBe(true);
      llamar(hospital, 'PATCH', `/org/reply-templates/${plantilla.id}`, { query: { tenantId: TENANT_HOSPITAL_PILOTO }, body: { retired: false } });
      expect(delEquipo()).toContain('Reprogramación');
    });

    it('una respuesta que no existe es un 404, y la cuenta de una organización no administra la de otra', () => {
      expect(llamar(hospital, 'PATCH', '/org/reply-templates/no-existe', { body: { retired: true } }).status).toBe(404);
      expect(llamar(hospital, 'GET', '/org/reply-templates', { tenant: TENANT_CESPEDES }).status).toBe(403);
      // La respuesta de una organización no se toca desde otra: aparece como inexistente.
      const delHospital = porTitulo('Reprogramación');
      expect(llamar(hospital, 'PATCH', `/org/reply-templates/${delHospital.id}`, { tenant: TENANT_CESPEDES, body: { retired: true } }).status).toBe(403);
    });
  });

  describe('acceso clínico temporal (caso 10)', () => {
    it('Ana pide acceso a la historia de la paciente: queda pendiente y lo decide el doctor', () => {
      const antes = detalle(ana, 'perez-ana-lucia').body.patientContext;
      expect(antes.clinicalAccess).toBe('NONE');
      expect(antes.reasonLabel).toBe('Control de presión arterial');

      // `POST /me/support-access-requests` (sin tenant activo): organización, doctor, paciente y motivo en el cuerpo.
      const cuerpo = (reasonText: string) => ({ body: { tenantId: PEREZ.tenantId, practitionerProfileId: PEREZ.practitionerProfileId, patientProfileId: antes.patientProfileId, reasonText } });
      const pedido = llamar<{ id: string; tenantId: string }>(ana, 'POST', '/me/support-access-requests', cuerpo('Necesito el último electrocardiograma para el seguro.'));
      expect(pedido.status).toBe(201);
      expect(pedido.body.tenantId).toBe(PEREZ.tenantId);
      expect(detalle(ana, 'perez-ana-lucia').body.patientContext.clinicalAccess).toBe('PENDING');
      // Otro pedido igual, mientras el primero espera, es un conflicto.
      expect(llamar(ana, 'POST', '/me/support-access-requests', cuerpo('Otra vez lo mismo, por favor.')).status).toBe(409);
    });

    it('el pedido llega a «Mi equipo» del doctor, y ni la secretaria ni otra persona lo decide', () => {
      const equipo = llamar<{ items: { personName: string; pendingClinicalRequests: { requestId: string; reasonText: string }[] }[] }>(perez, 'GET', '/me/practitioner/support-team').body;
      const delPedido = equipo.items.find((m) => m.personName === 'Ana Gutiérrez')!.pendingClinicalRequests.find((p) => p.reasonText.includes('electrocardiograma para el seguro'))!;
      expect(delPedido).toBeDefined();
      expect(llamar(ana, 'POST', `/access-requests/${delPedido.requestId}/decision`, { body: { decision: 'APPROVED' } }).status).toBe(403);
      expect(llamar(perez, 'POST', `/access-requests/${delPedido.requestId}/decision`, { body: { decision: 'APPROVED', validTo: '2026-11-01T00:00:00Z' } }).status).toBe(200);
      expect(detalle(ana, 'perez-ana-lucia').body.patientContext.clinicalAccess).toBe('APPROVED');
    });

    it('nadie pide en nombre de otra persona, ni sin decir para qué', () => {
      const paciente = detalle(ana, 'perez-jorge').body.patientContext.patientProfileId!;
      const base = { tenantId: PEREZ.tenantId, practitionerProfileId: PEREZ.practitionerProfileId, patientProfileId: paciente };
      // Quien no tiene vínculo con ese doctor en esa organización no pide nada.
      expect(llamar(rosa, 'POST', '/me/support-access-requests', { body: { ...base, reasonText: 'Lo pido yo por ella.' } }).status).toBe(403);
      expect(llamar(ana, 'POST', '/me/support-access-requests', { body: { ...base, reasonText: '' } }).status).toBe(400);
      expect(llamar(ana, 'POST', '/me/support-access-requests', { body: { tenantId: base.tenantId, practitionerProfileId: base.practitionerProfileId, reasonText: 'Sin decir de qué paciente.' } }).status).toBe(400);
    });
  });

  describe('contenido clínico oculto', () => {
    const MARCADOR = 'Contenido clínico oculto: requiere acceso clínico temporal aprobado.';

    it('en la lista, el último mensaje clínico del paciente sale con el marcador en `lastPatientMessage` y en `lastMessagePreview`', () => {
      const jorge = bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-jorge'))!;
      expect(jorge.lastMessagePreview).toBe(MARCADOR);
      expect(jorge.lastPatientMessage).toBe(MARCADOR);
      // Lo administrativo se lee tal cual, y `lastPatientMessage` es el texto recortado (no una fecha).
      const administrativa = bandeja(ana).body.items.find((i) => i.conversationId === conversacionId('perez-daniela'))!;
      expect(administrativa.lastMessagePreview).not.toBe(MARCADOR);
      expect(administrativa.lastPatientMessage).toBe(administrativa.lastMessagePreview);
    });

    it('en el detalle, mientras el acceso clínico no esté APROBADO, el mensaje clínico sale con el marcador, isClinical y contentHidden', () => {
      const d = detalle(ana, 'perez-jorge').body;
      expect(d.patientContext.clinicalAccess).not.toBe('APPROVED');
      const ocultos = d.messages.filter((m) => m.contentHidden === true);
      expect(ocultos.length).toBeGreaterThan(0);
      for (const m of ocultos) {
        expect(m.bodyText).toBe(MARCADOR);
        expect(m.isClinical).toBe(true);
      }
      expect(d.messages.some((m) => m.from === 'PATIENT' && m.contentHidden === true)).toBe(true);
    });

    it('lo que escribió el equipo en nombre del doctor se lee siempre, y lo administrativo del paciente también', () => {
      const d = detalle(ana, 'perez-elena').body;
      const delEquipo = d.messages.find((m) => m.authoredByName !== undefined)!;
      expect(delEquipo.contentHidden).toBeUndefined();
      expect(delEquipo.bodyText).not.toBe(MARCADOR);
      const admin = detalle(ana, 'perez-daniela').body.messages.find((m) => m.from === 'PATIENT')!;
      expect(admin.contentHidden).toBeUndefined();
    });

    it('un mensaje que escribió el propio doctor (no su equipo) sale oculto mientras no haya acceso aprobado', () => {
      const d = detalle(mariela, 'perez-daniela').body;
      const delDoctor = d.messages.filter((m) => m.from === 'DOCTOR_SIDE' && m.authoredByName === undefined);
      for (const m of delDoctor) expect(m).toMatchObject({ bodyText: MARCADOR, contentHidden: true, isClinical: true });
    });

    it('con el acceso APROBADO, los mensajes salen completos y sin contentHidden', () => {
      // `perez-ana-lucia` quedó APROBADA por el doctor en la prueba de «acceso clínico temporal» de más arriba.
      const d = detalle(ana, 'perez-ana-lucia').body;
      expect(d.patientContext.clinicalAccess).toBe('APPROVED');
      expect(d.messages.every((m) => m.contentHidden === undefined && m.bodyText !== MARCADOR)).toBe(true);
    });
  });
});
