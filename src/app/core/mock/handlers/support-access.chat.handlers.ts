import type { ConversationAssignmentStatus, InternalNote, SupportConversation, SupportInboxDoctor, SupportInboxItem, SupportPatientContext, ClinicalAccessState } from '../../data-access/support-access/support-inbox.types';
import { actionsFor, indexLocations, previewCoverage, type CoverageGrant } from '../../data-access/support-access/support-coverage';
import { conversationList, messageList, showcaseOf, type SimulatedMessage } from '../fixtures/community';
import {
  accesosClinicos,
  asignaciones,
  autorias,
  CATALOGOS,
  delegadoId,
  delegados,
  DOCTORES_POR_TENANT,
  notasInternas,
  vinculos,
  type DoctorSimulado,
  type FilaAsignacion,
  type FilaDelegado,
  type FilaVinculo,
} from '../fixtures/support-hospital';
import {
  dentroDe,
  esMensajeClinico,
  HORAS_DE_RESPUESTA,
  pacienteDeConversacion,
  perfilDeChatDe,
  PERMISO_LECTURA_CLINICA,
  plantillas,
  semillaDe,
} from '../fixtures/support-hospital-inbox';
import { conflict, forbidden, isMockReply, notFound, reply, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_NAMES, usuarioPorId, type MockUser } from '../mock-session';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { desafioDePacienteReservado } from './support-access.challenges';
import { esPacienteReservado } from './support-access.reserved';
import { conMotivo } from './support-access.errors';
import { adelantoDe, mensajeVisible } from './support-access.chat.hidden';
import { registrarRespuestasPreparadas, vistaDePlantilla } from './support-access.reply-templates.handlers';
import {
  anotar,
  catalogoDe,
  doctorDe,
  etiquetaDePaciente,
  ordenarDoctores,
  permisosEfectivos,
  permisosEfectivosDeVinculo,
  vinculosActivosDe,
} from './support-access.core';

/* ============================================================================
    El **chat del personal de apoyo** contra el simulador: la bandeja
    compartida, la conversación con la autora real, la asignación («Tomar»,
    «Derivar», «Resolver»), las notas internas, las plantillas, y responder en
    nombre del doctor. También lo que el paciente y el doctor ven en el chat de
    siempre de lo que el equipo respondió.

    Reglas que se hacen cumplir **acá** y no solo en la pantalla (ocultar un
    botón no es la regla):

    - la persona solo ve conversaciones de organizaciones donde tiene vínculo, y
      de los doctores que cubre con `messages.reply_on_behalf`;
    - una conversación la tiene **una** persona: quien la toma después recibe 409;
    - responder en nombre del doctor exige el permiso **y** su aceptación;
    - un mensaje clínico del paciente no se responde: se **deriva** al doctor;
    - el paciente ve al doctor como remitente y, si el doctor lo decidió, la
      leyenda «respondido por su equipo»; la **autora real** la ve el equipo y el
      doctor, nunca el paciente.
   ========================================================================== */

const ACCION_DE_MENSAJES = 'messages.reply_on_behalf';
const MS_POR_HORA = 3_600_000;

/* ---- quién puede qué ------------------------------------------------------------ */

function puedeAtender(grants: readonly CoverageGrant[], tenantId: string, doctor: DoctorSimulado): boolean {
  const locations = indexLocations(catalogoDe(tenantId).locations);
  return doctor.placements.some((p) =>
    actionsFor(grants, { practitionerRoleAssignmentId: doctor.id, careSpaceId: p.careSpaceId, healthcareServiceId: p.healthcareServiceId }, locations).includes(ACCION_DE_MENSAJES),
  );
}

/** Los doctores de una organización cuyas conversaciones puede atender esta persona. */
function doctoresQueAtiende(user: MockUser, tenantId: string): readonly DoctorSimulado[] {
  const grants = permisosEfectivos(user.id, tenantId);
  return (DOCTORES_POR_TENANT[tenantId] ?? []).filter((d) => puedeAtender(grants, tenantId, d));
}

/** El doctor de un perfil **público** (de chat): el único que sirve como remitente al responder en su nombre. */
function doctorPorPerfilPublico(doctorPublicProfileId: string): DoctorSimulado | undefined {
  return Object.values(DOCTORES_POR_TENANT)
    .flat()
    .find((d) => perfilDeChatDe(d) === doctorPublicProfileId);
}

function doctorPorPerfil(practitionerProfileId: string): DoctorSimulado | undefined {
  return Object.values(DOCTORES_POR_TENANT)
    .flat()
    .find((d) => d.practitionerProfileId === practitionerProfileId || perfilDeChatDe(d) === practitionerProfileId);
}

/** La aceptación del doctor de esta persona y si responde en su nombre (el permiso ya está comprobado aparte). */
function delegadoDe(user: MockUser, doctor: DoctorSimulado): { vinculo: FilaVinculo | undefined; delegado: FilaDelegado | undefined } {
  const propios = vinculosActivosDe(user.id, doctor.tenantId);
  const vinculo = propios.find((v) => delegados.get(delegadoId(v.id, doctor.id)) !== undefined) ?? propios[0];
  return { vinculo, delegado: vinculo === undefined ? undefined : delegados.get(delegadoId(vinculo.id, doctor.id)) };
}

/**
 * Ver la conversación de un doctor **exige poder responder en su nombre**: vínculo vivo, permiso
 * `messages.reply_on_behalf` que cubre al doctor **y** su aceptación con ese alcance. Quien no lo
 * tiene no recibe una conversación de solo lectura: la conversación no aparece (404). Por eso
 * `replyAllowed` es siempre `true` en lo que se ve.
 */
function puedeVer(user: MockUser, doctor: DoctorSimulado): boolean {
  const { delegado } = delegadoDe(user, doctor);
  return doctoresQueAtiende(user, doctor.tenantId).some((d) => d.id === doctor.id) && delegado !== undefined && delegado.status === 'ACTIVE' && delegado.mayReplyOnBehalf;
}

/** Cómo se muestra la autoría al paciente, según lo que decidió el doctor para esta persona. */
function leyendaDe(user: MockUser, doctor: DoctorSimulado): 'SHOW' | 'HIDE' {
  return delegadoDe(user, doctor).delegado?.replyDisclosure ?? 'SHOW';
}

/* ---- lo que dice una conversación ------------------------------------------------ */

interface HiloDeApoyo {
  readonly id: string;
  readonly doctor: DoctorSimulado;
  readonly mensajes: readonly SimulatedMessage[];
}

/** Las conversaciones directas entre un doctor y alguien más: las que llegan a su bandeja. */
function hilosDe(doctor: DoctorSimulado): readonly HiloDeApoyo[] {
  const perfil = perfilDeChatDe(doctor);
  return conversationList
    .filtrar((c) => c.groupId === null && c.participantes.length === 2 && c.participantes.includes(perfil))
    .filter((c) => c.participantes.some((p) => showcaseOf(p)?.kind === 'PATIENT'))
    .map((c) => ({
      id: c.id,
      doctor,
      mensajes: messageList.filtrar((m) => m.conversationId === c.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    }));
}

function hiloPorId(conversationId: string): HiloDeApoyo | undefined {
  for (const doctor of Object.values(DOCTORES_POR_TENANT).flat()) {
    const hilo = hilosDe(doctor).find((h) => h.id === conversationId);
    if (hilo !== undefined) return hilo;
  }
  return undefined;
}

/** Un mensaje clínico del paciente que el doctor todavía no respondió. */
function hayClinicoAbierto(hilo: HiloDeApoyo): boolean {
  const perfilDoctor = perfilDeChatDe(hilo.doctor);
  const ultimaDelDoctor = [...hilo.mensajes].reverse().find((m) => m.senderProfileId === perfilDoctor)?.sentAt ?? '';
  return hilo.mensajes.some((m) => m.senderProfileId !== perfilDoctor && m.sentAt > ultimaDelDoctor && esMensajeClinico(m.bodyText));
}

/** El estado vigente: un mensaje del paciente posterior a «resuelta» la reabre. */
function estadoDe(hilo: HiloDeApoyo, fila: FilaAsignacion | undefined): ConversationAssignmentStatus {
  const estado = fila?.status ?? 'NEW';
  if (estado !== 'RESOLVED') return estado;
  const perfilDoctor = perfilDeChatDe(hilo.doctor);
  const resuelta = fila?.resolvedAt ?? '';
  return hilo.mensajes.some((m) => m.senderProfileId !== perfilDoctor && m.sentAt > resuelta) ? 'NEW' : 'RESOLVED';
}

function vencimientoDe(hilo: HiloDeApoyo, fila: FilaAsignacion | undefined, estado: ConversationAssignmentStatus): string | undefined {
  if (estado === 'RESOLVED') return undefined;
  if (fila?.slaDueAt !== undefined) return fila.slaDueAt;
  const perfilDoctor = perfilDeChatDe(hilo.doctor);
  const ultimaDelPaciente = [...hilo.mensajes].reverse().find((m) => m.senderProfileId !== perfilDoctor);
  const ultimaDelDoctor = [...hilo.mensajes].reverse().find((m) => m.senderProfileId === perfilDoctor);
  // Sin vencimiento declarado: cuatro horas desde el último mensaje del paciente que nadie respondió.
  if (ultimaDelPaciente === undefined || (ultimaDelDoctor !== undefined && ultimaDelDoctor.sentAt > ultimaDelPaciente.sentAt)) return undefined;
  return new Date(new Date(ultimaDelPaciente.sentAt).getTime() + HORAS_DE_RESPUESTA * MS_POR_HORA).toISOString();
}

function nombreDeUsuario(userId: string | undefined): string | undefined {
  return userId === undefined ? undefined : (usuarioPorId(userId)?.displayName ?? vinculos.filtrar((v) => v.userId === userId)[0]?.personName ?? 'Alguien del equipo');
}

/** Con esta etiqueta se vincula el acceso clínico: es la misma que usa «Mi equipo» (nombre y documento tapado). */
function etiquetaDe(hilo: HiloDeApoyo): string {
  const paciente = pacienteDeConversacion(hilo.id);
  return paciente === undefined ? 'Paciente' : etiquetaDePaciente(paciente.id);
}

/** Lo que se le muestra a la persona de apoyo: solo el nombre público del paciente, sin su documento. */
function nombrePublicoDe(hilo: HiloDeApoyo): string {
  return pacienteDeConversacion(hilo.id)?.displayName ?? 'Paciente';
}

function vistaDeItem(hilo: HiloDeApoyo, user: MockUser, tenantId: string): SupportInboxItem {
  const fila = asignaciones.get(hilo.id);
  const estado = estadoDe(hilo, fila);
  const perfilDoctor = perfilDeChatDe(hilo.doctor);
  const ultimo = hilo.mensajes.at(-1);
  const delPaciente = [...hilo.mensajes].reverse().find((m) => m.senderProfileId !== perfilDoctor) ?? ultimo;
  const dueno = estado === 'NEW' ? undefined : fila?.assignedUserId;
  const vence = vencimientoDe(hilo, fila, estado);
  const reservado = esPacienteReservado(pacienteDeConversacion(hilo.id)?.id);
  return {
    conversationId: hilo.id,
    // La organización con los dos nombres que manda la API: el mismo valor.
    tenantId,
    organizationId: tenantId,
    organizationName: TENANT_NAMES[tenantId] ?? 'Organización',
    practitionerProfileId: hilo.doctor.practitionerProfileId,
    practitionerName: hilo.doctor.name,
    doctorPublicProfileId: perfilDeChatDe(hilo.doctor),
    // Un paciente reservado sale como bloque «Reservado»: sin nombre ni texto, con el motivo `RESERVED` (la API no dice cuál).
    patientLabel: reservado ? 'Reservado' : nombrePublicoDe(hilo),
    ...(reservado ? { denialReason: 'RESERVED' } : {}),
    // Lo último que escribió el paciente, recortado (con el marcador si es clínico): lo que hay que contestar.
    ...(reservado || delPaciente === undefined || delPaciente.senderProfileId === perfilDoctor ? {} : { lastPatientMessage: adelantoDe(delPaciente.bodyText) }),
    lastMessagePreview: reservado ? '' : adelantoDe(delPaciente?.bodyText ?? ''),
    lastMessageAt: ultimo?.sentAt ?? ahora(),
    status: estado,
    ...(dueno === undefined ? {} : { assignedUserId: dueno, assignedToName: nombreDeUsuario(dueno)! }),
    assignedToMe: dueno !== undefined && dueno === user.id,
    ...(vence === undefined ? {} : { slaDueAt: vence }),
    isClinical: hayClinicoAbierto(hilo),
  };
}

function contextoDelPaciente(hilo: HiloDeApoyo, user: MockUser): SupportPatientContext {
  const paciente = pacienteDeConversacion(hilo.id);
  const { vinculo } = delegadoDe(user, hilo.doctor);
  const etiqueta = etiquetaDe(hilo);
  const pedidos = vinculo === undefined
    ? []
    : accesosClinicos.filtrar((c) => c.doctorId === hilo.doctor.id && c.engagementId === vinculo.id && c.patientLabel === etiqueta).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const estado: ClinicalAccessState = pedidos[0]?.status === 'PENDING' ? 'PENDING' : pedidos[0]?.status === 'APPROVED' ? 'APPROVED' : 'NONE';
  const motivo = semillaDe(hilo.id)?.motivo;
  return {
    ...(motivo === undefined ? {} : { reasonLabel: motivo }),
    clinicalAccess: estado,
    ...(vinculo === undefined ? {} : { delegateId: delegadoId(vinculo.id, hilo.doctor.id) }),
    ...(paciente === undefined ? {} : { patientProfileId: paciente.id }),
    requestedPermissionId: PERMISO_LECTURA_CLINICA,
  };
}

function asignables(hilo: HiloDeApoyo): readonly { userId: string; name: string }[] {
  const tenantId = hilo.doctor.tenantId;
  return vinculos
    .filtrar((v) => v.tenantId === tenantId && v.status === 'ACTIVE')
    .filter((v) => puedeAtender(permisosEfectivosDeVinculo(v.id), tenantId, hilo.doctor))
    // Quien se queda con la conversación tiene que poder responderla: con la aceptación del doctor.
    .filter((v) => {
      const delegado = delegados.get(delegadoId(v.id, hilo.doctor.id));
      return delegado !== undefined && delegado.status === 'ACTIVE' && delegado.mayReplyOnBehalf;
    })
    .map((v) => ({ userId: v.userId, name: v.personName }));
}

function vistaDeConversacion(hilo: HiloDeApoyo, user: MockUser): SupportConversation {
  const item = vistaDeItem(hilo, user, hilo.doctor.tenantId);
  const perfilDoctor = perfilDeChatDe(hilo.doctor);
  const contexto = contextoDelPaciente(hilo, user);
  const notas: InternalNote[] = notasInternas
    .filtrar((n) => n.conversationId === hilo.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((n) => ({ id: n.id, conversationId: n.conversationId, authorName: nombreDeUsuario(n.authorUserId)!, bodyText: n.bodyText, createdAt: n.createdAt }));
  return {
    conversationId: hilo.id,
    tenantId: item.organizationId,
    organizationId: item.organizationId,
    organizationName: item.organizationName,
    practitionerProfileId: item.practitionerProfileId,
    practitionerName: hilo.doctor.name,
    doctorPublicProfileId: perfilDeChatDe(hilo.doctor),
    practitionerSpecialty: hilo.doctor.specialty,
    patientLabel: item.patientLabel,
    status: item.status,
    ...(item.assignedToName === undefined ? {} : { assignedToName: item.assignedToName }),
    assignedToMe: item.assignedToMe,
    ...(item.slaDueAt === undefined ? {} : { slaDueAt: item.slaDueAt }),
    isClinical: item.isClinical,
    replyDisclosure: leyendaDe(user, hilo.doctor),
    // Se la ve solo si se puede responder: siempre `true`.
    replyAllowed: true,
    assignableTo: asignables(hilo),
    messages: hilo.mensajes.map((m) => mensajeVisible(m, perfilDoctor, contexto.clinicalAccess, (id) => nombreDeUsuario(id) ?? 'Alguien del equipo')),
    notes: notas,
    patientContext: contexto,
  };
}

/**
 * Responde 404 si la persona no ve esa conversación; si la ve, la devuelve. Se **ve** solo si se puede
 * responder por el doctor (vínculo, permiso y aceptación): el mismo 404 exista o no, para no confirmar
 * a quien no tiene acceso que la conversación existe.
 */
function conAcceso(request: MockRequest): { user: MockUser; hilo: HiloDeApoyo } | MockReply {
  const user = request.user;
  if (user === null) return forbidden('Sin sesión.');
  const hilo = hiloPorId(request.params['id']!);
  if (hilo === undefined || !puedeVer(user, hilo.doctor)) {
    return conMotivo(404, 'Conversación no encontrada.', 'CONVERSATION_NOT_FOUND');
  }
  return { user, hilo };
}

function esRespuesta<T extends object>(valor: T | MockReply): valor is MockReply {
  return 'status' in valor && 'body' in valor;
}

/* ---- el registro de rutas -------------------------------------------------------- */

export function registrarApoyoChat(router: MockRouter): void {
  /* ---- bandeja y conversación ----------------------------------------------- */

  /**
   * La bandeja. Con `tenantId` se acota a esa organización; sin él, la API junta las
   * organizaciones donde la persona tiene un vínculo vivo. Sin vínculo, 403
   * `SUPPORT_INBOX_NO_ENGAGEMENT`; con vínculo pero sin responder mensajes, 403
   * `SUPPORT_INBOX_NO_REPLY_PERMISSION`.
   */
  router.get('/me/support-inbox', ({ user, query }) => {
    if (user === null) return forbidden('Sin sesión.');
    const pedida = query.get('tenantId') ?? query.get('org');
    if (pedida !== null && CATALOGOS[pedida] === undefined) return notFound('Organización no encontrada.');
    const organizaciones = pedida !== null ? [pedida] : [...new Set(vinculos.filtrar((v) => v.userId === user.id && v.status === 'ACTIVE').map((v) => v.tenantId))];
    const conVinculo = organizaciones.filter((o) => vinculosActivosDe(user.id, o).length > 0);
    if (conVinculo.length === 0) return conMotivo(403, 'No tiene un vínculo de apoyo vigente con esta organización.', 'SUPPORT_INBOX_NO_ENGAGEMENT');
    const conPermiso = conVinculo.filter((o) => doctoresQueAtiende(user, o).length > 0);
    if (conPermiso.length === 0) return conMotivo(403, 'Su permiso no incluye atender mensajes de pacientes.', 'SUPPORT_INBOX_NO_REPLY_PERMISSION');

    const filtroEstado = query.get('status');
    const filtroDoctor = query.get('doctor');
    const items = conPermiso
      .flatMap((org) => doctoresQueAtiende(user, org).filter((d) => puedeVer(user, d)).flatMap((d) => hilosDe(d).map((h) => vistaDeItem(h, user, org))))
      .filter((i) => (filtroEstado === null || i.status === filtroEstado) && (filtroDoctor === null || i.practitionerProfileId === filtroDoctor));

    // Los doctores, en el mismo orden que la agenda combinada: de ahí sale el color de cada uno.
    const doctors: SupportInboxDoctor[] = conPermiso.flatMap((org) =>
      ordenarDoctores(org, previewCoverage(permisosEfectivos(user.id, org), catalogoDe(org)).doctors.map((c) => c.doctor)).flatMap((d) => {
        // Solo los doctores cuya conversación esta persona puede ver: los demás no aparecen.
        const visible = (DOCTORES_POR_TENANT[org] ?? []).some((x) => x.id === d.id && puedeVer(user, x));
        if (!visible) return [];
        const sim = (DOCTORES_POR_TENANT[org] ?? []).find((x) => x.id === d.id);
        return sim === undefined ? [] : [{ id: d.id, practitionerProfileId: sim.practitionerProfileId, name: d.name, displayName: d.name, specialty: d.specialty }];
      }),
    );
    return { items, doctors, count: items.length };
  });

  router.get('/me/support-inbox/:id', (request) => {
    const acceso = conAcceso(request);
    if (esRespuesta(acceso)) return acceso;
    return vistaDeConversacion(acceso.hilo, acceso.user);
  });

  router.get('/me/support-reply-templates', ({ user, query }) => {
    if (user === null) return forbidden('Sin sesión.');
    const org = (query.get('tenantId') ?? query.get('org'));
    if (org === null || CATALOGOS[org] === undefined) return notFound('Organización no encontrada.');
    if (vinculosActivosDe(user.id, org).length === 0) return conMotivo(403, 'No tiene un vínculo de apoyo vigente con esta organización.', 'SUPPORT_INBOX_NO_ENGAGEMENT');
    // Quien responde solo ve las que no están retiradas.
    const items = plantillas.filtrar((p) => p.tenantId === org && p.retired !== true).map(vistaDePlantilla);
    return { items, count: items.length };
  });

  registrarRespuestasPreparadas(router);

  /* ---- asignación y notas ------------------------------------------------------ */

  router.post('/community/conversations/:id/assignment', (request) => {
    const acceso = conAcceso(request);
    if (esRespuesta(acceso)) return acceso;
    const { user, hilo } = acceso;
    // Dos formas: la corta `{ practitionerProfileId?, assignedUserId?, status }` y la explícita
    // `{ action: TAKE | ASSIGN | SET_STATUS, … }`.
    const crudo = cuerpo<{ practitionerProfileId: string; assignedUserId?: string; status: ConversationAssignmentStatus; action: 'TAKE' | 'ASSIGN' | 'SET_STATUS' }>(request);
    const datos: { practitionerProfileId?: string; assignedUserId?: string; status?: ConversationAssignmentStatus } = {
      ...(crudo.practitionerProfileId === undefined ? {} : { practitionerProfileId: crudo.practitionerProfileId }),
      ...(crudo.assignedUserId === undefined ? {} : { assignedUserId: crudo.assignedUserId }),
      ...(crudo.action === 'TAKE' ? { status: 'TAKEN' as const } : crudo.action === 'ASSIGN' ? { status: 'TAKEN' as const } : crudo.status === undefined ? {} : { status: crudo.status }),
    };
    if (crudo.action === 'TAKE') delete datos.assignedUserId;
    if (datos.status === undefined || !['NEW', 'TAKEN', 'WAITING_DOCTOR', 'RESOLVED'].includes(datos.status)) {
      return conMotivo(422, 'Falta el estado al que pasa la conversación.', 'CONVERSATION_STATUS_REQUIRED');
    }
    if (datos.practitionerProfileId !== undefined && datos.practitionerProfileId !== hilo.doctor.practitionerProfileId) {
      return conMotivo(422, 'Esa conversación no es de ese doctor.', 'CONVERSATION_PRACTITIONER_MISMATCH');
    }
    const estadoPedido: ConversationAssignmentStatus = datos.status;

    const fila = asignaciones.get(hilo.id);
    const estadoActual = estadoDe(hilo, fila);
    const dueno = estadoActual === 'NEW' ? undefined : fila?.assignedUserId;
    const esMia = dueno === user.id;
    const nombreDelDueno = nombreDeUsuario(dueno);

    // Una conversación la tiene una persona: las demás no se la sacan.
    if (dueno !== undefined && !esMia && estadoActual !== 'RESOLVED') {
      return conMotivo(409, `${nombreDelDueno} ya tiene esta conversación.`, 'CONVERSATION_ALREADY_TAKEN', { assignedToName: nombreDelDueno });
    }

    let asignada: string | undefined = dueno;
    if (estadoPedido === 'NEW') {
      asignada = undefined;
    } else if (estadoPedido === 'TAKEN') {
      const destino = datos.assignedUserId ?? user.id;
      if (destino !== user.id && !asignables(hilo).some((p) => p.userId === destino)) {
        // Asignar a otra persona: debe poder atender a ese doctor.
        return conMotivo(422, 'Esa persona no tiene acceso a las conversaciones de este doctor.', 'CONVERSATION_ASSIGNEE_NOT_ELIGIBLE');
      }
      asignada = destino;
    } else {
      // Derivar o resolver: lo hace quien la tiene, o quien la toma en ese mismo gesto.
      asignada = asignada ?? user.id;
    }

    const nueva: FilaAsignacion = {
      id: hilo.id,
      practitionerProfileId: hilo.doctor.practitionerProfileId,
      status: estadoPedido,
      ...(asignada === undefined ? {} : { assignedUserId: asignada }),
      ...(estadoPedido === 'RESOLVED'
        ? { resolvedAt: ahora() }
        : estadoActual === 'RESOLVED'
          ? { slaDueAt: dentroDe(HORAS_DE_RESPUESTA * 60) }
          : fila?.slaDueAt === undefined
            ? {}
            : { slaDueAt: fila.slaDueAt }),
    };
    asignaciones.agregar(nueva);
    const verbo = estadoPedido === 'TAKEN' ? (asignada === user.id ? 'tomó' : `asignó a ${nombreDeUsuario(asignada)}`) : estadoPedido === 'WAITING_DOCTOR' ? 'derivó al doctor' : estadoPedido === 'RESOLVED' ? 'resolvió' : 'liberó';
    anotar(hilo.doctor.tenantId, user.displayName, 'messages.assignment', `${user.displayName} ${verbo} una conversación de ${hilo.doctor.name}.`, { doctorId: hilo.doctor.id });
    const nombreAsignada = nombreDeUsuario(asignada);
    const vence = vencimientoDe(hilo, nueva, estadoPedido);
    // `ConversationAssignmentResultDto`: el estado, quién la tiene, el plazo y si se derivó al doctor.
    return {
      conversationId: hilo.id,
      status: estadoPedido,
      ...(asignada === undefined ? {} : { assignedUserId: asignada, assignedToName: nombreAsignada! }),
      ...(vence === undefined ? {} : { slaDueAt: vence }),
      referredToDoctor: estadoPedido === 'WAITING_DOCTOR',
    };
  });

  router.post('/community/conversations/:id/internal-notes', (request) => {
    const acceso = conAcceso(request);
    if (esRespuesta(acceso)) return acceso;
    const texto = String(cuerpo<{ bodyText: string }>(request).bodyText ?? '').trim();
    if (texto === '' || texto.length > 2000) return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'La nota tiene de 1 a 2000 caracteres.', error: 'Bad Request', details: { fields: [{ field: 'bodyText', message: 'de 1 a 2000 caracteres' }] } });
    const nota = notasInternas.agregar({ id: nuevoId('nota'), conversationId: acceso.hilo.id, authorUserId: acceso.user.id, bodyText: texto, createdAt: ahora() });
    const respuesta: InternalNote = { id: nota.id, conversationId: nota.conversationId, authorName: acceso.user.displayName, bodyText: nota.bodyText, createdAt: nota.createdAt };
    return { status: 201, body: respuesta };
  });

  /* ---- responder en nombre del doctor ------------------------------------------ */

  /**
   * El paciente ve **al doctor** como remitente; la autora real queda guardada.
   * Sin el permiso `messages.reply_on_behalf` ni la aceptación del doctor, 403
   * aunque la pantalla no ofrezca el botón; con un mensaje clínico sin derivar,
   * 422; y si otra persona tiene la conversación, 409.
   */
  router.wrap('POST', '/community/conversations/:id/messages', (request, siguiente) => {
    const datos = cuerpo<{ onBehalfOfProfileId?: string; senderProfileId?: string; bodyText?: string; channels?: unknown }>(request);
    const pideCorreo = Array.isArray(datos.channels) && datos.channels.includes('EMAIL');
    if (datos.onBehalfOfProfileId === undefined) {
      // El correo solo sale al responder en nombre del doctor: el paciente lo recibe a su nombre.
      if (pideCorreo) return conMotivo(422, 'El correo solo se envía al responder en nombre de un doctor.', 'EMAIL_CHANNEL_REQUIRES_ON_BEHALF');
      return siguiente(request);
    }
    const user = request.user;
    // El remitente es el perfil **público** del doctor. Con el profesional (u otro perfil) quien manda no es
    // participante de la conversación: la API lo rechaza.
    const doctor = doctorPorPerfilPublico(datos.onBehalfOfProfileId);
    if (user === null || doctor === undefined) return forbidden('No puede responder en nombre de ese perfil.');
    if (!doctoresQueAtiende(user, doctor.tenantId).some((d) => d.id === doctor.id)) {
      return forbidden('Su permiso no incluye responder mensajes en nombre del doctor.');
    }
    const { delegado } = delegadoDe(user, doctor);
    if (delegado === undefined || delegado.status !== 'ACTIVE' || !delegado.mayReplyOnBehalf) {
      return forbidden(`${doctor.name} todavía no le autorizó a responder en su nombre.`);
    }

    const id = request.params['id']!;
    const hilo = hilosDe(doctor).find((h) => h.id === id);
    // `guardReply` repite la lectura de la bandeja: si la conversación no está en la de ese doctor, 404 como si no existiera.
    if (hilo === undefined) return conMotivo(404, 'Conversación no encontrada.', 'CONVERSATION_NOT_FOUND');
    // Responder a un paciente reservado en nombre del doctor pide el segundo paso (403 `STEP_UP_REQUIRED`).
    const paso = desafioDePacienteReservado(user, [pacienteDeConversacion(id)?.id]);
    if (paso !== null) return paso;
    const fila = asignaciones.get(id);
    const estado = estadoDe(hilo, fila);
    const dueno = estado === 'NEW' ? undefined : fila?.assignedUserId;
    if (dueno !== undefined && dueno !== user.id && estado !== 'RESOLVED') {
      return conMotivo(409, `${nombreDeUsuario(dueno)} ya tiene esta conversación.`, 'CONVERSATION_HELD_BY_OTHER', { assignedToName: nombreDeUsuario(dueno) });
    }
    if (hayClinicoAbierto(hilo) && estado !== 'WAITING_DOCTOR') {
      return conMotivo(422, 'El mensaje del paciente es clínico: solo el doctor puede responderlo. Derívelo al doctor.', 'CLINICAL_REQUIRES_DERIVATION');
    }
    // Un texto saliente que suena clínico tampoco lo manda el equipo.
    if (esMensajeClinico(datos.bodyText ?? '')) {
      return conMotivo(422, 'Una respuesta del equipo no puede dar contenido clínico: derívela al doctor.', 'SUPPORT_CLINICAL_CONTENT');
    }

    const enviado = siguiente({ ...request, body: { ...datos, senderProfileId: perfilDeChatDe(doctor) } });
    const resultado = (isMockReply(enviado) ? enviado.body : enviado) as { id?: string } | null;
    if (resultado?.id !== undefined && (!isMockReply(enviado) || enviado.status < 300)) {
      autorias.agregar({ id: resultado.id, authorUserId: user.id, onBehalfOfProfileId: doctor.practitionerProfileId, disclosureShown: delegado.replyDisclosure === 'SHOW' });
      // Responder es hacerse cargo: si estaba libre o resuelta, queda en sus manos; el plazo ya se cumplió.
      asignaciones.agregar({
        id,
        practitionerProfileId: doctor.practitionerProfileId,
        status: estado === 'WAITING_DOCTOR' ? 'WAITING_DOCTOR' : 'TAKEN',
        assignedUserId: estado === 'WAITING_DOCTOR' ? (fila?.assignedUserId ?? user.id) : user.id,
      });
      anotar(doctor.tenantId, user.displayName, 'messages.reply_on_behalf', `${user.displayName} respondió un mensaje administrativo en nombre de ${doctor.name}.`, { doctorId: doctor.id });
      if (pideCorreo) {
        // El correo se **encola**: `queued` no dice que llegó. Un paciente sin correo no recibe nada y se dice por qué.
        const paciente = pacienteDeConversacion(id);
        const email = paciente === undefined || paciente.email === '' ? { queued: false, skippedReason: 'La cuenta del paciente no tiene un correo verificado con credencial activa' } : { queued: true, requestId: nuevoId('correo') };
        const cuerpoEnviado = isMockReply(enviado) ? (enviado.body as object) : (enviado as object);
        const conCorreo = { ...cuerpoEnviado, conversationId: id, email };
        return isMockReply(enviado) ? { ...enviado, body: conCorreo } : conCorreo;
      }
    }
    return enviado;
  });

  /* ---- lo que ven el paciente y el doctor en el chat de siempre ----------------- */

  router.wrap('GET', '/community/conversations/:id/messages', (request, siguiente) => {
    const respuesta = siguiente(request);
    const cuerpoDeLectura = (isMockReply(respuesta) ? respuesta.body : respuesta) as { items?: readonly Record<string, unknown>[] } | null;
    if (cuerpoDeLectura === null || typeof cuerpoDeLectura !== 'object' || !Array.isArray(cuerpoDeLectura.items) || autorias.todos().length === 0) return respuesta;
    // La autora real solo la ve el doctor dueño del perfil; la leyenda, quien el doctor decidió.
    const lector = doctorDe(request.user);
    const items = cuerpoDeLectura.items.map((m) => {
      const autoria = autorias.get(String(m['id']));
      if (autoria === undefined) return m;
      return {
        ...m,
        ...(autoria.disclosureShown ? { repliedByTeam: true } : {}),
        ...(lector !== undefined && lector.practitionerProfileId === autoria.onBehalfOfProfileId ? { teamAuthorName: nombreDeUsuario(autoria.authorUserId)! } : {}),
      };
    });
    const nuevo = { ...cuerpoDeLectura, items };
    return isMockReply(respuesta) ? { ...respuesta, body: nuevo } : nuevo;
  });

  router.wrap('GET', '/community/conversations', (request, siguiente) => {
    const respuesta = siguiente(request);
    const cuerpoDeLectura = (isMockReply(respuesta) ? respuesta.body : respuesta) as { items?: readonly Record<string, unknown>[] } | null;
    if (cuerpoDeLectura === null || typeof cuerpoDeLectura !== 'object' || !Array.isArray(cuerpoDeLectura.items)) return respuesta;
    const yo = request.query.get('profileId') ?? '';
    const items = cuerpoDeLectura.items.map((c) => {
      const fila = asignaciones.get(String(c['id']));
      const doctor = fila === undefined ? undefined : doctorPorPerfil(fila.practitionerProfileId);
      // Solo el doctor ve que su equipo le derivó algo.
      if (fila === undefined || doctor === undefined || fila.status !== 'WAITING_DOCTOR' || perfilDeChatDe(doctor) !== yo) return c;
      return { ...c, awaitingDoctor: true };
    });
    const nuevo = { ...cuerpoDeLectura, items };
    return isMockReply(respuesta) ? { ...respuesta, body: nuevo } : nuevo;
  });

  /* ---- pedir acceso clínico temporal (caso 10) --------------------------------- */

  /**
   * `POST /me/support-access-requests` (sin tenant activo): la persona de apoyo pide al **doctor** acceso clínico temporal a
   * un paciente. La organización llega en el cuerpo y se contrasta con su vínculo. Lo decide el doctor
   * (`POST /access-requests/:id/decision`), no la organización.
   */
  router.post('/me/support-access-requests', (request) => {
    const user = request.user;
    if (user === null) return forbidden('Sin sesión.');
    const datos = cuerpo<{ tenantId?: string; practitionerProfileId?: string; patientProfileId?: string; reasonText?: string }>(request);
    const doctor = (DOCTORES_POR_TENANT[datos.tenantId ?? ''] ?? []).find((d) => d.practitionerProfileId === datos.practitionerProfileId);
    const { vinculo } = doctor === undefined ? { vinculo: undefined } : delegadoDe(user, doctor);
    if (doctor === undefined || vinculo === undefined) return forbidden('No tiene un vínculo de apoyo con ese doctor en esa organización.');
    const motivo = (datos.reasonText ?? '').trim();
    if (motivo.length < 5) return validation('Cuente para qué necesita el acceso.', [{ field: 'reasonText', message: 'escriba el motivo' }]);
    if ((datos.patientProfileId ?? '') === '') return validation('Falta el paciente.', [{ field: 'patientProfileId', message: 'es obligatorio' }]);
    const etiqueta = etiquetaDePaciente(datos.patientProfileId!);
    const abierta = accesosClinicos.filtrar((c) => c.doctorId === doctor.id && c.engagementId === vinculo.id && c.patientLabel === etiqueta && c.status === 'PENDING')[0];
    if (abierta !== undefined) return conflict('Ya hay un pedido de acceso para este paciente esperando al doctor.');
    const fila = accesosClinicos.agregar({
      id: nuevoId('acceso-clinico'),
      doctorId: doctor.id,
      engagementId: vinculo.id,
      patientLabel: etiqueta,
      reasonText: motivo,
      requestedAt: ahora(),
      requestedHours: 24,
      status: 'PENDING',
    });
    anotar(doctor.tenantId, user.displayName, 'clinical_access.requested', `${user.displayName} pidió a ${doctor.name} un acceso clínico temporal.`, { doctorId: doctor.id });
    return { status: 201, body: { id: fila.id, tenantId: doctor.tenantId } };
  });
}
