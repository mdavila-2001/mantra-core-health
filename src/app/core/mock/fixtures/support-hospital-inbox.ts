import { SUPPORT_TEMPLATE_DEFAULT_ACTIONS } from '../../data-access/support-access/support-access.types';
import { type ReplyTemplate } from '../../data-access/support-access/support-inbox.types';
import { CONCEPT, conversationList, messageList, showcaseOf, showcases, type SimulatedConversation, type SimulatedMessage, type SimulatedShowcase } from './community';
import { patientById, PATIENTS } from './people';
import {
  accesosClinicos,
  ANTELO,
  asignaciones,
  autorias,
  CESPEDES,
  delegadoId,
  delegados,
  DOCTORES_HOSPITAL,
  FLORES,
  MENDEZ,
  notasInternas,
  PEREZ,
  permisos,
  ROJAS,
  SUAREZ,
  VACA,
  vinculos,
  type DoctorSimulado,
  type FilaAsignacion,
  type FilaAutoria,
  type FilaDelegado,
  type FilaNota,
  type FilaPermiso,
  type FilaVinculo,
} from './support-hospital';
import { IDS, TENANT_HOSPITAL_PILOTO } from '../mock-session';
import { avatarSvg, Coleccion, imagenSvg, iso, uuid } from '../mock-store';

/* ============================================================================
    La **bandeja de chat compartida** del hospital piloto y del consultorio de
    la Dra. Céspedes: conversaciones de pacientes con varios doctores, en todos
    los estados, algunas clínicas, con plantillas y notas internas.

    Todo es sintético. Los tiempos se cuentan **desde que carga la maqueta**
    (hace 40 minutos, vence en 95): así «vencido» y «por vencer» se ven siempre,
    sin importar el día. Los identificadores salen de `uuid(semilla)`.

    Las conversaciones viven en las colecciones de la red social
    (`conversationList` / `messageList`) para que el **paciente** y el **doctor**
    las vean en su chat de siempre, y la asignación, las notas y la autoría real
    en las del personal de apoyo. Solo se agrega lo que falta: lo que la pestaña
    ya guardó (un mensaje nuevo, un estado cambiado) no se pisa al recargar.
    ========================================================================== */

type Estado = FilaAsignacion['status'];

const MIN = 60_000;
/** Un instante `minutos` atrás de ahora. */
const hace = (minutos: number): string => new Date(Date.now() - minutos * MIN).toISOString();
/** Un instante `minutos` adelante de ahora (negativo = ya pasó). */
export const dentroDe = (minutos: number): string => new Date(Date.now() + minutos * MIN).toISOString();

/** Cuántas horas tiene el equipo para responder una conversación nueva: su `sla_due_at`. */
export const HORAS_DE_RESPUESTA = 4;

/* ---- la otra secretaria ---------------------------------------------------------- */

/**
 * Mariela Soliz: la segunda secretaria del hospital. Cubre al Dr. Pérez como Ana,
 * y el doctor la autorizó a responder en su nombre. Sirve para ver que una
 * conversación que tomó una no la toma la otra. Se registra acá, con las demás
 * piezas de la bandeja, y solo si falta.
 */
export const VINCULO_MARIELA: FilaVinculo = {
  id: uuid('hp-eng-mariela'),
  tenantId: TENANT_HOSPITAL_PILOTO,
  ownerKind: 'ORGANIZATION',
  userId: IDS.mariela.userId,
  personName: 'Mariela Soliz',
  personEmail: 'mariela.soliz@alovida.mock',
  roleTemplate: 'SECRETARY',
  status: 'ACTIVE',
  origin: 'INVITATION',
  validFrom: iso(-20),
  recertifyEveryMonths: 12,
  nextRecertificationAt: iso(345),
};
const PERMISO_MARIELA: FilaPermiso = {
  id: uuid('hp-grant-mariela-perez'),
  engagementId: VINCULO_MARIELA.id,
  targetKind: 'PRACTITIONER',
  practitionerRoleAssignmentId: PEREZ.id,
  expansionMode: 'DYNAMIC',
  actions: SUPPORT_TEMPLATE_DEFAULT_ACTIONS['SECRETARY'],
  status: 'ACTIVE',
};
const DELEGADO_MARIELA: FilaDelegado = {
  id: delegadoId(VINCULO_MARIELA.id, PEREZ.id),
  engagementId: VINCULO_MARIELA.id,
  doctorId: PEREZ.id,
  status: 'ACTIVE',
  mayReplyOnBehalf: true,
  replyDisclosure: 'SHOW',
  acceptedAt: iso(-15),
};
/**
 * Suma a Mariela (vínculo, permiso y aceptación de Pérez). Al cargar, solo si falta: lo guardado en la sesión gana. Al
 * reiniciar, `pisar` la deja como de fábrica aunque una prueba anterior le haya terminado el vínculo.
 */
function sumarAMariela(pisar: boolean): void {
  if (pisar || !vinculos.has(VINCULO_MARIELA.id)) vinculos.agregar(VINCULO_MARIELA);
  if (pisar || !permisos.has(PERMISO_MARIELA.id)) permisos.agregar(PERMISO_MARIELA);
  if (pisar || !delegados.has(DELEGADO_MARIELA.id)) delegados.agregar(DELEGADO_MARIELA);
}
sumarAMariela(false);

/* ---- los perfiles de chat de los doctores --------------------------------------- */

/** El id del perfil de chat de un doctor: el remitente de lo que se responde en su nombre. */
export function perfilDeChatDe(d: DoctorSimulado): string {
  return uuid(`public-profile-${d.practitionerProfileId}`);
}

/** La vitrina de un doctor: lo que el paciente ve como remitente. Privada: no sale en ningún directorio. */
function vitrinaDeDoctor(d: DoctorSimulado): SimulatedShowcase {
  return {
    id: perfilDeChatDe(d),
    tenantId: d.tenantId,
    targetId: d.practitionerProfileId,
    kind: 'PRACTITIONER',
    slug: `apoyo-${d.id.slice(0, 8)}`,
    displayName: d.name,
    headline: d.specialty,
    biography: '',
    avatarUrl: avatarSvg(d.name, '#1f6f8b'),
    coverUrl: imagenSvg('AloVida'),
    avatarFileId: uuid(`avatar-${d.practitionerProfileId}`),
    coverFileId: uuid(`cover-${d.practitionerProfileId}`),
    verified: true,
    acceptsReviews: false,
    visibility: 'PRIVATE',
    city: 'Santa Cruz de la Sierra',
    address: '',
    lat: -17.78,
    lng: -63.18,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    hasPublishedAgenda: false,
    categoria: null,
    seguidores: 0,
  };
}

for (const d of [...DOCTORES_HOSPITAL, CESPEDES]) {
  if (!showcases.has(perfilDeChatDe(d))) showcases.agregar(vitrinaDeDoctor(d));
}

/* ---- qué es clínico (lo decide la API; acá, una regla simple) -------------------- */

const SENALES_CLINICAS =
  /\b(dolor|duele|duelen|sangr\w*|mareo\w*|fiebre|s[ií]ntoma\w*|dosis|medicaci[oó]n|medicamento\w*|pastilla\w*|diagn[oó]stico|latido\w*|palpitaci\w*|falta (el )?aire|respirar|alergia|erupci[oó]n|irrit[oó]\w*|infecci[oó]n|v[oó]mito\w*|n[aá]usea\w*|glucosa|tratamiento|efecto\w* secundario\w*|desmay\w*|arde)\b/i;

/** `true` si un mensaje del paciente habla de salud: solo el doctor puede responderlo. */
export function esMensajeClinico(texto: string): boolean {
  return SENALES_CLINICAS.test(texto);
}

/* ---- las conversaciones de partida --------------------------------------------- */

interface MensajeDeSemilla {
  readonly de: 'PACIENTE' | 'DOCTOR';
  readonly texto: string;
  readonly haceMin: number;
  /** Si el doctor respondió «a través» de su equipo: quién escribió de verdad. */
  readonly autora?: { readonly userId: string; readonly muestraAviso: boolean };
}

interface ConversacionDeSemilla {
  readonly clave: string;
  readonly doctor: DoctorSimulado;
  /** Índice en `PATIENTS`: 0 es la paciente de la maqueta; 1 a 4 tienen perfil de chat. */
  readonly paciente: 0 | 1 | 2 | 3 | 4;
  readonly estado: Estado;
  readonly asignadaA?: string;
  /** Minutos hasta el vencimiento de la respuesta (negativo = ya venció). Ausente en lo resuelto. */
  readonly venceEnMin?: number;
  /** Hace cuántos minutos se resolvió, si está resuelta. */
  readonly resueltaHaceMin?: number;
  readonly motivo?: string;
  readonly mensajes: readonly MensajeDeSemilla[];
}

export const CONVERSACIONES_DE_SEMILLA: readonly ConversacionDeSemilla[] = [
  {
    // Caso 09: Ana responde como el Dr. Pérez; el paciente ve al doctor.
    clave: 'perez-ana-lucia',
    doctor: PEREZ,
    paciente: 0,
    estado: 'NEW',
    venceEnMin: 95,
    motivo: 'Control de presión arterial',
    mensajes: [{ de: 'PACIENTE', texto: 'Buenas tardes. ¿Puedo cambiar mi cita del jueves a la tarde? Me salió un compromiso de trabajo.', haceMin: 35 }],
  },
  {
    clave: 'perez-jorge',
    doctor: PEREZ,
    paciente: 1,
    estado: 'NEW',
    venceEnMin: -25,
    motivo: 'Seguimiento de arritmia',
    mensajes: [{ de: 'PACIENTE', texto: 'Doctor, desde anoche tengo dolor fuerte en el pecho y me falta el aire. ¿Puedo tomar doble dosis del atenolol?', haceMin: 265 }],
  },
  {
    clave: 'perez-daniela',
    doctor: PEREZ,
    paciente: 2,
    estado: 'TAKEN',
    asignadaA: IDS.ana.userId,
    venceEnMin: 40,
    motivo: 'Ecocardiograma de control',
    mensajes: [{ de: 'PACIENTE', texto: 'Hola, ¿cuánto cuesta el ecocardiograma y aceptan el seguro de La Vitalicia?', haceMin: 200 }],
  },
  {
    clave: 'perez-elena',
    doctor: PEREZ,
    paciente: 4,
    estado: 'RESOLVED',
    asignadaA: IDS.ana.userId,
    resueltaHaceMin: 1400,
    mensajes: [
      { de: 'PACIENTE', texto: '¿Me pueden confirmar la cita del martes a las 10?', haceMin: 1500 },
      { de: 'DOCTOR', texto: 'Con gusto, Elena. Quedó confirmada su cita del martes a las 10:00.', haceMin: 1480, autora: { userId: IDS.ana.userId, muestraAviso: true } },
      { de: 'PACIENTE', texto: 'Gracias, ya la tengo anotada.', haceMin: 1470 },
    ],
  },
  {
    clave: 'rojas-daniela',
    doctor: ROJAS,
    paciente: 2,
    estado: 'NEW',
    venceEnMin: 180,
    motivo: 'Ecografía obstétrica',
    mensajes: [{ de: 'PACIENTE', texto: '¿Qué debo llevar a la eco obstétrica del lunes? ¿Tengo que ir en ayunas?', haceMin: 60 }],
  },
  {
    clave: 'rojas-elena',
    doctor: ROJAS,
    paciente: 4,
    estado: 'WAITING_DOCTOR',
    asignadaA: IDS.ana.userId,
    venceEnMin: 120,
    motivo: 'Control ginecológico',
    mensajes: [{ de: 'PACIENTE', texto: 'Tengo sangrado desde esta mañana y me duele el vientre. ¿Es normal?', haceMin: 140 }],
  },
  {
    clave: 'suarez-martin',
    doctor: SUAREZ,
    paciente: 3,
    estado: 'NEW',
    venceEnMin: 150,
    mensajes: [{ de: 'PACIENTE', texto: 'Buen día, ¿me pueden mandar el certificado de vacunas de Martín?', haceMin: 90 }],
  },
  {
    clave: 'mendez-jorge',
    doctor: MENDEZ,
    paciente: 1,
    estado: 'NEW',
    venceEnMin: 200,
    mensajes: [{ de: 'PACIENTE', texto: '¿Puedo adelantar mi turno de internación una semana?', haceMin: 30 }],
  },
  {
    clave: 'vaca-daniela',
    doctor: VACA,
    paciente: 2,
    estado: 'NEW',
    venceEnMin: 90,
    mensajes: [{ de: 'PACIENTE', texto: 'Me recetaron fisioterapia, ¿ustedes la hacen o debo ir a otro lado?', haceMin: 150 }],
  },
  {
    clave: 'antelo-jorge',
    doctor: ANTELO,
    paciente: 1,
    estado: 'NEW',
    venceEnMin: 220,
    mensajes: [{ de: 'PACIENTE', texto: '¿A qué hora puedo pasar a recoger mi tomografía?', haceMin: 20 }],
  },
  {
    clave: 'flores-elena',
    doctor: FLORES,
    paciente: 4,
    estado: 'NEW',
    venceEnMin: 140,
    mensajes: [{ de: 'PACIENTE', texto: 'Mi cirugía está para el viernes, ¿puedo pasar antes a firmar los papeles?', haceMin: 100 }],
  },
  {
    // El consultorio de la Dra. Céspedes: Rosa lo ve; el hospital, no.
    clave: 'cespedes-elena',
    doctor: CESPEDES,
    paciente: 4,
    estado: 'NEW',
    venceEnMin: 130,
    mensajes: [{ de: 'PACIENTE', texto: '¿Tienen turno para este viernes por la tarde?', haceMin: 110 }],
  },
  {
    clave: 'cespedes-jorge',
    doctor: CESPEDES,
    paciente: 1,
    estado: 'NEW',
    venceEnMin: -10,
    mensajes: [{ de: 'PACIENTE', texto: 'Se me irritó la piel con la crema que me recetó, me arde y tengo una erupción. ¿Qué hago?', haceMin: 250 }],
  },
];

export const conversacionId = (clave: string): string => uuid(`hp-conv-${clave}`);

/* ---- plantillas de respuesta --------------------------------------------------- */

export interface FilaPlantilla extends ReplyTemplate {
  readonly tenantId: string;
}

function plantilla(clave: string, doctor: DoctorSimulado, category: ReplyTemplate['category'], title: string, bodyText: string): FilaPlantilla {
  return { id: uuid(`hp-tpl-${clave}`), tenantId: doctor.tenantId, category, title, bodyText };
}

export const plantillas = new Coleccion<FilaPlantilla>([
  plantilla('recibimos', PEREZ, 'GENERAL', 'Recibimos su mensaje', 'Hola {paciente}, recibimos su mensaje. Nuestro equipo le responde hoy mismo.'),
  plantilla('derivado', PEREZ, 'GENERAL', 'Lo verá el doctor', 'Hola {paciente}, trasladamos su consulta a {doctor}. Le responderá personalmente. Si siente que es urgente, acuda a emergencias.'),
  plantilla('certificado', PEREZ, 'GENERAL', 'Certificados', 'Hola {paciente}, el certificado se retira en admisión de lunes a viernes de 8:00 a 16:00, con su documento.'),
  plantilla('reprogramar', PEREZ, 'SCHEDULING', 'Proponer otro horario', 'Hola {paciente}, podemos reprogramar su cita con {doctor}. ¿Le sirve el jueves a las 15:30? Responda «sí» y se la confirmamos.'),
  plantilla('confirmar', PEREZ, 'SCHEDULING', 'Cita confirmada', 'Hola {paciente}, su cita con {doctor} quedó confirmada. Le pedimos llegar 15 minutos antes con su documento.'),
  plantilla('costo', PEREZ, 'BILLING', 'Costos y seguros', 'Hola {paciente}, el costo lo confirma caja al momento de la atención. Trabajamos con Seguros Andina y La Vitalicia; traiga su credencial.'),
  plantilla('eco', PEREZ, 'PREPARATION', 'Qué traer a un estudio', 'Hola {paciente}, para su estudio venga con su documento y la orden médica. Si necesita preparación especial, se la indicamos por este medio.'),
  plantilla('cesp-recibimos', CESPEDES, 'GENERAL', 'Recibimos su mensaje', 'Hola {paciente}, recibimos su mensaje y le respondemos hoy mismo.'),
  plantilla('cesp-turno', CESPEDES, 'SCHEDULING', 'Turnos disponibles', 'Hola {paciente}, {doctor} tiene turnos los martes y viernes por la tarde. ¿Cuál le sirve?'),
]).persistirEn('mock.apoyo.plantillas');

/* ---- sembrado ------------------------------------------------------------------ */

function sembrar(c: ConversacionDeSemilla): void {
  const id = conversacionId(c.clave);
  if (conversationList.has(id)) return;
  const paciente = PATIENTS[c.paciente]!;
  const perfilPaciente = showcaseOf(paciente.id)!.id;
  const perfilDoctor = perfilDeChatDe(c.doctor);
  // Cuántos mensajes del paciente quedaron sin respuesta al final del hilo.
  let sinResponder = 0;
  for (const m of [...c.mensajes].reverse()) {
    if (m.de !== 'PACIENTE') break;
    sinResponder += 1;
  }
  const conversacion: SimulatedConversation = {
    id,
    conversationTypeConceptId: CONCEPT.conversationDirect,
    groupId: null,
    participantes: [perfilDoctor, perfilPaciente],
    noLeidosPor: { [perfilDoctor]: sinResponder, [perfilPaciente]: 0 },
  };
  conversationList.agregar(conversacion);
  c.mensajes.forEach((m, i) => {
    const fila: SimulatedMessage = {
      id: uuid(`hp-msg-${c.clave}-${i}`),
      conversationId: id,
      senderProfileId: m.de === 'PACIENTE' ? perfilPaciente : perfilDoctor,
      replyToMessageId: null,
      contentTypeConceptId: CONCEPT.messageText,
      bodyText: m.texto,
      attachmentFileId: null,
      isEdited: false,
      sentAt: hace(m.haceMin),
    };
    messageList.agregar(fila);
    if (m.autora !== undefined) {
      const autoria: FilaAutoria = { id: fila.id, authorUserId: m.autora.userId, onBehalfOfProfileId: c.doctor.practitionerProfileId, disclosureShown: m.autora.muestraAviso };
      autorias.agregar(autoria);
    }
  });
  if (!asignaciones.has(id)) {
    const asignacion: FilaAsignacion = {
      id,
      practitionerProfileId: c.doctor.practitionerProfileId,
      status: c.estado,
      ...(c.asignadaA === undefined ? {} : { assignedUserId: c.asignadaA }),
      ...(c.venceEnMin === undefined ? {} : { slaDueAt: dentroDe(c.venceEnMin) }),
      ...(c.resueltaHaceMin === undefined ? {} : { resolvedAt: hace(c.resueltaHaceMin) }),
    };
    asignaciones.agregar(asignacion);
  }
}

for (const c of CONVERSACIONES_DE_SEMILLA) sembrar(c);

const NOTA_DE_SEMILLA: FilaNota = {
  id: uuid('hp-nota-perez-daniela'),
  conversationId: conversacionId('perez-daniela'),
  authorUserId: IDS.ana.userId,
  bodyText: 'Llamé a caja: el ecocardiograma cuesta Bs 450 y La Vitalicia cubre el 80 %. Falta pasarle el dato.',
  createdAt: hace(60),
};
if (!notasInternas.has(NOTA_DE_SEMILLA.id)) notasInternas.agregar(NOTA_DE_SEMILLA);

/**
 * Deja la **bandeja de chat compartida** como la trae de fábrica: las conversaciones sembradas con sus mensajes (sin lo que se
 * respondió después), quién tiene cada una, las notas, las autorías, los pedidos de acceso clínico, las plantillas y la
 * aceptación de cada doctor, con Mariela incluida.
 *
 * Solo lo usan las pruebas: el corredor no aísla los módulos entre archivos de un mismo worker (`isolate: false`). Estas tablas
 * nacen vacías o con filas de otro módulo y reciben las de la bandeja **al cargar este archivo**, así que `reiniciar()` solo las
 * dejaría sin ellas; por eso se reinician acá y se vuelven a sembrar. También vale después de `reiniciarElGobiernoDeAccesos()`,
 * que vuelve los vínculos y permisos a los del constructor y se lleva los de Mariela. Lo que no es de la bandeja no se toca:
 * los vínculos de las demás personas son del gobierno de accesos.
 */
export function reiniciarLaBandejaDeApoyo(): void {
  for (const tabla of [asignaciones, notasInternas, autorias, accesosClinicos, delegados, plantillas]) {
    tabla.reiniciar();
  }
  const sembradas = new Set(CONVERSACIONES_DE_SEMILLA.map((c) => conversacionId(c.clave)));
  for (const mensaje of messageList.filtrar((m) => sembradas.has(m.conversationId))) messageList.borrar(mensaje.id);
  for (const id of sembradas) conversationList.borrar(id);
  sumarAMariela(true);
  for (const c of CONVERSACIONES_DE_SEMILLA) sembrar(c);
  notasInternas.agregar(NOTA_DE_SEMILLA);
}

/** Los datos de partida de una conversación (el motivo de consulta, por ejemplo). */
export function semillaDe(conversationId: string): ConversacionDeSemilla | undefined {
  return CONVERSACIONES_DE_SEMILLA.find((c) => conversacionId(c.clave) === conversationId);
}

/** La paciente de una conversación: el padrón de la maqueta. */
export function pacienteDeConversacion(conversationId: string): ReturnType<typeof patientById> {
  const semilla = semillaDe(conversationId);
  if (semilla !== undefined) return PATIENTS[semilla.paciente];
  const hilo = conversationList.get(conversationId);
  if (hilo === undefined) return undefined;
  for (const perfil of hilo.participantes) {
    const vitrina = showcaseOf(perfil);
    if (vitrina?.kind === 'PATIENT') return patientById(vitrina.targetId);
  }
  return undefined;
}

/** El permiso de lectura clínica que se pide: un id estable inventado, hasta que la API publique el suyo. */
export const PERMISO_LECTURA_CLINICA = uuid('hp-perm-clinical-read');
