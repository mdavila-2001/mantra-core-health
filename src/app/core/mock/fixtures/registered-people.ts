import { DEPARTAMENTO, ESPECIALIDAD, MUNICIPIO, OCUPACION } from './conceptos';
import type { PacienteSimulado, ProfesionalSimulado } from './personas';
import {
  REGISTERED_PATIENTS,
  REGISTERED_PRACTITIONERS,
  type RegisteredPerson,
} from './registered-people.generated';
import { uuid } from '../mock-store';

/* ============================================================================
    Las personas de las planillas de usuarios del propietario, con la forma de
    un profesional o un paciente del simulador.

    Entran **todas** las filas que tienen una persona: 13 médicos y 92
    pacientes. Lo que no entra es lo que no se puede publicar en un repositorio
    público —cédula, fecha de nacimiento, celular, correo y domicilio—, y
    viaja vacío: las pantallas ya saben mostrar un paciente sin esos datos (es
    lo que hace el alta de mostrador).

    Como los médicos de la red de las aseguradoras, van sin agenda, puntuación,
    diplomas ni trayectoria inventados. Sí llevan lo que la planilla declara:
    su matrícula del Ministerio de Salud y su registro en el SEDES.
    ========================================================================== */

function titulo(texto: string | null | undefined): string {
  const minusculas = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
  return (texto ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '')
    .map((w, i) => (i > 0 && minusculas.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function nombreCompleto(p: RegisteredPerson): string {
  return [p.givenName, p.middleName, p.surname, p.motherSurname].map(titulo).filter((x) => x !== '').join(' ');
}

function slugDe(p: RegisteredPerson, prefijo: string): string {
  const base = `${p.givenName ?? ''}-${p.surname ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${prefijo}${p.sourceRow}`;
}

/* ---- médicos --------------------------------------------------------------- */

/** La especialidad que escribe la planilla → código del catálogo. */
const ESPECIALIDAD_DE_LA_PLANILLA: Readonly<Record<string, string>> = {
  ESTETICA: 'ESTETICA_DENTAL',
  ENDODONCIA: 'ENDODONCIA',
  'ORTODONCIA Y ORTOPEDIA': 'ORTODONCIA',
  'ORTOPEDIA Y TRAUMATOLOGIA': 'TRAUMATOLOGIA',
};

/** Profesión → título visible. */
const TITULO_DE_PROFESION: Readonly<Record<string, string>> = {
  'CIRUJANO ODONTOLOGO': 'Cirujano odontólogo',
  'MEDICO CIRUJANO': 'Médico cirujano',
};

function especialidadesDe(p: RegisteredPerson): readonly string[] {
  if (p.specialty !== null && p.specialty !== undefined) {
    const codigo = ESPECIALIDAD_DE_LA_PLANILLA[p.specialty];
    if (codigo === undefined) {
      throw new Error(`Especialidad de USUARIO_MEDICOS sin mapear: «${p.specialty}».`);
    }
    return [ESPECIALIDAD[codigo]!];
  }
  // Un cirujano odontólogo sin especialidad declarada ejerce odontología, que
  // es su profesión. Un médico cirujano sin especialidad queda sin ninguna:
  // «Medicina general» sería una especialidad que la planilla no dice.
  return p.occupation === 'CIRUJANO ODONTOLOGO' ? [ESPECIALIDAD['ODONTOLOGIA']!] : [];
}

function profesionalRegistrado(p: RegisteredPerson): ProfesionalSimulado {
  const clave = `usuario-medico-${p.sourceRow}`;
  const slug = slugDe(p, 'um');
  const especialidad = p.specialty === null || p.specialty === undefined ? null : titulo(p.specialty);
  const profesion = TITULO_DE_PROFESION[p.occupation ?? ''] ?? titulo(p.occupation);
  return {
    id: uuid(`hpid-${clave}`),
    personId: uuid(`person-${clave}`),
    userId: uuid(`user-${clave}`),
    practitionerCode: `USR-${String(p.sourceRow).padStart(4, '0')}`,
    displayName: nombreCompleto(p),
    name: [p.givenName, p.middleName].map(titulo).filter((x) => x !== '').join(' '),
    lastName: titulo(p.surname),
    motherLastName: titulo(p.motherSurname),
    professionalTitle: especialidad === null ? profesion : `${profesion} · ${especialidad}`,
    professionalBio: `${profesion} registrado en el padrón de usuarios de AloVida.`,
    slug,
    email: `${slug}@usuarios.alovida.mock`,
    phone: '',
    especialidades: especialidadesDe(p),
    ciudad: 'Santa Cruz de la Sierra',
    municipioId: MUNICIPIO['SC-SCZ']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:SC']!,
    tenantId: uuid(`tenant-${clave}`),
    // La planilla no dice dónde atiende: no se inventa un consultorio.
    organizacion: 'Usuario de AloVida',
    verified: false,
    acceptsNewPatients: true,
    telehealthAvailable: false,
    ratingAverage: 0,
    ratingCount: 0,
    photoFileId: uuid(`photo-${clave}`),
    matricula: p.healthMinistryLicense ?? '',
    birthDate: '',
    nationalId: '',
    // Sin domicilio publicable, el punto es el centro de la ciudad.
    lat: -17.7834,
    lng: -63.1821,
    direccion: '',
    origen: 'USUARIO_PROPIETARIO',
    registros: {
      matriculaMinisterio: p.healthMinistryLicense ?? null,
      fechaMatriculaMinisterio: p.healthMinistryLicenseDate ?? null,
      registroColegioOdontologos: p.dentalCollegeRegistration ?? null,
      registroSedes: p.sedesRegistration ?? null,
      fechaRegistroSedes: p.sedesRegistrationDate ?? null,
    },
  };
}

export function profesionalesRegistrados(): readonly ProfesionalSimulado[] {
  return REGISTERED_PRACTITIONERS.map(profesionalRegistrado);
}

/* ---- pacientes ------------------------------------------------------------- */

/**
 * Ocupación de la planilla → código del catálogo. Sólo las equivalencias
 * directas; lo demás es «Otra ocupación» con el texto tal cual, que es para lo
 * que existe `occupationFreeText` en el alta.
 */
const OCUPACION_DE_LA_PLANILLA: Readonly<Record<string, string>> = {
  ESTUDIANTE: 'occupation:bo:ESTUDIANTE',
  COMERCIANTE: 'occupation:bo:COMERCIANTE',
  'INGENIERIA COMERCIAL': 'occupation:bo:INGENIERO',
  'INGENIERIA INDUSTRIAL': 'occupation:bo:INGENIERO',
  'INGENIERO DE SISTEMAS': 'occupation:bo:INGENIERO',
  ODONTOLOGO: 'occupation:bo:ODONTOLOGO',
  'ADMINISTRACION DE EMPRESAS': 'occupation:bo:ADMINISTRADOR',
  ARQUITECTO: 'occupation:bo:ARQUITECTO',
  CONTADORA: 'occupation:bo:CONTADOR',
  AGRICULTOR: 'occupation:bo:AGRICULTOR',
  MECANICO: 'occupation:bo:MECANICO',
  'SECRETARIA EJECUTIVA': 'occupation:bo:SECRETARIO',
  PSICOLOGA: 'occupation:bo:PSICOLOGO',
  'TRABAJADORA DEL HOGAR': 'occupation:bo:EMPLEADA_HOGAR',
  CHEF: 'occupation:bo:COCINERO',
  'GUARDIA MUNICIPAL': 'occupation:bo:SEGURIDAD',
  'AMA DE CASA': 'occupation:bo:LABORES_CASA',
};

const MUNICIPIO_DE_LA_PLANILLA: Readonly<Record<string, string>> = {
  'SANTA CRUZ DE LA SIERRA': 'SC-SCZ',
  WARNES: 'SC-WAR',
};

function pacienteRegistrado(p: RegisteredPerson): PacienteSimulado {
  const clave = `usuario-paciente-${p.sourceRow}`;
  const ocupacion = p.occupation ?? null;
  const codigo = ocupacion === null ? undefined : (OCUPACION_DE_LA_PLANILLA[ocupacion] ?? 'occupation:bo:OTRA');
  const municipio = p.municipality === null || p.municipality === undefined ? undefined : MUNICIPIO_DE_LA_PLANILLA[p.municipality];
  if (p.municipality && municipio === undefined) {
    throw new Error(`Municipio de USUARIO_PACIENTES sin mapear: «${p.municipality}».`);
  }
  return {
    id: uuid(`pid-${clave}`),
    personId: uuid(`person-${clave}`),
    userId: uuid(`user-${clave}`),
    patientCode: `PAC-U${String(p.sourceRow).padStart(4, '0')}`,
    displayName: nombreCompleto(p),
    name: titulo(p.givenName),
    ...(p.middleName ? { middleName: titulo(p.middleName) } : {}),
    lastName: titulo(p.surname),
    motherLastName: titulo(p.motherSurname),
    // Fecha de nacimiento, cédula, correo, celular y domicilio: no se publican.
    birthDate: '',
    nationalId: '',
    email: '',
    phone: '',
    municipioId: municipio === undefined ? '' : MUNICIPIO[municipio]!,
    departamentoId: p.department ? DEPARTAMENTO['geo:bo:department:SC']! : '',
    ocupacionId: codigo === undefined ? '' : OCUPACION[codigo]!,
    ...(codigo === 'occupation:bo:OTRA' && ocupacion !== null ? { ocupacionTexto: titulo(ocupacion) } : {}),
    direccion: '',
    deceased: false,
    identityVerified: false,
    origen: 'USUARIO_PROPIETARIO',
  };
}

export function pacientesRegistrados(): readonly PacienteSimulado[] {
  return REGISTERED_PATIENTS.map(pacienteRegistrado);
}
