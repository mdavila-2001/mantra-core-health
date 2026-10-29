import type {
  AdmissionCoded,
  AdmissionItemType,
  RequirementStatusCode,
  WireAdmissionDetail,
} from '../../data-access/admissions/admissions.types';
import { ADMISSION_STATUS_LABELS } from '../../data-access/admissions/admissions.types';
import { registerAdmissionFile } from './admission-files';
import { conceptById } from './concepts';
import { MEDICAL, PROFESSIONALS } from './people';
import type { ProfesionalSimulado } from './people.types';
import { iso, uuid } from '../mock-store';

/* ============================================================================
    Los datos de las admisiones del simulador: la plantilla de requisitos del
    alta de doctor y una cola sembrada con el padrón simulado.

    Nada de acá promete una consulta a una entidad que no la ofrece: los
    requisitos dicen «se contrasta con la fuente que declare el revisor», y las
    fuentes sembradas son tipos de fuente con un comprobante, nunca una
    dirección web inventada.
    ========================================================================== */

/** Días hábiles para resolver una admisión (SLA) y días para responder un pedido de información. */
export const SLA_DIAS_HABILES = 3;
export const PLAZO_INFORMACION_DIAS = 30;

export const TIPO_ALTA: AdmissionCoded = { code: 'ALTA_DE_DOCTOR', label: 'Alta de doctor' };

export const estado = (code: string): AdmissionCoded => ({
  code,
  label: (ADMISSION_STATUS_LABELS as Record<string, string>)[code] ?? code,
});

/** Suma días hábiles (sin sábados ni domingos; el feriado es una decisión pendiente). */
export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const fecha = new Date(desde);
  let restan = dias;
  while (restan > 0) {
    fecha.setDate(fecha.getDate() + 1);
    const dia = fecha.getDay();
    if (dia !== 0 && dia !== 6) restan -= 1;
  }
  return fecha;
}

export type Requisito = NonNullable<WireAdmissionDetail['requirements']>[number];

/** La fila guardada: el detalle del contrato más lo que sólo el servidor sabe. */
export interface FilaAdmision extends Omit<WireAdmissionDetail, 'overdue'> {
  readonly id: string;
  /** Usuario del médico: es quien ve su propia admisión. */
  readonly practitionerUserId: string;
  readonly practitionerProfileId: string;
  /** Quién tomó la revisión. */
  readonly claimedById: string | null;
  /** Cuántas veces reenvió el médico. */
  readonly resubmissionCount: number;
}

export type Persona = Pick<
  ProfesionalSimulado,
  | 'id' | 'userId' | 'displayName' | 'nationalId' | 'matricula' | 'professionalTitle'
  | 'email' | 'phone' | 'ciudad' | 'especialidades' | 'name' | 'lastName' | 'motherLastName'
  | 'birthDate' | 'lat' | 'lng' | 'direccion' | 'organizacion'
>;

interface PlantillaRequisito {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly mandatory: boolean;
  readonly documents: readonly { name: string; kind: 'png' | 'pdf' | 'pdf-long' | 'png-large' }[];
  readonly itemType?: AdmissionItemType;
}

/** El orden de la plantilla es el de los arreglos de estados de la semilla. */
export const PLANTILLA_ALTA_DE_DOCTOR: readonly PlantillaRequisito[] = [
  {
    code: 'NATIONAL_ID',
    label: 'Cédula de identidad',
    description: 'Anverso y reverso, vigente y legible. Se contrasta con la fuente que declare el revisor.',
    mandatory: true,
    documents: [
      { name: 'cedula-anverso.png', kind: 'png' },
      { name: 'cedula-reverso.png', kind: 'png' },
    ],
  },
  {
    code: 'PROFESSIONAL_LICENSE',
    label: 'Matrícula profesional',
    description: 'Registro profesional del Ministerio de Salud y Deportes.',
    mandatory: true,
    documents: [{ name: 'matricula-profesional.pdf', kind: 'pdf' }],
    itemType: 'LICENSE',
  },
  {
    code: 'COLLEGE_REGISTRATION',
    label: 'Registro del colegio profesional',
    description: 'Carnet vigente del colegio de la profesión. Hoy es opcional: la obligatoriedad la decide el cliente.',
    mandatory: false,
    documents: [{ name: 'carnet-colegio.pdf', kind: 'pdf' }],
  },
  {
    code: 'DEGREE',
    label: 'Título profesional en provisión nacional',
    description: 'Diploma académico y título en provisión nacional.',
    mandatory: true,
    documents: [{ name: 'titulo-provision-nacional.pdf', kind: 'pdf-long' }],
    itemType: 'CREDENTIAL',
  },
  {
    code: 'SPECIALTY_CERTIFICATE',
    label: 'Certificado de especialidad',
    description: 'Solo si declara una especialidad.',
    mandatory: false,
    documents: [{ name: 'certificado-especialidad.pdf', kind: 'pdf' }],
    itemType: 'SPECIALTY',
  },
  {
    code: 'SEDES_REGISTRATION',
    label: 'Registro del SEDES',
    description: 'Registro departamental, si el médico lo tiene.',
    mandatory: false,
    documents: [{ name: 'registro-sedes.pdf', kind: 'pdf' }],
  },
  {
    code: 'PROFILE_PHOTO',
    label: 'Fotografía de perfil',
    description: 'Rostro visible y sin filtros. Se compara con la cédula.',
    mandatory: true,
    documents: [{ name: 'foto-perfil.png', kind: 'png' }],
  },
];

const TIPO_DE_FUENTE: Readonly<Record<string, { code: string; label: string; ref: string | null }>> = {
  NATIONAL_ID: { code: 'PROVIDED_DOCUMENT', label: 'Documento aportado por el médico', ref: 'Cédula, anverso y reverso' },
  PROFESSIONAL_LICENSE: { code: 'MINSALUD_REGISTRY', label: 'Registro del Ministerio de Salud', ref: 'Comprobante de consulta 4512' },
  COLLEGE_REGISTRATION: { code: 'MEDICAL_COLLEGE', label: 'Colegio Médico', ref: null },
  DEGREE: { code: 'PROVIDED_DOCUMENT', label: 'Documento aportado por el médico', ref: 'Título en provisión nacional' },
  SPECIALTY_CERTIFICATE: { code: 'MEDICAL_COLLEGE', label: 'Colegio Médico', ref: null },
  SEDES_REGISTRATION: { code: 'SEDES', label: 'SEDES', ref: null },
  PROFILE_PHOTO: { code: 'PROVIDED_DOCUMENT', label: 'Documento aportado por el médico', ref: 'Comparada con la cédula' },
};

function datosDe(code: string, p: Pick<Persona, 'displayName' | 'matricula' | 'nationalId'>): { label: string; value: string }[] {
  switch (code) {
    case 'NATIONAL_ID':
      return [
        { label: 'Nombre declarado', value: p.displayName },
        { label: 'Documento', value: p.nationalId },
      ];
    case 'PROFESSIONAL_LICENSE':
      return [
        { label: 'Número de matrícula', value: p.matricula || 'Sin número' },
        { label: 'Autoridad', value: 'Ministerio de Salud y Deportes' },
      ];
    case 'COLLEGE_REGISTRATION':
      return [{ label: 'Colegio', value: 'Colegio Médico de Bolivia' }];
    case 'DEGREE':
      return [{ label: 'Institución', value: 'Universidad Mayor de San Andrés' }];
    default:
      return [];
  }
}

const tipoDeArchivo = (kind: string): string => (kind.startsWith('png') ? 'image/png' : 'application/pdf');

export function requisitosDe(
  clave: string,
  p: Pick<Persona, 'userId' | 'displayName' | 'matricula' | 'nationalId'>,
  tieneEspecialidad: boolean,
  estados: readonly RequirementStatusCode[],
  revisor: { id: string; name: string } | null,
  opciones: { nombresLargos?: boolean } = {},
): Requisito[] {
  return PLANTILLA_ALTA_DE_DOCTOR.flatMap((t, indice): Requisito[] => {
    if (t.itemType === 'SPECIALTY' && !tieneEspecialidad) return [];
    const status = estados[indice] ?? 'PENDING';
    const documents = t.documents.map((d, n) => {
      const id = uuid(`adm-doc-${clave}-${t.code}-${n}`);
      const name = opciones.nombresLargos
        ? `${t.code.toLowerCase()}-documento-escaneado-con-nombre-extremadamente-largo-para-probar-el-corte-de-lineas-${n + 1}.${d.kind.startsWith('png') ? 'png' : 'pdf'}`
        : d.name;
      registerAdmissionFile({ id, name, kind: d.kind, ownerUserId: p.userId, title: t.label });
      return {
        fileId: id,
        name,
        mimeType: tipoDeArchivo(d.kind),
        sizeBytes: d.kind === 'pdf-long' ? 218_400 : d.kind === 'pdf' ? 18_400 : 412_300,
      };
    });
    const revisado = status !== 'PENDING';
    const fuente = TIPO_DE_FUENTE[t.code]!;
    return [
      {
        id: uuid(`adm-req-${clave}-${t.code}`),
        code: t.code,
        label: t.label,
        description: t.description,
        mandatory: t.mandatory,
        status,
        documents,
        data: datosDe(t.code, p),
        itemRef: t.itemType === undefined ? null : { type: t.itemType, id: uuid(`adm-item-${clave}-${t.code}`) },
        source:
          status === 'VERIFIED'
            ? { type: { code: fuente.code, label: fuente.label }, ref: fuente.ref, consultedAt: iso(-1, 10) }
            : null,
        reasonCode: status === 'REJECTED' ? 'ILLEGIBLE' : status === 'INFO_REQUIRED' ? 'INCOMPLETE_DOCUMENT' : null,
        reasonText:
          status === 'REJECTED'
            ? 'El documento está cortado y no se lee el número. Suba una imagen completa.'
            : status === 'INFO_REQUIRED'
              ? 'Falta el reverso o una fecha de emisión legible.'
              : null,
        internalNote: status === 'REJECTED' ? 'Revisar si el escaneo viene de la misma fuente que el título.' : null,
        reviewedAt: revisado ? iso(-1, 10) : null,
        reviewedBy: revisado ? revisor : null,
      },
    ];
  });
}

/** Un requisito con decenas de respaldos: prueba la galería con un volumen real. */
export function requisitoConMuchosDocumentos(clave: string, p: Pick<Persona, 'userId'>): Requisito {
  const documents = Array.from({ length: 58 }, (_, n) => {
    const id = uuid(`adm-doc-${clave}-OTHER_EVIDENCE-${n}`);
    const kind = n === 0 ? 'png-large' : n % 7 === 0 ? 'pdf-long' : n % 2 === 0 ? 'pdf' : 'png';
    const ext = kind.startsWith('png') ? 'png' : 'pdf';
    const name = n === 0 ? 'grande-escaneo-a-alta-resolucion.png' : `respaldo-adicional-${String(n).padStart(2, '0')}-certificado-de-curso-o-congreso.${ext}`;
    registerAdmissionFile({ id, name, kind, ownerUserId: p.userId, title: `Respaldo adicional ${n}` });
    return { fileId: id, name, mimeType: tipoDeArchivo(kind), sizeBytes: kind === 'png-large' ? 6_000_000 : 52_000 };
  });
  return {
    id: uuid(`adm-req-${clave}-OTHER_EVIDENCE`),
    code: 'OTHER_EVIDENCE',
    label: 'Otros respaldos',
    description: 'Cursos, congresos y constancias que el médico adjuntó por su cuenta.',
    mandatory: false,
    status: 'PENDING',
    documents,
    data: [],
    itemRef: null,
    source: null,
    reasonCode: null,
    reasonText: null,
    internalNote: null,
    reviewedAt: null,
    reviewedBy: null,
  };
}

export function resumenDe(requisitos: readonly Requisito[]): { total: number; verified: number; rejected: number; pending: number } {
  return {
    total: requisitos.length,
    verified: requisitos.filter((r) => r.status === 'VERIFIED').length,
    rejected: requisitos.filter((r) => r.status === 'REJECTED').length,
    pending: requisitos.filter((r) => r.status === 'PENDING' || r.status === 'INFO_REQUIRED').length,
  };
}

export function documentosDeRequisitos(requisitos: readonly Requisito[], subido: string): NonNullable<WireAdmissionDetail['documents']> {
  return requisitos.flatMap((r) =>
    r.documents.map((d) => ({
      id: `${r.id}:${d.fileId}`,
      requirementCode: r.code,
      fileId: d.fileId,
      name: d.name,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: subido,
      pages: d.name.startsWith('titulo') ? 42 : d.mimeType === 'application/pdf' ? 1 : null,
      reviewState: r.status,
    })),
  );
}

/* ---- formulario enviado ------------------------------------------------------ */

function edadDe(nacimiento: string): string {
  const fecha = new Date(nacimiento);
  if (Number.isNaN(fecha.getTime())) return nacimiento;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad -= 1;
  const dia = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  return `${dia} (${edad} años)`;
}

type CampoForm = NonNullable<WireAdmissionDetail['submittedForm']>[number]['fields'][number];

export function formularioDe(p: Persona, especialidades: readonly { name: string }[], incompleto: boolean): NonNullable<WireAdmissionDetail['submittedForm']> {
  const campo = (key: string, label: string, value: string | null | undefined, required: boolean, requirementCode: string | null = null, kind: CampoForm['kind'] = 'TEXT'): CampoForm => ({
    key, label, value: value === undefined || value === '' ? null : value, required, requirementCode, kind,
  });
  const slug = p.email.split('@')[0] ?? 'medico';
  return [
    {
      key: 'personal', title: 'Datos personales',
      fields: [
        campo('name', 'Nombres', p.name, true, 'NATIONAL_ID'),
        campo('lastName', 'Apellido paterno', p.lastName, true, 'NATIONAL_ID'),
        campo('motherLastName', 'Apellido materno', p.motherLastName, false, 'NATIONAL_ID'),
        campo('nationalId', 'Documento de identidad', p.nationalId, true, 'NATIONAL_ID'),
        campo('birthDate', 'Fecha de nacimiento', incompleto || !p.birthDate ? null : edadDe(p.birthDate), true, 'NATIONAL_ID'),
      ],
    },
    {
      key: 'occupation', title: 'Ocupación y profesión',
      fields: [
        campo('profession', 'Profesión', p.professionalTitle || 'Médico', true, 'DEGREE'),
        campo('occupation', 'Ocupación', 'Médico en ejercicio', false),
      ],
    },
    {
      key: 'contact', title: 'Contacto',
      fields: [
        campo('personalEmail', 'Correo personal', p.email, true),
        campo('mobilePhone', 'Celular personal', incompleto ? null : p.phone, true),
        campo('workEmail', 'Correo del trabajo', `consultorio.${slug}@alovida.mock`, false),
        campo('workPhone', 'Teléfono del trabajo', p.phone ? `+591 2 ${p.phone.replace(/\D/g, '').slice(-7)}` : null, false),
      ],
    },
    {
      key: 'home', title: 'Domicilio y ubicación',
      fields: [
        campo('address', 'Dirección', p.direccion, true),
        campo('city', 'Ciudad', p.ciudad, true),
        campo('gps', 'Ubicación GPS', Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0 ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : null, false, null, 'COORDINATES'),
      ],
    },
    {
      key: 'licenses', title: 'Habilitación profesional',
      fields: [
        campo('licenseNumber', 'Matrícula del Ministerio de Salud', p.matricula, true, 'PROFESSIONAL_LICENSE'),
        campo('licenseAuthority', 'Autoridad emisora', 'Ministerio de Salud y Deportes', false, 'PROFESSIONAL_LICENSE'),
        campo('collegeName', 'Colegio profesional', 'Colegio Médico de Bolivia', false, 'COLLEGE_REGISTRATION'),
        campo('collegeNumber', 'Registro del colegio', p.matricula ? `CMB-${p.matricula.replace(/\D/g, '')}` : null, false, 'COLLEGE_REGISTRATION'),
      ],
    },
    {
      key: 'education', title: 'Títulos y estudios',
      fields: [
        campo('degreeTitle', 'Título', 'Médico cirujano', true, 'DEGREE'),
        campo('degreeInstitution', 'Institución', 'Universidad Mayor de San Andrés', true, 'DEGREE'),
        campo('degreeYear', 'Año de titulación', '2012', false, 'DEGREE'),
      ],
    },
    {
      key: 'specialties', title: 'Especialidades',
      fields: especialidades.length === 0
        ? [campo('specialty-none', 'Especialidad', null, false, 'SPECIALTY_CERTIFICATE')]
        : especialidades.map((e, i) => campo(`specialty-${i}`, 'Especialidad', e.name, false, 'SPECIALTY_CERTIFICATE')),
    },
    {
      key: 'sites', title: 'Consultorios y ubicaciones',
      fields: [
        campo('organization', 'Organización', p.organizacion, false),
        campo('siteAddress', 'Dirección del consultorio', p.direccion, false),
      ],
    },
    {
      key: 'signature', title: 'Firma y sello',
      fields: [campo('signatureSeal', 'Firma y sello para recetas', 'Imágenes cargadas en el registro', false)],
    },
  ];
}

/* ---- semilla ------------------------------------------------------------------ */

export const REVISOR_ADMIN = { id: uuid('user-admin'), name: 'Marcelo Dávila Arce' };
export const OTRO_REVISOR = { id: uuid('user-revisor-2'), name: 'Rosario Quispe Flores' };
export const APROBADOR = { id: uuid('user-aprobador'), name: 'Sandra Mamani Quispe' };

export interface EstadoDeSemilla {
  readonly status: string;
  readonly requisitos: readonly RequirementStatusCode[];
  readonly asignado: 'admin' | 'otro' | null;
  readonly dias: number;
}

const V = 'VERIFIED';
const R = 'REJECTED';
const P = 'PENDING';
const I = 'INFO_REQUIRED';

/** Orden de los requisitos: cédula, matrícula, colegio, título, especialidad, SEDES, foto. */
export const SEMILLAS: readonly EstadoDeSemilla[] = [
  { status: 'SUBMITTED', requisitos: [P, P, P, P, P, P, P], asignado: null, dias: 0 },
  { status: 'SUBMITTED', requisitos: [P, P, P, P, P, P, P], asignado: null, dias: 1 },
  { status: 'IN_REVIEW', requisitos: [V, V, P, P, P, P, V], asignado: 'admin', dias: 2 },
  { status: 'SUBMITTED', requisitos: [P, P, P, P, P, P, P], asignado: null, dias: 9 },
  { status: 'IN_REVIEW', requisitos: [V, V, V, V, P, P, V], asignado: 'admin', dias: 3 },
  { status: 'IN_REVIEW', requisitos: [V, R, P, P, P, P, V], asignado: 'otro', dias: 4 },
  { status: 'INFO_REQUESTED', requisitos: [V, V, I, P, P, P, V], asignado: 'otro', dias: 3 },
  { status: 'VERIFIED', requisitos: [V, V, V, V, V, V, V], asignado: 'otro', dias: 20 },
  { status: 'REJECTED', requisitos: [V, R, V, P, P, P, V], asignado: 'otro', dias: 14 },
  { status: 'SUSPENDED', requisitos: [V, V, V, V, V, V, V], asignado: 'otro', dias: 40 },
  { status: 'EXPIRED', requisitos: [V, V, V, V, V, V, V], asignado: 'otro', dias: 400 },
  { status: 'ABANDONED', requisitos: [V, V, I, P, P, P, V], asignado: 'otro', dias: 60 },
  { status: 'SUBMITTED', requisitos: [P, P, P, P, P, P, P], asignado: null, dias: 2 },
  { status: 'IN_REVIEW', requisitos: [V, V, V, P, P, P, V], asignado: 'admin', dias: 8 },
];

function especialidadesDe(p: Pick<Persona, 'id' | 'especialidades'>): { id: string; name: string; state: string; supportingCredentialId: string | null }[] {
  return p.especialidades.map((conceptId, i) => ({
    id: uuid(`adm-spec-${p.id}-${i}`),
    name: conceptById(conceptId)?.display ?? 'Especialidad',
    state: 'PENDING',
    supportingCredentialId: null,
  }));
}

type Evento = WireAdmissionDetail['events'][number];

function evento(clave: string, n: number, datos: Partial<Evento> & { type: string; occurredAt: string }, actor: { id: string; name: string }): Evento {
  return {
    id: uuid(`adm-ev-${clave}-${n}`),
    fromStatus: null, toStatus: null, itemType: null, itemId: null, sourceLabel: null,
    reasonCode: null, reasonText: null, internalNote: null,
    actor,
    ...datos,
  };
}

export function enmascarar(documento: string): string {
  const limpio = documento.trim();
  if (limpio.length <= 3) return '***';
  return `${'*'.repeat(Math.max(limpio.length - 3, 3))}${limpio.slice(-3)}`;
}

export function armarAdmision(
  p: Persona,
  clave: string,
  semilla: EstadoDeSemilla,
  opciones: { nombresLargos?: boolean; muchosDocumentos?: boolean; incompleto?: boolean } = {},
): FilaAdmision {
  const revisor = semilla.asignado === 'admin' ? REVISOR_ADMIN : semilla.asignado === 'otro' ? OTRO_REVISOR : null;
  const especialidades = especialidadesDe(p);
  const requisitos = requisitosDe(clave, p, especialidades.length > 0, semilla.requisitos, revisor, opciones);
  if (opciones.muchosDocumentos === true) requisitos.push(requisitoConMuchosDocumentos(clave, p));
  const enviadaFecha = new Date(iso(-semilla.dias, 9));
  const enviada = enviadaFecha.toISOString();
  const abierta = ['SUBMITTED', 'IN_REVIEW'].includes(semilla.status);
  const conAsignado = ['IN_REVIEW', 'INFO_REQUESTED'].includes(semilla.status);
  const dueAt = abierta ? sumarDiasHabiles(enviadaFecha, SLA_DIAS_HABILES).toISOString() : null;
  const actor = { id: p.userId, name: p.displayName };
  const eventos = [evento(clave, 0, { type: 'SUBMITTED', toStatus: 'SUBMITTED', occurredAt: enviada }, actor)];
  if (revisor !== null) {
    eventos.push(evento(clave, 1, { type: 'CLAIMED', fromStatus: 'SUBMITTED', toStatus: 'IN_REVIEW', occurredAt: iso(-Math.max(semilla.dias - 1, 0), 11) }, revisor));
  }
  for (const r of requisitos.filter((q) => q.reviewedBy !== null)) {
    eventos.push(
      evento(clave, eventos.length, {
        type: r.status === 'VERIFIED' ? 'ITEM_VERIFIED' : r.status === 'REJECTED' ? 'ITEM_REJECTED' : 'ITEM_INFO_REQUIRED',
        itemType: 'REQUIREMENT', itemId: r.id, sourceLabel: r.source?.type.label ?? null,
        reasonCode: r.reasonCode, reasonText: r.reasonText, internalNote: r.internalNote,
        occurredAt: iso(-Math.max(semilla.dias - 1, 0), 12),
      }, revisor!),
    );
  }
  if (semilla.status === 'INFO_REQUESTED' || semilla.status === 'ABANDONED') {
    eventos.push(evento(clave, eventos.length, { type: 'INFO_REQUESTED', fromStatus: 'IN_REVIEW', toStatus: 'INFO_REQUESTED', reasonCode: 'INCOMPLETE_DOCUMENT', reasonText: 'Falta el registro del colegio.', occurredAt: iso(-1, 15) }, revisor!));
  }
  if (semilla.status === 'ABANDONED') {
    eventos.push(evento(clave, eventos.length, { type: 'ABANDONED', fromStatus: 'INFO_REQUESTED', toStatus: 'ABANDONED', occurredAt: iso(-2, 3) }, { id: 'system', name: 'Sistema' }));
  }
  if (['VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED'].includes(semilla.status)) {
    const rechazada = semilla.status === 'REJECTED';
    eventos.push(evento(clave, eventos.length, { type: rechazada ? 'REJECTED' : 'VERIFIED', fromStatus: 'IN_REVIEW', toStatus: rechazada ? 'REJECTED' : 'VERIFIED', occurredAt: iso(-Math.max(semilla.dias - 2, 0), 16) }, APROBADOR));
  }
  if (semilla.status === 'SUSPENDED') {
    eventos.push(evento(clave, eventos.length, { type: 'SUSPENDED', fromStatus: 'VERIFIED', toStatus: 'SUSPENDED', reasonCode: 'OTHER', reasonText: 'Denuncia en trámite ante el colegio.', occurredAt: iso(-2, 9) }, APROBADOR));
  }
  if (semilla.status === 'EXPIRED') {
    eventos.push(evento(clave, eventos.length, { type: 'EXPIRED', fromStatus: 'VERIFIED', toStatus: 'EXPIRED', occurredAt: iso(-3, 0) }, { id: 'system', name: 'Sistema' }));
  }
  const requisito = (code: string): Requisito | undefined => requisitos.find((r) => r.code === code);
  return {
    id: uuid(`adm-${clave}`),
    type: TIPO_ALTA,
    status: estado(semilla.status),
    practitioner: {
      id: p.id,
      fullName: p.displayName,
      profession: p.professionalTitle || 'Médico',
      maskedNationalId: enmascarar(p.nationalId),
      nationalId: p.nationalId || null,
      email: p.email,
      phone: p.phone || null,
      city: p.ciudad || null,
      registeredAt: enviada,
    },
    itemsSummary: { licenses: 1, credentials: 1, specialties: especialidades.length },
    requirementsSummary: resumenDe(requisitos),
    submittedAt: enviada,
    dueAt,
    assignedTo: conAsignado ? revisor : null,
    rowVersion: 1 + eventos.length,
    licenses: [{ id: uuid(`adm-item-${clave}-PROFESSIONAL_LICENSE`), number: p.matricula || 'MP-0000', jurisdiction: 'Bolivia', state: requisito('PROFESSIONAL_LICENSE')?.status ?? 'PENDING', fileId: requisito('PROFESSIONAL_LICENSE')?.documents[0]?.fileId ?? null, verifiedAt: null, rejectionReasonText: null }],
    credentials: [{ id: uuid(`adm-item-${clave}-DEGREE`), title: 'Título de médico cirujano', institution: 'Universidad Mayor de San Andrés', state: requisito('DEGREE')?.status ?? 'PENDING', fileId: requisito('DEGREE')?.documents[0]?.fileId ?? null, verifiedAt: null, rejectionReasonText: null }],
    specialties: especialidades,
    requirements: requisitos,
    documents: documentosDeRequisitos(requisitos, enviada),
    submittedForm: formularioDe(p, especialidades, opciones.incompleto === true),
    events: eventos,
    infoRequestedText: semilla.status === 'INFO_REQUESTED' ? 'Falta el registro del colegio. Suba el carnet vigente, con la fecha de emisión legible.' : null,
    infoDueAt: semilla.status === 'INFO_REQUESTED' ? new Date(Date.now() + 27 * 86_400_000).toISOString() : null,
    decisionReasonText:
      semilla.status === 'REJECTED'
        ? 'La matrícula no figura en el registro del Ministerio de Salud.'
        : semilla.status === 'SUSPENDED'
          ? 'Denuncia en trámite ante el colegio.'
          : null,
    practitionerUserId: p.userId,
    practitionerProfileId: p.id,
    claimedById: conAsignado ? (revisor?.id ?? null) : null,
    resubmissionCount: 0,
  };
}

/** El profesional «Ramiro Céspedes»: recién titulado, entra con su propia cuenta. */
export const CLAVE_MEDICO_NUEVO = 'sinespecialidad';

export function sembrarAdmisiones(): FilaAdmision[] {
  const padron = PROFESSIONALS.filter(
    (p) => p.nationalId !== '' && p.id !== MEDICAL.id && (p.origen === undefined || p.origen === 'USUARIO_PROPIETARIO'),
  );
  const nuevo = padron.find((p) => p.id === uuid(`hpid-${CLAVE_MEDICO_NUEVO}`));
  const resto = padron.filter((p) => p !== nuevo);
  const salida: FilaAdmision[] = [];
  // La médica con la que se entra: ya verificada.
  salida.push(armarAdmision(MEDICAL, 'medica', { status: 'VERIFIED', requisitos: [V, V, V, V, V, V, V], asignado: 'otro', dias: 120 }));
  if (nuevo !== undefined) {
    // El médico nuevo: pidieron información; puede corregir y reenviar.
    salida.push(armarAdmision(nuevo, CLAVE_MEDICO_NUEVO, { status: 'INFO_REQUESTED', requisitos: [V, V, I, V, P, P, V], asignado: 'otro', dias: 3 }, { incompleto: true }));
  }
  resto.slice(0, 24).forEach((p, i) => {
    const semilla = SEMILLAS[i % SEMILLAS.length]!;
    salida.push(armarAdmision(p, `seed-${i}`, semilla, { nombresLargos: i === 3, muchosDocumentos: i === 3, incompleto: i === 1 }));
  });
  return salida;
}
