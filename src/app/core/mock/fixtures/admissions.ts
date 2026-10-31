import type {
  AdmissionBlocker,
  AdmissionItemType,
  RequirementsSummary,
  WireCoded,
  WireEvent,
  WireSubmittedForm,
} from '../../data-access/admissions/admissions.types';
import { registerAdmissionFile, type AdmissionFileKind } from './admission-files';
import { conceptById } from './concepts';
import { MEDICAL, PROFESSIONALS } from './people';
import type { ProfesionalSimulado } from './people.types';
import { iso, uuid } from '../mock-store';

/* ============================================================================
    Los datos de las admisiones del simulador: el catálogo de requisitos del
    alta de doctor, una cola sembrada con el padrón simulado y la evaluación
    del checklist.

    Todo sigue el contrato REAL de `/admissions` (requisitos con fichas,
    versión por ficha, huella de evidencia, códigos en español). La evaluación
    del checklist es una copia fiel de la del servidor
    (`admission-checklist.ts`): el simulador tiene que bloquear donde bloquea
    la API.

    Nada de acá promete una consulta a una entidad que no la ofrece: las
    fuentes sembradas son tipos de fuente con un comprobante, nunca una
    dirección web inventada.
    ========================================================================== */

/** Días hábiles para resolver una admisión (SLA) y días para responder un pedido de información. */
export const SLA_DIAS_HABILES = 3;
export const PLAZO_INFORMACION_DIAS = 30;
/** Meses de vigencia de una verificación. */
export const VIGENCIA_MESES = 36;
/** Cuántas veces puede reenviar un médico. */
export const MAX_REENVIOS = 3;

export const TIPO_ALTA: WireCoded = { code: 'ALTA_DE_DOCTOR', label: 'Alta de doctor' };

/** Los estados tal como los publica la API: código en español y su rótulo. */
export const ETIQUETA_DE_ESTADO: Readonly<Record<string, string>> = {
  ENVIADA: 'Enviada',
  EN_REVISION: 'En revisión',
  INFORMACION_REQUERIDA: 'Información requerida',
  VERIFICADA: 'Verificada',
  RECHAZADA: 'Rechazada',
  SUSPENDIDA: 'Suspendida',
  EXPIRADA: 'Expirada',
  RETIRADA: 'Retirada',
  ABANDONADA: 'Abandonada',
};

export const estado = (code: string): WireCoded => ({ code, label: ETIQUETA_DE_ESTADO[code] ?? code });

/** Estados en los que corre el plazo de respuesta (SLA). */
export const ESTADOS_CON_PLAZO = ['ENVIADA', 'EN_REVISION'];

/** Suma días hábiles (sin sábados ni domingos; el feriado no se modela). */
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

export type EstadoFicha = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'INFO_REQUIRED';

/** Quién aparece como revisor o autor de un evento. */
export interface Actor {
  readonly id: string;
  readonly name: string;
}

export interface ArchivoFila {
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly pages: number | null;
  readonly uploadedAt: string;
  readonly kind: AdmissionFileKind;
}

/** Una ficha del checklist, con todo lo que guarda el servidor de su revisión. */
export interface FichaFila {
  /** Id de la revisión: `null` hasta que alguien toma la admisión. */
  reviewId: string | null;
  readonly itemId: string;
  readonly itemType: AdmissionItemType;
  label: string;
  state: EstadoFicha;
  readonly archivo: ArchivoFila | null;
  /** Huella VIVA: cambia si el médico cambia el dato o el archivo. */
  evidenceSha256: string;
  /** La huella que el revisor tenía delante al decidir. */
  reviewedSha256: string | null;
  sourceType: string | null;
  sourceRef: string | null;
  sourceConsultedAt: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  internalNote: string | null;
  reviewedBy: Actor | null;
  reviewedAt: string | null;
  /** Versión de la ficha: el `expectedRowVersion` de su revisión. */
  rowVersion: number | null;
}

export interface RequisitoFila {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
  readonly evidenceKind: 'DOCUMENT' | 'DATA';
  readonly requiresSource: boolean;
  readonly minItems: number | null;
  readonly maxItems: number | null;
  items: FichaFila[];
}

/** La fila guardada: la admisión tal como la sirve la API más lo que sólo el servidor sabe. */
export interface FilaAdmision {
  readonly id: string;
  readonly type: WireCoded;
  status: WireCoded;
  readonly practitioner: {
    readonly id: string;
    readonly fullName: string;
    readonly profession: string | null;
    readonly nationalId: string | null;
    readonly nationalIdIssuer: string | null;
    readonly birthDate: string | null;
    readonly age: number | null;
    readonly occupation: string | null;
    readonly personalMobile: string | null;
    readonly personalEmail: string | null;
    readonly workMobile: string | null;
    readonly workPhone: string | null;
    readonly workEmail: string | null;
  };
  readonly submittedAt: string;
  dueAt: string;
  assignedTo: Actor | null;
  rowVersion: number;
  requisitos: RequisitoFila[];
  events: WireEvent[];
  infoRequestedText: string | null;
  infoDueAt: string | null;
  decisionReasonText: string | null;
  decisionReasonCode: string | null;
  internalNote: string | null;
  validUntil: string | null;
  resubmissionCount: number;
  attestedAt: string | null;
  form: WireSubmittedForm;
  /** Usuario del médico: es quien ve su propia admisión. */
  readonly practitionerUserId: string;
  readonly practitionerProfileId: string;
}

export type Persona = Pick<
  ProfesionalSimulado,
  | 'id' | 'userId' | 'displayName' | 'nationalId' | 'matricula' | 'professionalTitle'
  | 'email' | 'phone' | 'ciudad' | 'especialidades' | 'name' | 'lastName' | 'motherLastName'
  | 'birthDate' | 'lat' | 'lng' | 'direccion' | 'organizacion'
>;

/* ---- catálogo de requisitos ----------------------------------------------------
   Los mismos códigos, rótulos y reglas que el catálogo del servidor para un
   médico (el colegio de odontólogos no aplica). */

interface PlantillaRequisito {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly itemType: AdmissionItemType;
  readonly evidenceKind: 'DOCUMENT' | 'DATA';
  readonly required: boolean;
  readonly requiresSource: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
}

export const CATALOGO_MEDICO: readonly PlantillaRequisito[] = [
  {
    code: 'CI',
    label: 'Cédula de identidad (con terminación del departamento de emisión)',
    description: 'Número de la cédula y su terminación (SC, LP, CB…). Se compara con el documento de identidad del profesional.',
    itemType: 'PROFILE', evidenceKind: 'DATA', required: true, requiresSource: false,
  },
  {
    code: 'MATRICULA_MSALUD',
    label: 'Matrícula del Ministerio de Salud Nacional',
    description: 'Número de matrícula y su respaldo. Verificar contra el registro del Ministerio y declarar la fuente consultada.',
    itemType: 'LICENSE', evidenceKind: 'DOCUMENT', required: true, requiresSource: true, minItems: 1, maxItems: 1,
  },
  {
    code: 'TITULO_UNIVERSITARIO',
    label: 'Título profesional universitario',
    description: 'Hasta dos títulos de carrera diferentes (hay profesionales con dos carreras).',
    itemType: 'CREDENTIAL', evidenceKind: 'DOCUMENT', required: true, requiresSource: true, minItems: 1, maxItems: 2,
  },
  {
    code: 'DIPLOMADO',
    label: 'Título de diplomado',
    description: 'Opcional. Puede cargar varios.',
    itemType: 'CREDENTIAL', evidenceKind: 'DOCUMENT', required: false, requiresSource: true,
  },
  {
    code: 'MAESTRIA',
    label: 'Título de maestría',
    description: 'Opcional. Puede cargar varias.',
    itemType: 'CREDENTIAL', evidenceKind: 'DOCUMENT', required: false, requiresSource: true,
  },
  {
    code: 'DOCTORADO',
    label: 'Título de doctorado',
    description: 'Opcional. Puede cargar varios.',
    itemType: 'CREDENTIAL', evidenceKind: 'DOCUMENT', required: false, requiresSource: true,
  },
  {
    code: 'TITULO_ESPECIALIDAD',
    label: 'Título de especialidad',
    description: 'Opcional. Puede cargar varios.',
    itemType: 'CREDENTIAL', evidenceKind: 'DOCUMENT', required: false, requiresSource: true,
  },
  {
    code: 'REGISTRO_COLEGIO_MEDICO',
    label: 'Registro del Colegio Médico',
    description: 'Aplica a médicos. Número de registro, su fecha y el respaldo emitido por el colegio.',
    itemType: 'LICENSE', evidenceKind: 'DOCUMENT', required: true, requiresSource: true, minItems: 1, maxItems: 1,
  },
  {
    code: 'ESPECIALIDADES_DECLARADAS',
    label: 'Especialidades declaradas',
    description: 'Hasta tres. Se comparan con el título de especialidad que las respalda.',
    itemType: 'SPECIALTY', evidenceKind: 'DATA', required: false, requiresSource: false, maxItems: 3,
  },
  {
    code: 'UBICACION_CONSULTORIOS',
    label: 'Ubicación de los consultorios de atención',
    description: 'Dirección y ubicación GPS de cada consultorio declarado en el alta.',
    itemType: 'PROFILE', evidenceKind: 'DATA', required: false, requiresSource: false,
  },
  {
    code: 'REGISTRO_SEDES',
    label: 'Registro del SEDES',
    description: 'Registro ante el Servicio Departamental de Salud, que la app ya captura al registrarse.',
    itemType: 'LICENSE', evidenceKind: 'DOCUMENT', required: false, requiresSource: true, maxItems: 1,
  },
];

/** La fuente con la que se siembran las fichas verificadas. */
const FUENTE_SEMBRADA: Readonly<Record<string, { type: string; ref: string | null }>> = {
  CI: { type: 'DOCUMENTO_APORTADO', ref: 'Cédula, anverso y reverso' },
  MATRICULA_MSALUD: { type: 'REGISTRO_MINSALUD', ref: 'Comprobante de consulta 4512' },
  TITULO_UNIVERSITARIO: { type: 'DOCUMENTO_APORTADO', ref: 'Título en provisión nacional' },
  DIPLOMADO: { type: 'DOCUMENTO_APORTADO', ref: null },
  TITULO_ESPECIALIDAD: { type: 'COLEGIO_MEDICO', ref: null },
  REGISTRO_COLEGIO_MEDICO: { type: 'COLEGIO_MEDICO', ref: null },
  ESPECIALIDADES_DECLARADAS: { type: 'DOCUMENTO_APORTADO', ref: 'Título de especialidad' },
  UBICACION_CONSULTORIOS: { type: 'OTRO', ref: 'Dirección contrastada con el consultorio' },
  REGISTRO_SEDES: { type: 'SEDES', ref: null },
};

/** Una huella de 64 hex, determinista por contenido. No es un SHA-256 real: es la forma del dato. */
export function huella(...partes: string[]): string {
  const a = uuid(`sha-a-${partes.join('|')}`).replace(/-/g, '');
  const b = uuid(`sha-b-${partes.join('|')}`).replace(/-/g, '');
  return `${a}${b}`.slice(0, 64);
}

export function enmascarar(documento: string): string {
  const limpio = documento.trim();
  if (limpio.length <= 3) return '***';
  return `${'*'.repeat(Math.max(limpio.length - 3, 3))}${limpio.slice(-3)}`;
}

/* ---- evaluación del checklist (copia fiel de la del servidor) -------------------- */

/** La ficha tal como se evalúa: si el médico cambió algo tras la revisión, vuelve a pendiente. */
export function estadoEfectivo(ficha: FichaFila): EstadoFicha {
  return evidenciaCambio(ficha) ? 'PENDING' : ficha.state;
}

export function evidenciaCambio(ficha: FichaFila): boolean {
  return ficha.state !== 'PENDING' && ficha.reviewedSha256 !== null && ficha.reviewedSha256 !== ficha.evidenceSha256;
}

export interface EvaluacionRequisito {
  readonly state: string;
  readonly satisfied: boolean;
  readonly blockedBy: AdmissionBlocker['reason'] | null;
}

export function evaluarRequisito(r: RequisitoFila): EvaluacionRequisito {
  const estados = r.items.map(estadoEfectivo);
  const verificados = estados.filter((s) => s === 'VERIFIED').length;
  const info = estados.filter((s) => s === 'INFO_REQUIRED').length;
  const pendientes = estados.filter((s) => s === 'PENDING').length;
  if (r.items.length === 0) {
    return r.required
      ? { state: 'MISSING', satisfied: false, blockedBy: 'MISSING' }
      : { state: 'NOT_PROVIDED', satisfied: true, blockedBy: null };
  }
  if (info > 0) return { state: 'INFO_REQUIRED', satisfied: false, blockedBy: 'INFO_REQUIRED' };
  if (pendientes > 0) return { state: 'PENDING', satisfied: false, blockedBy: 'PENDING' };
  if (verificados > 0) {
    const debajo = r.required && verificados < (r.minItems ?? 1);
    return { state: 'VERIFIED', satisfied: !debajo, blockedBy: debajo ? 'BELOW_MINIMUM' : null };
  }
  return { state: 'REJECTED', satisfied: !r.required, blockedBy: r.required ? 'REJECTED' : null };
}

export interface EvaluacionChecklist {
  readonly summary: RequirementsSummary;
  readonly blockers: AdmissionBlocker[];
  readonly canVerify: boolean;
}

export function evaluarChecklist(requisitos: readonly RequisitoFila[]): EvaluacionChecklist {
  let total = 0;
  let verified = 0;
  let rejected = 0;
  let pending = 0;
  const blockers: AdmissionBlocker[] = [];
  for (const r of requisitos) {
    const e = evaluarRequisito(r);
    if (e.state !== 'NOT_PROVIDED') {
      total += 1;
      if (e.state === 'VERIFIED' && e.satisfied) verified += 1;
      else if (e.state === 'REJECTED') rejected += 1;
      else pending += 1;
    }
    if (e.blockedBy !== null) blockers.push({ requirementCode: r.code, label: r.label, reason: e.blockedBy });
  }
  return { summary: { total, verified, rejected, pending }, blockers, canVerify: requisitos.length > 0 && blockers.length === 0 };
}

/* ---- fichas ----------------------------------------------------------------------- */

const tipoDeArchivo = (kind: AdmissionFileKind): string => (kind.startsWith('png') ? 'image/png' : 'application/pdf');

interface BorradorFicha {
  readonly clave: string;
  readonly itemType: AdmissionItemType;
  readonly label: string;
  readonly archivo?: { readonly name: string; readonly kind: AdmissionFileKind; readonly paginas?: number | null };
  readonly datos?: readonly string[];
}

function crearFicha(
  admision: string,
  codigo: string,
  b: BorradorFicha,
  p: Pick<Persona, 'userId'>,
  titulo: string,
  subido: string,
  opciones: { nombresLargos?: boolean } = {},
): FichaFila {
  const itemId = uuid(`adm-item-${admision}-${codigo}-${b.clave}`);
  let archivo: ArchivoFila | null = null;
  if (b.archivo !== undefined) {
    const fileId = uuid(`adm-doc-${admision}-${codigo}-${b.clave}`);
    const extension = b.archivo.kind.startsWith('png') ? 'png' : 'pdf';
    const name = opciones.nombresLargos === true
      ? `${codigo.toLowerCase()}-documento-escaneado-con-nombre-extremadamente-largo-para-probar-el-corte-de-lineas-${b.clave}.${extension}`
      : b.archivo.name;
    registerAdmissionFile({ id: fileId, name, kind: b.archivo.kind, ownerUserId: p.userId, title: titulo });
    archivo = {
      fileId,
      name,
      mimeType: tipoDeArchivo(b.archivo.kind),
      sizeBytes: b.archivo.kind === 'png-large' ? 6_000_000 : b.archivo.kind === 'pdf-long' ? 218_400 : b.archivo.kind === 'pdf' ? 18_400 : 412_300,
      pages: b.archivo.paginas ?? (b.archivo.kind === 'pdf-long' ? 42 : b.archivo.kind === 'pdf' ? 1 : null),
      uploadedAt: subido,
      kind: b.archivo.kind,
    };
  }
  return {
    reviewId: null,
    itemId,
    itemType: b.itemType,
    label: b.label,
    state: 'PENDING',
    archivo,
    evidenceSha256: huella(itemId, b.label, archivo?.fileId ?? '', archivo?.name ?? '', ...(b.datos ?? [])),
    reviewedSha256: null,
    sourceType: null,
    sourceRef: null,
    sourceConsultedAt: null,
    reasonCode: null,
    reasonText: null,
    internalNote: null,
    reviewedBy: null,
    reviewedAt: null,
    rowVersion: null,
  };
}

function especialidadesDe(p: Pick<Persona, 'id' | 'especialidades'>): { id: string; name: string }[] {
  return p.especialidades.map((conceptId, i) => ({
    id: uuid(`adm-spec-${p.id}-${i}`),
    name: conceptById(conceptId)?.display ?? 'Especialidad',
  }));
}

/** Las fichas que el médico declaró, por requisito. */
function fichasDe(
  clave: string,
  p: Persona,
  subido: string,
  opciones: { nombresLargos?: boolean; muchosDocumentos?: boolean },
): Map<string, FichaFila[]> {
  const nombre = (codigo: string, b: BorradorFicha): FichaFila =>
    crearFicha(clave, codigo, b, p, b.label, subido, opciones);
  const salida = new Map<string, FichaFila[]>();
  salida.set('CI', [nombre('CI', { clave: 'identidad', itemType: 'PROFILE', label: `Cédula ${p.nationalId || 'sin número'}`, datos: [p.nationalId, p.displayName] })]);
  salida.set('MATRICULA_MSALUD', [
    nombre('MATRICULA_MSALUD', { clave: 'matricula', itemType: 'LICENSE', label: `Matrícula ${p.matricula || 'sin número'}`, archivo: { name: 'matricula-profesional.png', kind: 'png' }, datos: [p.matricula] }),
  ]);
  salida.set('TITULO_UNIVERSITARIO', [
    nombre('TITULO_UNIVERSITARIO', { clave: 'titulo', itemType: 'CREDENTIAL', label: 'Título: Médico cirujano', archivo: { name: 'titulo-provision-nacional.pdf', kind: 'pdf-long' } }),
  ]);
  salida.set('REGISTRO_COLEGIO_MEDICO', [
    nombre('REGISTRO_COLEGIO_MEDICO', { clave: 'colegio', itemType: 'LICENSE', label: 'Registro del Colegio Médico de Bolivia', archivo: { name: 'carnet-colegio.pdf', kind: 'pdf' } }),
  ]);
  const especialidades = especialidadesDe(p);
  if (especialidades.length > 0) {
    salida.set('ESPECIALIDADES_DECLARADAS', especialidades.map((e) => nombre('ESPECIALIDADES_DECLARADAS', { clave: e.id, itemType: 'SPECIALTY', label: `Especialidad: ${e.name}`, datos: [e.name] })));
    salida.set('TITULO_ESPECIALIDAD', [
      nombre('TITULO_ESPECIALIDAD', { clave: 'especialidad', itemType: 'CREDENTIAL', label: `Título de especialidad: ${especialidades[0]!.name}`, archivo: { name: 'certificado-especialidad.pdf', kind: 'pdf' } }),
    ]);
  }
  salida.set('UBICACION_CONSULTORIOS', [
    nombre('UBICACION_CONSULTORIOS', { clave: 'consultorio', itemType: 'PROFILE', label: `Consultorio: ${p.organizacion || 'consultorio propio'}`, datos: [p.direccion, `${p.lat}`, `${p.lng}`] }),
  ]);
  salida.set('REGISTRO_SEDES', [
    nombre('REGISTRO_SEDES', { clave: 'sedes', itemType: 'LICENSE', label: 'Registro del SEDES', archivo: { name: 'registro-sedes.png', kind: 'png' } }),
  ]);
  if (opciones.muchosDocumentos === true) {
    // Un requisito con decenas de respaldos: prueba la galería con un volumen real.
    salida.set(
      'DIPLOMADO',
      Array.from({ length: 58 }, (_, n) => {
        const kind: AdmissionFileKind = n === 0 ? 'png-large' : n % 7 === 0 ? 'pdf-long' : n % 2 === 0 ? 'pdf' : 'png';
        const extension = kind.startsWith('png') ? 'png' : 'pdf';
        return nombre('DIPLOMADO', {
          clave: `d${n}`,
          itemType: 'CREDENTIAL',
          label: `Diplomado ${n + 1}`,
          archivo: { name: n === 0 ? 'grande-escaneo-a-alta-resolucion.png' : `respaldo-adicional-${String(n).padStart(2, '0')}-certificado-de-curso-o-congreso.${extension}`, kind },
        });
      }),
    );
  }
  return salida;
}

/* ---- formulario enviado ------------------------------------------------------------- */

function edadDe(nacimiento: string): number | null {
  const fecha = new Date(nacimiento);
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  if (hoy.getMonth() < fecha.getMonth() || (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad -= 1;
  return edad;
}

export function formularioDe(p: Persona, requisitos: readonly RequisitoFila[], incompleto: boolean): WireSubmittedForm {
  const slug = p.email.split('@')[0] ?? 'medico';
  const ficha = (codigo: string): FichaFila | undefined => requisitos.find((r) => r.code === codigo)?.items[0];
  const gps = Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0 ? { lat: Number(p.lat.toFixed(5)), lng: Number(p.lng.toFixed(5)) } : null;
  const matricula = ficha('MATRICULA_MSALUD');
  const titulo = ficha('TITULO_UNIVERSITARIO');
  const colegio = ficha('REGISTRO_COLEGIO_MEDICO');
  const sedes = ficha('REGISTRO_SEDES');
  const consultorio = ficha('UBICACION_CONSULTORIOS');
  return {
    personal: {
      requirementCode: 'CI',
      firstName: p.name || null,
      middleName: null,
      paternalLastName: p.lastName || null,
      maternalLastName: p.motherLastName || null,
      nationalId: p.nationalId || null,
      nationalIdIssuer: 'SC',
      birthDate: incompleto || !p.birthDate ? null : p.birthDate,
      age: incompleto || !p.birthDate ? null : edadDe(p.birthDate),
      occupation: 'Médico en ejercicio',
    },
    contact: {
      personalMobile: incompleto ? null : p.phone || null,
      personalEmail: p.email || null,
      workMobile: null,
      workPhone: p.phone ? `+591 2 ${p.phone.replace(/\D/g, '').slice(-7)}` : null,
      workEmail: `consultorio.${slug}@alovida.mock`,
    },
    addresses: {
      home: { lines: p.direccion || null, locality: p.ciudad || null, department: 'Santa Cruz', gps },
      work: null,
    },
    licenses: [
      ...(matricula === undefined ? [] : [{ id: matricula.itemId, requirementCode: 'MATRICULA_MSALUD', number: p.matricula || 'MP-0000', jurisdiction: 'Bolivia', authority: 'Ministerio de Salud y Deportes', validFrom: null, validTo: null, fileId: matricula.archivo?.fileId ?? null }]),
      ...(colegio === undefined ? [] : [{ id: colegio.itemId, requirementCode: 'REGISTRO_COLEGIO_MEDICO', number: p.matricula ? `CMB-${p.matricula.replace(/\D/g, '')}` : 'CMB-0000', jurisdiction: 'Colegio Médico de Bolivia', authority: 'Colegio Médico de Bolivia', validFrom: null, validTo: null, fileId: colegio.archivo?.fileId ?? null }]),
      ...(sedes === undefined ? [] : [{ id: sedes.itemId, requirementCode: 'REGISTRO_SEDES', number: 'SEDES-0001', jurisdiction: 'SEDES Santa Cruz', authority: 'SEDES', validFrom: null, validTo: null, fileId: sedes.archivo?.fileId ?? null }]),
    ],
    education: titulo === undefined ? [] : [{ id: titulo.itemId, requirementCode: 'TITULO_UNIVERSITARIO', level: 'Título universitario', title: 'Médico cirujano', institution: 'Universidad Mayor de San Andrés', year: 2012, number: 'TP-2012-0412', fileId: titulo.archivo?.fileId ?? null }],
    specialties: (requisitos.find((r) => r.code === 'ESPECIALIDADES_DECLARADAS')?.items ?? []).map((i, n) => ({
      id: i.itemId,
      requirementCode: 'ESPECIALIDADES_DECLARADAS',
      name: i.label.replace(/^Especialidad: /, ''),
      isPrimary: n === 0,
      supportingCredentialId: null,
    })),
    practices: consultorio === undefined ? [] : [{ id: consultorio.itemId, requirementCode: 'UBICACION_CONSULTORIOS', name: p.organizacion || 'Consultorio propio', address: p.direccion || null, gps }],
  };
}

/* ---- semilla ----------------------------------------------------------------------------- */

export const REVISOR_ADMIN: Actor = { id: uuid('user-admin'), name: 'Marcelo Dávila Arce' };
export const OTRO_REVISOR: Actor = { id: uuid('user-revisor-2'), name: 'Rosario Quispe Flores' };
export const APROBADOR: Actor = { id: uuid('user-aprobador'), name: 'Sandra Mamani Quispe' };

/** Los revisores a los que se puede reasignar: las cuentas con el rol de revisión. */
export const REVISORES: readonly Actor[] = [REVISOR_ADMIN, OTRO_REVISOR];

export interface EstadoDeSemilla {
  readonly status: string;
  /** Estado de cada ficha por código de requisito; lo que no se nombra queda pendiente. */
  readonly fichas: Readonly<Record<string, EstadoFicha>> | 'todas-verificadas';
  readonly asignado: 'admin' | 'otro' | null;
  readonly dias: number;
}

const V: EstadoFicha = 'VERIFIED';
const R: EstadoFicha = 'REJECTED';
const I: EstadoFicha = 'INFO_REQUIRED';

export const SEMILLAS: readonly EstadoDeSemilla[] = [
  { status: 'ENVIADA', fichas: {}, asignado: null, dias: 0 },
  { status: 'ENVIADA', fichas: {}, asignado: null, dias: 1 },
  { status: 'EN_REVISION', fichas: { CI: V, MATRICULA_MSALUD: V, UBICACION_CONSULTORIOS: V }, asignado: 'admin', dias: 2 },
  { status: 'ENVIADA', fichas: {}, asignado: null, dias: 9 },
  { status: 'EN_REVISION', fichas: { CI: V, MATRICULA_MSALUD: V, REGISTRO_COLEGIO_MEDICO: V, TITULO_UNIVERSITARIO: V }, asignado: 'admin', dias: 3 },
  { status: 'EN_REVISION', fichas: { CI: V, MATRICULA_MSALUD: R, UBICACION_CONSULTORIOS: V }, asignado: 'otro', dias: 4 },
  { status: 'INFORMACION_REQUERIDA', fichas: { CI: V, MATRICULA_MSALUD: V, REGISTRO_COLEGIO_MEDICO: I }, asignado: 'otro', dias: 3 },
  { status: 'VERIFICADA', fichas: 'todas-verificadas', asignado: 'otro', dias: 20 },
  { status: 'RECHAZADA', fichas: { CI: V, MATRICULA_MSALUD: R, REGISTRO_COLEGIO_MEDICO: V }, asignado: 'otro', dias: 14 },
  { status: 'SUSPENDIDA', fichas: 'todas-verificadas', asignado: 'otro', dias: 40 },
  { status: 'EXPIRADA', fichas: 'todas-verificadas', asignado: 'otro', dias: 400 },
  { status: 'ABANDONADA', fichas: { CI: V, MATRICULA_MSALUD: V, REGISTRO_COLEGIO_MEDICO: I }, asignado: 'otro', dias: 60 },
  { status: 'ENVIADA', fichas: {}, asignado: null, dias: 2 },
  { status: 'EN_REVISION', fichas: { CI: V, MATRICULA_MSALUD: V, REGISTRO_COLEGIO_MEDICO: V, UBICACION_CONSULTORIOS: V }, asignado: 'admin', dias: 8 },
];

function evento(
  clave: string,
  n: number,
  datos: Partial<WireEvent> & { type: string; occurredAt: string },
  actor: Actor | null,
  rol: string | null,
): WireEvent {
  return {
    id: uuid(`adm-ev-${clave}-${n}`),
    fromStatus: null,
    toStatus: null,
    itemType: null,
    itemId: null,
    requirementCode: null,
    verificationSourceUri: null,
    reasonCode: null,
    reasonText: null,
    actor,
    actorRole: rol,
    ...datos,
  };
}

/** Aplica el estado sembrado a las fichas. */
function sembrarEstados(
  requisitos: readonly RequisitoFila[],
  semilla: EstadoDeSemilla,
  revisor: Actor | null,
  claimed: boolean,
  clave: string,
): void {
  for (const r of requisitos) {
    for (const ficha of r.items) {
      const estadoFicha: EstadoFicha = semilla.fichas === 'todas-verificadas' ? V : (semilla.fichas[r.code] ?? 'PENDING');
      if (claimed) {
        ficha.reviewId = uuid(`adm-review-${clave}-${ficha.itemId}`);
        ficha.rowVersion = 1;
      }
      if (estadoFicha === 'PENDING' || revisor === null) continue;
      ficha.state = estadoFicha;
      ficha.reviewedSha256 = ficha.evidenceSha256;
      ficha.reviewedAt = iso(-1, 10);
      ficha.reviewedBy = revisor;
      ficha.rowVersion = 2;
      if (estadoFicha === V) {
        const fuente = FUENTE_SEMBRADA[r.code];
        ficha.sourceType = fuente?.type ?? 'OTRO';
        ficha.sourceRef = fuente?.ref ?? null;
        ficha.sourceConsultedAt = iso(-1, 10);
      } else {
        ficha.reasonCode = estadoFicha === R ? 'ILEGIBLE' : 'DOCUMENTO_INCOMPLETO';
        ficha.reasonText =
          estadoFicha === R
            ? 'El documento está cortado y no se lee el número. Suba una imagen completa.'
            : 'Falta el reverso o una fecha de emisión legible.';
        ficha.internalNote = estadoFicha === R ? 'Revisar si el escaneo viene de la misma fuente que el título.' : null;
      }
    }
  }
}

export function armarAdmision(
  p: Persona,
  clave: string,
  semilla: EstadoDeSemilla,
  opciones: { nombresLargos?: boolean; muchosDocumentos?: boolean; incompleto?: boolean } = {},
): FilaAdmision {
  const revisor = semilla.asignado === 'admin' ? REVISOR_ADMIN : semilla.asignado === 'otro' ? OTRO_REVISOR : null;
  const enviadaFecha = new Date(iso(-semilla.dias, 9));
  const enviada = enviadaFecha.toISOString();
  const fichas = fichasDe(clave, p, enviada, opciones);
  const requisitos: RequisitoFila[] = CATALOGO_MEDICO.map((t) => ({
    code: t.code,
    label: t.label,
    description: t.description,
    required: t.required,
    evidenceKind: t.evidenceKind,
    requiresSource: t.requiresSource,
    minItems: t.minItems ?? null,
    maxItems: t.maxItems ?? null,
    items: fichas.get(t.code) ?? [],
  }));
  const reclamada = semilla.status !== 'ENVIADA';
  sembrarEstados(requisitos, semilla, revisor, reclamada, clave);

  const conAsignado = ['EN_REVISION', 'INFORMACION_REQUERIDA'].includes(semilla.status);
  const dueAt = sumarDiasHabiles(enviadaFecha, SLA_DIAS_HABILES).toISOString();
  const medico: Actor = { id: p.userId, name: p.displayName };
  const sistema = null;
  const eventos: WireEvent[] = [
    evento(clave, 0, { type: 'CREATED', toStatus: estado('ENVIADA'), occurredAt: enviada }, medico, 'PRACTITIONER'),
  ];
  if (revisor !== null) {
    eventos.push(evento(clave, 1, { type: 'CLAIMED', fromStatus: estado('ENVIADA'), toStatus: estado('EN_REVISION'), occurredAt: iso(-Math.max(semilla.dias - 1, 0), 11) }, revisor, 'ADMISSIONS_REVIEWER'));
  }
  for (const r of requisitos) {
    for (const f of r.items.filter((x) => x.reviewedBy !== null)) {
      eventos.push(
        evento(clave, eventos.length, {
          type: f.state === 'VERIFIED' ? 'ITEM_VERIFIED' : f.state === 'REJECTED' ? 'ITEM_REJECTED' : 'ITEM_INFO_REQUIRED',
          itemType: f.itemType,
          itemId: f.itemId,
          requirementCode: r.code,
          verificationSourceUri: f.sourceRef,
          reasonCode: f.reasonCode,
          reasonText: f.reasonText,
          occurredAt: iso(-Math.max(semilla.dias - 1, 0), 12),
        }, revisor, 'ADMISSIONS_REVIEWER'),
      );
    }
  }
  if (semilla.status === 'INFORMACION_REQUERIDA' || semilla.status === 'ABANDONADA') {
    eventos.push(evento(clave, eventos.length, { type: 'INFO_REQUESTED', fromStatus: estado('EN_REVISION'), toStatus: estado('INFORMACION_REQUERIDA'), reasonCode: 'DOCUMENTO_INCOMPLETO', reasonText: 'Falta el registro del colegio.', occurredAt: iso(-1, 15) }, revisor, 'ADMISSIONS_REVIEWER'));
  }
  if (semilla.status === 'ABANDONADA') {
    eventos.push(evento(clave, eventos.length, { type: 'ABANDONED', fromStatus: estado('INFORMACION_REQUERIDA'), toStatus: estado('ABANDONADA'), occurredAt: iso(-2, 3) }, sistema, 'SYSTEM'));
  }
  if (['VERIFICADA', 'RECHAZADA', 'SUSPENDIDA', 'EXPIRADA'].includes(semilla.status)) {
    const rechazada = semilla.status === 'RECHAZADA';
    eventos.push(evento(clave, eventos.length, { type: rechazada ? 'REJECTED' : 'VERIFIED', fromStatus: estado('EN_REVISION'), toStatus: estado(rechazada ? 'RECHAZADA' : 'VERIFICADA'), occurredAt: iso(-Math.max(semilla.dias - 2, 0), 16) }, APROBADOR, 'ADMISSIONS_APPROVER'));
  }
  if (semilla.status === 'SUSPENDIDA') {
    eventos.push(evento(clave, eventos.length, { type: 'SUSPENDED', fromStatus: estado('VERIFICADA'), toStatus: estado('SUSPENDIDA'), reasonCode: 'OTRO', reasonText: 'Denuncia en trámite ante el colegio.', occurredAt: iso(-2, 9) }, APROBADOR, 'ADMISSIONS_APPROVER'));
  }
  if (semilla.status === 'EXPIRADA') {
    eventos.push(evento(clave, eventos.length, { type: 'EXPIRED', fromStatus: estado('VERIFICADA'), toStatus: estado('EXPIRADA'), occurredAt: iso(-3, 0) }, sistema, 'SYSTEM'));
  }
  const verificada = ['VERIFICADA', 'SUSPENDIDA'].includes(semilla.status);
  return {
    id: uuid(`adm-${clave}`),
    type: TIPO_ALTA,
    status: estado(semilla.status),
    practitioner: {
      id: p.id,
      fullName: p.displayName,
      profession: p.professionalTitle || 'Médico',
      nationalId: p.nationalId || null,
      nationalIdIssuer: 'SC',
      birthDate: opciones.incompleto === true || !p.birthDate ? null : p.birthDate,
      age: opciones.incompleto === true || !p.birthDate ? null : edadDe(p.birthDate),
      occupation: 'Médico en ejercicio',
      personalMobile: opciones.incompleto === true ? null : p.phone || null,
      personalEmail: p.email || null,
      workMobile: null,
      workPhone: null,
      workEmail: null,
    },
    submittedAt: enviada,
    dueAt,
    assignedTo: conAsignado ? revisor : null,
    rowVersion: 1 + eventos.length,
    requisitos,
    events: eventos,
    infoRequestedText: semilla.status === 'INFORMACION_REQUERIDA' ? 'Falta el registro del colegio. Suba el carnet vigente, con la fecha de emisión legible.' : null,
    infoDueAt: semilla.status === 'INFORMACION_REQUERIDA' ? new Date(Date.now() + 27 * 86_400_000).toISOString() : null,
    decisionReasonText:
      semilla.status === 'RECHAZADA'
        ? 'La matrícula no figura en el registro del Ministerio de Salud.'
        : semilla.status === 'SUSPENDIDA'
          ? 'Denuncia en trámite ante el colegio.'
          : null,
    decisionReasonCode: semilla.status === 'RECHAZADA' ? 'NO_FIGURA_EN_REGISTRO' : null,
    internalNote: semilla.status === 'RECHAZADA' ? 'Pedir el original en la próxima cita.' : null,
    validUntil: verificada ? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) : null,
    resubmissionCount: 0,
    attestedAt: enviada,
    form: formularioDe(p, requisitos, opciones.incompleto === true),
    practitionerUserId: p.userId,
    practitionerProfileId: p.id,
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
  salida.push(armarAdmision(MEDICAL, 'medica', { status: 'VERIFICADA', fichas: 'todas-verificadas', asignado: 'otro', dias: 120 }));
  if (nuevo !== undefined) {
    // El médico nuevo: pidieron información; puede corregir y reenviar.
    salida.push(armarAdmision(nuevo, CLAVE_MEDICO_NUEVO, { status: 'INFORMACION_REQUERIDA', fichas: { CI: V, MATRICULA_MSALUD: V, REGISTRO_COLEGIO_MEDICO: I, TITULO_UNIVERSITARIO: V }, asignado: 'otro', dias: 3 }, { incompleto: true }));
  }
  resto.slice(0, 24).forEach((p, i) => {
    const semilla = SEMILLAS[i % SEMILLAS.length]!;
    salida.push(armarAdmision(p, `seed-${i}`, semilla, { nombresLargos: i === 3, muchosDocumentos: i === 12, incompleto: i === 1 }));
  });
  return salida;
}
