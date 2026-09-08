import {
  CATEGORIA_PROFESIONAL,
  DEPARTAMENTO,
  ESPECIALIDAD,
  ESTADO,
  GENERO,
  IDIOMA,
  JURISDICCION,
  MUNICIPIO,
  OCUPACION,
  PARENTESCO,
  SEXO,
  TIPO_CREDENCIAL,
  TIPO_VINCULO,
} from './conceptos';
import * as fk from '../faker';
import { IDS, TENANT_CLINICA, TENANT_HOSPITAL } from '../mock-session';
import { Coleccion, iso, isoDia, uuid } from '../mock-store';

/* ============================================================================
    Las personas del backend simulado: profesionales y pacientes.

    La médica (`medica@alovida.mock`) y la paciente (`paciente@alovida.mock`)
    son las dos cuentas con las que se entra; el resto puebla la guía, la
    agenda, el expediente y la red social.
    ========================================================================== */

export interface ProfesionalSimulado {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly practitionerCode: string;
  readonly displayName: string;
  readonly name: string;
  readonly lastName: string;
  readonly motherLastName: string;
  readonly professionalTitle: string;
  readonly professionalBio: string;
  readonly slug: string;
  readonly email: string;
  readonly phone: string;
  readonly especialidades: readonly string[];
  readonly ciudad: string;
  readonly municipioId: string;
  readonly departamentoId: string;
  readonly tenantId: string;
  readonly organizacion: string;
  readonly verified: boolean;
  readonly acceptsNewPatients: boolean;
  readonly telehealthAvailable: boolean;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly photoFileId: string;
  readonly matricula: string;
  readonly birthDate: string;
  readonly nationalId: string;
  readonly lat: number;
  readonly lng: number;
  readonly direccion: string;
}

export interface PacienteSimulado {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly patientCode: string;
  readonly displayName: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName: string;
  readonly birthDate: string;
  readonly sexAtBirth: 'MALE' | 'FEMALE';
  readonly generoId: string;
  readonly sexoId: string;
  readonly nationalId: string;
  readonly email: string;
  readonly phone: string;
  readonly municipioId: string;
  readonly departamentoId: string;
  readonly ocupacionId: string;
  readonly direccion: string;
  readonly deceased: boolean;
  readonly identityVerified: boolean;
  readonly photoFileId?: string;
  readonly aseguradora?: string;
  readonly plan?: string;
}

const CIUDADES = [
  { ciudad: 'Santa Cruz de la Sierra', municipio: MUNICIPIO['SC-SCZ']!, departamento: DEPARTAMENTO['geo:bo:department:SC']!, lat: -17.7833, lng: -63.1821 },
  { ciudad: 'La Paz', municipio: MUNICIPIO['LP-LPZ']!, departamento: DEPARTAMENTO['geo:bo:department:LP']!, lat: -16.4897, lng: -68.1193 },
  { ciudad: 'Cochabamba', municipio: MUNICIPIO['CB-CBB']!, departamento: DEPARTAMENTO['geo:bo:department:CB']!, lat: -17.3895, lng: -66.1568 },
];

function profesional(
  clave: string,
  datos: {
    nombre: string;
    apellidos: [string, string];
    titulo: string;
    especialidades: readonly string[];
    bio: string;
    ciudad?: number;
    org?: 'clinica' | 'hospital';
    rating?: number;
    nuevos?: boolean;
    tele?: boolean;
    verified?: boolean;
    ids?: { id: string; personId: string; userId: string };
    nacimiento?: string;
  },
  indice: number,
): ProfesionalSimulado {
  const lugar = CIUDADES[datos.ciudad ?? 0]!;
  const displayName = `${datos.nombre} ${datos.apellidos[0]} ${datos.apellidos[1]}`;
  const slug = `${datos.nombre.split(' ')[0]}-${datos.apellidos[0]}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return {
    id: datos.ids?.id ?? uuid(`hpid-${clave}`),
    personId: datos.ids?.personId ?? uuid(`person-${clave}`),
    userId: datos.ids?.userId ?? uuid(`user-${clave}`),
    practitionerCode: `MED-${1000 + indice}`,
    displayName,
    name: datos.nombre,
    lastName: datos.apellidos[0],
    motherLastName: datos.apellidos[1],
    professionalTitle: datos.titulo,
    professionalBio: datos.bio,
    slug,
    email: `${slug}@alovida.mock`,
    phone: `+591 7${String(1000000 + indice * 7919).slice(0, 7)}`,
    especialidades: datos.especialidades,
    ciudad: lugar.ciudad,
    municipioId: lugar.municipio,
    departamentoId: lugar.departamento,
    tenantId: datos.org === 'hospital' ? TENANT_HOSPITAL : TENANT_CLINICA,
    organizacion: datos.org === 'hospital' ? 'Hospital San Lucas' : 'Clínica Los Olivos',
    verified: datos.verified ?? true,
    acceptsNewPatients: datos.nuevos ?? true,
    telehealthAvailable: datos.tele ?? indice % 2 === 0,
    ratingAverage: datos.rating ?? 4.2 + (indice % 4) * 0.2,
    ratingCount: 8 + indice * 5,
    photoFileId: uuid(`photo-${clave}`),
    matricula: `MP-${2400 + indice}`,
    birthDate: datos.nacimiento ?? `19${70 + (indice % 20)}-0${1 + (indice % 9)}-1${indice % 9}`,
    nationalId: String(3000000 + indice * 12345),
    lat: lugar.lat + (indice % 5) * 0.004 - 0.008,
    lng: lugar.lng + (indice % 7) * 0.003 - 0.009,
    direccion: `Av. ${['Banzer', 'San Martín', 'Alemana', 'Cristo Redentor', 'Busch'][indice % 5]} N.º ${120 + indice * 31}`,
  };
}

/* ---- los profesionales escritos a mano ------------------------------------
   Éstos no se generan y no se van a generar nunca: son los que la aplicación
   nombra por su identificador o por su slug —la médica con la que se entra,
   los autores de las publicaciones de la portada, los dueños de las agendas
   que las pruebas abren por URL—. El generador añade volumen **detrás** de
   ellos, sin tocar sus índices: `PROFESIONALES[6]` y `.slice(1, 5)` siguen
   siendo la misma gente en `agenda.ts` y en `clinica.ts`. */

const PROFESIONALES_ESCRITOS: readonly ProfesionalSimulado[] = [
  profesional(
    'medica',
    {
      nombre: 'Valeria',
      apellidos: ['Rojas', 'Mendoza'],
      titulo: 'Cardióloga',
      especialidades: [ESPECIALIDAD['SP-CARDIO']!, ESPECIALIDAD['SP-MEDINT']!],
      bio: 'Cardióloga clínica con 14 años de experiencia. Formada en la UMSA y el Instituto Nacional de Cardiología de México. Atiendo hipertensión, insuficiencia cardíaca y prevención cardiovascular, con especial interés en la salud cardíaca de la mujer.',
      rating: 4.9,
      tele: true,
      ids: { id: IDS.medica.practitionerProfileId, personId: IDS.medica.personId, userId: IDS.medica.userId },
      nacimiento: '1982-04-17',
    },
    0,
  ),
  profesional('pediatra', { nombre: 'Jorge Andrés', apellidos: ['Salazar', 'Vaca'], titulo: 'Pediatra', especialidades: [ESPECIALIDAD['SP-PEDIA']!], bio: 'Pediatra y neonatólogo. Control del niño sano, vacunación y seguimiento del desarrollo.', rating: 4.8 }, 1),
  profesional('ginecologa', { nombre: 'María Fernanda', apellidos: ['Quiroga', 'Añez'], titulo: 'Ginecóloga obstetra', especialidades: [ESPECIALIDAD['SP-GINE']!], bio: 'Control prenatal, planificación familiar y salud de la mujer en todas las etapas.', org: 'hospital', rating: 4.7 }, 2),
  profesional('dermatologo', { nombre: 'Rodrigo', apellidos: ['Paz', 'Soruco'], titulo: 'Dermatólogo', especialidades: [ESPECIALIDAD['SP-DERMA']!], bio: 'Dermatología clínica y estética. Acné, dermatitis, lunares y cáncer de piel.', ciudad: 1, rating: 4.5 }, 3),
  profesional('traumatologo', { nombre: 'Luis Alberto', apellidos: ['Camacho', 'Justiniano'], titulo: 'Traumatólogo', especialidades: [ESPECIALIDAD['SP-TRAUMA']!], bio: 'Cirugía de rodilla y hombro, artroscopia y lesiones deportivas.', org: 'hospital', rating: 4.6 }, 4),
  profesional('neurologa', { nombre: 'Carla', apellidos: ['Montero', 'Ribera'], titulo: 'Neuróloga', especialidades: [ESPECIALIDAD['SP-NEURO']!], bio: 'Cefaleas, epilepsia y enfermedades neurodegenerativas.', ciudad: 2, rating: 4.4, tele: true }, 5),
  profesional('psiquiatra', { nombre: 'Daniel', apellidos: ['Aguilar', 'Roca'], titulo: 'Psiquiatra', especialidades: [ESPECIALIDAD['SP-PSIQ']!], bio: 'Ansiedad, depresión y salud mental del adulto. Atención presencial y por videollamada.', rating: 4.9, tele: true }, 6),
  profesional('oftalmologa', { nombre: 'Patricia', apellidos: ['Vargas', 'Salinas'], titulo: 'Oftalmóloga', especialidades: [ESPECIALIDAD['SP-OFTAL']!], bio: 'Cirugía de cataratas, glaucoma y control de la vista.', ciudad: 1, rating: 4.3 }, 7),
  profesional('odontologo', { nombre: 'Marco Antonio', apellidos: ['Suárez', 'Landívar'], titulo: 'Odontólogo', especialidades: [ESPECIALIDAD['SP-ODONTO']!], bio: 'Odontología general, ortodoncia y estética dental.', rating: 4.6, nuevos: true }, 8),
  profesional('endocrinologa', { nombre: 'Ana Belén', apellidos: ['Terrazas', 'Moreno'], titulo: 'Endocrinóloga', especialidades: [ESPECIALIDAD['SP-ENDO']!, ESPECIALIDAD['SP-MEDINT']!], bio: 'Diabetes, tiroides y obesidad. Enfoque integral con nutrición.', ciudad: 2, rating: 4.7, tele: true }, 9),
  profesional('gastro', { nombre: 'Fernando', apellidos: ['Gutiérrez', 'Peña'], titulo: 'Gastroenterólogo', especialidades: [ESPECIALIDAD['SP-GASTRO']!], bio: 'Endoscopia digestiva, reflujo y enfermedad inflamatoria intestinal.', org: 'hospital', rating: 4.5 }, 10),
  profesional('medgeneral', { nombre: 'Sofía', apellidos: ['Arce', 'Chávez'], titulo: 'Médica general', especialidades: [ESPECIALIDAD['SP-MEDGEN']!], bio: 'Medicina familiar. Primer contacto para toda la familia.', rating: 4.8, tele: true, nuevos: true }, 11),
  profesional('nutricionista', { nombre: 'Gabriela', apellidos: ['Rivera', 'Ortiz'], titulo: 'Nutricionista', especialidades: [ESPECIALIDAD['SP-NUTRI']!], bio: 'Planes de alimentación para diabetes, hipertensión y deporte.', rating: 4.9, tele: true }, 12),
  profesional('neumologo', { nombre: 'Hugo', apellidos: ['Flores', 'Zambrana'], titulo: 'Neumólogo', especialidades: [ESPECIALIDAD['SP-NEUMO']!], bio: 'Asma, EPOC y apnea del sueño.', ciudad: 1, org: 'hospital', rating: 4.2 }, 13),
  profesional('sinespecialidad', { nombre: 'Ramiro', apellidos: ['Céspedes', 'Villca'], titulo: 'Médico', especialidades: [], bio: 'Médico recién titulado, en proceso de registro de especialidad.', rating: 0, verified: false, nuevos: false }, 14),
];

/* ---- y los generados ------------------------------------------------------
   El resto del padrón. Sin ellos la guía de profesionales tenía quince fichas
   —menos que una página— y ni la paginación, ni el buscador, ni los filtros
   por especialidad o por ciudad se podían probar con nada: todo entraba en la
   primera pantalla. Cada uno se siembra con su propio índice (ver
   `faker/semilla.ts`), así que el profesional 37 es el mismo en cada recarga y
   su ficha pública se puede enlazar. */

/** Cómo se llama cada especialidad, en femenino y en masculino. */
const TITULOS: Readonly<Record<string, readonly [string, string]>> = {
  'SP-CARDIO': ['Cardióloga', 'Cardiólogo'],
  'SP-PEDIA': ['Pediatra', 'Pediatra'],
  'SP-GINE': ['Ginecóloga obstetra', 'Ginecólogo obstetra'],
  'SP-DERMA': ['Dermatóloga', 'Dermatólogo'],
  'SP-TRAUMA': ['Traumatóloga', 'Traumatólogo'],
  'SP-MEDINT': ['Internista', 'Internista'],
  'SP-NEURO': ['Neuróloga', 'Neurólogo'],
  'SP-PSIQ': ['Psiquiatra', 'Psiquiatra'],
  'SP-OFTAL': ['Oftalmóloga', 'Oftalmólogo'],
  'SP-ODONTO': ['Odontóloga', 'Odontólogo'],
  'SP-ENDO': ['Endocrinóloga', 'Endocrinólogo'],
  'SP-GASTRO': ['Gastroenteróloga', 'Gastroenterólogo'],
  'SP-NEUMO': ['Neumóloga', 'Neumólogo'],
  'SP-UROL': ['Uróloga', 'Urólogo'],
  'SP-MEDGEN': ['Médica general', 'Médico general'],
  'SP-NUTRI': ['Nutricionista', 'Nutricionista'],
  'SP-FISIO': ['Fisioterapeuta', 'Fisioterapeuta'],
  'SP-ANEST': ['Anestesióloga', 'Anestesiólogo'],
};

const CODIGOS_ESPECIALIDAD = Object.keys(TITULOS);

function profesionalGenerado(indice: number): ProfesionalSimulado {
  const f = fk.conSemilla(`profesional-${indice}`);
  const mujer = f.datatype.boolean(0.55);
  const nombre = f.person.firstName(mujer ? 'female' : 'male');
  const apellidos: [string, string] = [fk.apellido(f), fk.apellido(f)];
  const codigo = f.helpers.arrayElement(CODIGOS_ESPECIALIDAD);
  const segunda = f.datatype.boolean(0.35) ? f.helpers.arrayElement(CODIGOS_ESPECIALIDAD) : null;
  const titulo = TITULOS[codigo]![mujer ? 0 : 1];
  const lugarDeTrabajo = fk.lugar(f);
  const punto = fk.coordenada(f, lugarDeTrabajo);
  const anios = f.number.int({ min: 3, max: 32 });
  const slug = fk.slugDeNombre(nombre, apellidos[0]);
  const clave = `gen-med-${indice}`;
  const hospital = f.datatype.boolean(0.4);

  return {
    id: uuid(`hpid-${clave}`),
    personId: uuid(`person-${clave}`),
    userId: uuid(`user-${clave}`),
    practitionerCode: `MED-${1000 + indice}`,
    displayName: `${nombre} ${apellidos[0]} ${apellidos[1]}`,
    name: nombre,
    lastName: apellidos[0],
    motherLastName: apellidos[1],
    professionalTitle: titulo,
    professionalBio: fk.biografia(f, titulo, anios),
    // El índice desempata: dos «Ana Rojas» generadas tendrían el mismo slug y
    // la segunda ficha pública taparía a la primera.
    slug: `${slug}-${indice}`,
    email: `${slug}${indice}@alovida.mock`,
    phone: fk.celular(f),
    especialidades: [
      ESPECIALIDAD[codigo]!,
      ...(segunda === null || segunda === codigo ? [] : [ESPECIALIDAD[segunda]!]),
    ],
    ciudad: lugarDeTrabajo.ciudad,
    municipioId: lugarDeTrabajo.municipioId,
    departamentoId: lugarDeTrabajo.departamentoId,
    tenantId: hospital ? TENANT_HOSPITAL : TENANT_CLINICA,
    organizacion: hospital ? 'Hospital San Lucas' : 'Clínica Los Olivos',
    verified: f.datatype.boolean(0.85),
    acceptsNewPatients: f.datatype.boolean(0.75),
    telehealthAvailable: f.datatype.boolean(0.5),
    ratingAverage: f.number.float({ min: 3.6, max: 5, fractionDigits: 1 }),
    ratingCount: f.number.int({ min: 3, max: 240 }),
    photoFileId: uuid(`photo-${clave}`),
    matricula: fk.matricula(f),
    birthDate: f.date.birthdate({ min: 28 + anios - 3, max: 30 + anios + 8, mode: 'age' }).toISOString().slice(0, 10),
    nationalId: fk.cedulaSimple(f),
    lat: punto.lat,
    lng: punto.lng,
    direccion: fk.direccion(f, lugarDeTrabajo),
  };
}

export const PROFESIONALES: readonly ProfesionalSimulado[] = [
  ...PROFESIONALES_ESCRITOS,
  ...Array.from({ length: 45 }, (_, i) => profesionalGenerado(PROFESIONALES_ESCRITOS.length + i)),
];

export const MEDICA = PROFESIONALES[0]!;

export function profesionalPorId(id: string): ProfesionalSimulado | undefined {
  return PROFESIONALES.find((p) => p.id === id || p.userId === id || p.personId === id);
}

export function profesionalPorSlug(slug: string): ProfesionalSimulado | undefined {
  return PROFESIONALES.find((p) => p.slug === slug);
}

/* ---- pacientes ------------------------------------------------------------ */

function paciente(
  clave: string,
  datos: {
    nombre: string;
    segundo?: string;
    apellidos: [string, string];
    nacimiento: string;
    sexo: 'MALE' | 'FEMALE';
    ciudad?: number;
    ocupacion: string;
    aseguradora?: string;
    plan?: string;
    verificado?: boolean;
    fallecido?: boolean;
    ids?: { userId: string; personId: string; patientProfileId: string };
  },
  indice: number,
): PacienteSimulado {
  const lugar = CIUDADES[datos.ciudad ?? 0]!;
  const displayName = `${datos.nombre}${datos.segundo ? ` ${datos.segundo}` : ''} ${datos.apellidos[0]} ${datos.apellidos[1]}`;
  const slug = `${datos.nombre}-${datos.apellidos[0]}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return {
    id: datos.ids?.patientProfileId ?? uuid(`pid-${clave}`),
    personId: datos.ids?.personId ?? uuid(`person-${clave}`),
    userId: datos.ids?.userId ?? uuid(`user-${clave}`),
    patientCode: `PAC-${20000 + indice}`,
    displayName,
    name: datos.nombre,
    ...(datos.segundo === undefined ? {} : { middleName: datos.segundo }),
    lastName: datos.apellidos[0],
    motherLastName: datos.apellidos[1],
    birthDate: datos.nacimiento,
    sexAtBirth: datos.sexo,
    generoId: datos.sexo === 'FEMALE' ? GENERO['GEN-F']! : GENERO['GEN-M']!,
    sexoId: datos.sexo === 'FEMALE' ? SEXO['SEX-F']! : SEXO['SEX-M']!,
    nationalId: String(5000000 + indice * 9871),
    email: `${slug}@correo.mock`,
    phone: `+591 6${String(2000000 + indice * 5431).slice(0, 7)}`,
    municipioId: lugar.municipio,
    departamentoId: lugar.departamento,
    ocupacionId: OCUPACION[datos.ocupacion] ?? OCUPACION['OCC-OTRA']!,
    direccion: `Calle ${['Libertad', 'Sucre', 'Ayacucho', 'Junín', 'Bolívar', 'Warnes'][indice % 6]} N.º ${45 + indice * 17}, ${lugar.ciudad}`,
    deceased: datos.fallecido ?? false,
    identityVerified: datos.verificado ?? true,
    ...(indice % 3 === 0 ? { photoFileId: uuid(`photo-${clave}`) } : {}),
    ...(datos.aseguradora === undefined ? {} : { aseguradora: datos.aseguradora, plan: datos.plan ?? 'Plan Familiar' }),
  };
}

const PACIENTES_ESCRITOS: readonly PacienteSimulado[] = [
  paciente('paciente', { nombre: 'Ana', segundo: 'Lucía', apellidos: ['Pérez', 'Quiroga'], nacimiento: '1990-06-21', sexo: 'FEMALE', ocupacion: 'OCC-CONTADOR', aseguradora: 'Seguros Andina', plan: 'Plan Integral', ids: IDS.paciente }, 0),
  paciente('p-mamani', { nombre: 'Jorge', segundo: 'Luis', apellidos: ['Mamani', 'Choque'], nacimiento: '1958-11-03', sexo: 'MALE', ocupacion: 'OCC-JUBILADO', ciudad: 1 }, 1),
  paciente('p-flores', { nombre: 'Daniela', apellidos: ['Flores', 'Cuéllar'], nacimiento: '1985-02-14', sexo: 'FEMALE', ocupacion: 'OCC-DOCENTE', aseguradora: 'La Vitalicia' }, 2),
  paciente('p-rocha', { nombre: 'Martín', apellidos: ['Rocha', 'Antelo'], nacimiento: '2015-09-30', sexo: 'MALE', ocupacion: 'OCC-ESTUDIANTE' }, 3),
  paciente('p-guzman', { nombre: 'Elena', segundo: 'María', apellidos: ['Guzmán', 'Arauz'], nacimiento: '1972-07-08', sexo: 'FEMALE', ocupacion: 'OCC-COMERCIANTE', ciudad: 2 }, 4),
  paciente('p-torrez', { nombre: 'Pablo', apellidos: ['Torrez', 'Nina'], nacimiento: '1995-12-25', sexo: 'MALE', ocupacion: 'OCC-INGENIERO', aseguradora: 'Seguros Andina' }, 5),
  paciente('p-vaca', { nombre: 'Lucía', apellidos: ['Vaca', 'Díez'], nacimiento: '2001-03-19', sexo: 'FEMALE', ocupacion: 'OCC-ESTUDIANTE', verificado: false }, 6),
  paciente('p-condori', { nombre: 'Ricardo', apellidos: ['Condori', 'Apaza'], nacimiento: '1949-01-10', sexo: 'MALE', ocupacion: 'OCC-AGRICULTOR', ciudad: 1 }, 7),
  paciente('p-medina', { nombre: 'Valentina', apellidos: ['Medina', 'Roca'], nacimiento: '1988-08-02', sexo: 'FEMALE', ocupacion: 'OCC-ABOGADO', aseguradora: 'Alianza Seguros', plan: 'Plan Oro' }, 8),
  paciente('p-soliz', { nombre: 'Andrés', apellidos: ['Solíz', 'Rojas'], nacimiento: '1979-05-27', sexo: 'MALE', ocupacion: 'OCC-CHOFER' }, 9),
  paciente('p-quispe', { nombre: 'Marta', apellidos: ['Quispe', 'Huanca'], nacimiento: '1966-10-15', sexo: 'FEMALE', ocupacion: 'OCC-HOGAR', ciudad: 2 }, 10),
  paciente('p-rivero', { nombre: 'Sebastián', apellidos: ['Rivero', 'Melgar'], nacimiento: '2010-04-04', sexo: 'MALE', ocupacion: 'OCC-ESTUDIANTE' }, 11),
  paciente('p-paredes', { nombre: 'Carmen', apellidos: ['Paredes', 'Ibáñez'], nacimiento: '1938-02-28', sexo: 'FEMALE', ocupacion: 'OCC-JUBILADO', fallecido: true }, 12),
];

/* ---- y los generados ------------------------------------------------------
   Con trece pacientes no hay padrón que buscar: cabían enteros en la primera
   página y el buscador por nombre o por documento devolvía siempre lo mismo.
   Ciento veinte sí obligan a paginar, filtrar y ordenar, que es donde
   aparecen los fallos. Las edades se reparten a propósito —lactantes, niños,
   adultos y mayores— porque las pantallas clínicas pintan rangos por edad y
   con una sola franja no se ve si están bien. */

const OCUPACIONES_POR_EDAD: Readonly<Record<string, readonly string[]>> = {
  nino: ['OCC-ESTUDIANTE'],
  joven: ['OCC-ESTUDIANTE', 'OCC-COMERCIANTE', 'OCC-CHOFER', 'OCC-ENFERMERIA', 'OCC-OTRA'],
  adulto: [
    'OCC-DOCENTE',
    'OCC-COMERCIANTE',
    'OCC-INGENIERO',
    'OCC-ABOGADO',
    'OCC-CONTADOR',
    'OCC-AGRICULTOR',
    'OCC-CHOFER',
    'OCC-ENFERMERIA',
    'OCC-ADMINISTRATIVO',
    'OCC-HOGAR',
  ],
  mayor: ['OCC-JUBILADO', 'OCC-HOGAR', 'OCC-AGRICULTOR', 'OCC-COMERCIANTE'],
};

function pacienteGenerado(indice: number): PacienteSimulado {
  const f = fk.conSemilla(`paciente-${indice}`);
  const mujer = f.datatype.boolean(0.52);
  const nombre = f.person.firstName(mujer ? 'female' : 'male');
  const segundo = f.datatype.boolean(0.4) ? f.person.firstName(mujer ? 'female' : 'male') : undefined;
  const apellidos: [string, string] = [fk.apellido(f), fk.apellido(f)];
  // Reparto de edades: 12 % lactantes y niños, 22 % jóvenes, 46 % adultos,
  // 20 % mayores. Aproxima una sala de espera de verdad.
  const dado = f.number.int({ min: 1, max: 100 });
  const edad =
    dado <= 12
      ? f.number.int({ min: 0, max: 11 })
      : dado <= 34
        ? f.number.int({ min: 12, max: 29 })
        : dado <= 80
          ? f.number.int({ min: 30, max: 64 })
          : f.number.int({ min: 65, max: 93 });
  const tramo = edad < 12 ? 'nino' : edad < 30 ? 'joven' : edad < 65 ? 'adulto' : 'mayor';
  const lugarDeVida = fk.lugar(f);
  const slug = fk.slugDeNombre(nombre, apellidos[0]);
  const clave = `gen-pac-${indice}`;
  const conSeguro = f.datatype.boolean(0.45);

  return {
    id: uuid(`pid-${clave}`),
    personId: uuid(`person-${clave}`),
    userId: uuid(`user-${clave}`),
    patientCode: `PAC-${20000 + indice}`,
    displayName: `${nombre}${segundo === undefined ? '' : ` ${segundo}`} ${apellidos[0]} ${apellidos[1]}`,
    name: nombre,
    ...(segundo === undefined ? {} : { middleName: segundo }),
    lastName: apellidos[0],
    motherLastName: apellidos[1],
    birthDate: f.date.birthdate({ min: edad, max: edad, mode: 'age' }).toISOString().slice(0, 10),
    sexAtBirth: mujer ? 'FEMALE' : 'MALE',
    generoId: mujer ? GENERO['GEN-F']! : GENERO['GEN-M']!,
    sexoId: mujer ? SEXO['SEX-F']! : SEXO['SEX-M']!,
    nationalId: fk.cedulaSimple(f),
    email: `${slug}${indice}@correo.mock`,
    phone: fk.celular(f),
    municipioId: lugarDeVida.municipioId,
    departamentoId: lugarDeVida.departamentoId,
    ocupacionId: OCUPACION[f.helpers.arrayElement(OCUPACIONES_POR_EDAD[tramo]!)] ?? OCUPACION['OCC-OTRA']!,
    direccion: `${fk.direccion(f, lugarDeVida)}, ${lugarDeVida.ciudad}`,
    // Un padrón sin ningún fallecido no deja probar la marca de fallecimiento,
    // que cambia media pantalla de expediente. Uno de cada cincuenta, y sólo
    // entre los mayores.
    deceased: tramo === 'mayor' && f.datatype.boolean(0.1),
    identityVerified: f.datatype.boolean(0.8),
    ...(f.datatype.boolean(0.35) ? { photoFileId: uuid(`photo-${clave}`) } : {}),
    ...(conSeguro
      ? {
          aseguradora: f.helpers.arrayElement(fk.ASEGURADORAS),
          plan: f.helpers.arrayElement(fk.PLANES),
        }
      : {}),
  };
}

export const PACIENTES: readonly PacienteSimulado[] = [
  ...PACIENTES_ESCRITOS,
  ...Array.from({ length: 107 }, (_, i) => pacienteGenerado(PACIENTES_ESCRITOS.length + i)),
];

export const PACIENTE = PACIENTES[0]!;

export const pacientes = new Coleccion<PacienteSimulado>(PACIENTES);

export function pacientePorId(id: string): PacienteSimulado | undefined {
  return pacientes.todos().find((p) => p.id === id || p.userId === id || p.personId === id);
}

/* ---- lo que cuelga de cada profesional ----------------------------------- */

export function especialidadesDe(p: ProfesionalSimulado) {
  return p.especialidades.map((specialtyConceptId, i) => ({
    id: uuid(`spec-${p.id}-${i}`),
    specialtyConceptId,
    isPrimary: i === 0,
    boardCertified: i === 0,
    practiceScopeText: i === 0 ? 'Consulta y procedimientos ambulatorios' : 'Consulta',
    verificationStatusConceptId: p.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-PENDING']!,
    verified: p.verified,
    validFrom: isoDia(-365 * 5),
  }));
}

export function credencialesDe(p: ProfesionalSimulado) {
  return [
    {
      id: uuid(`cred-titulo-${p.id}`),
      credentialTypeConceptId: TIPO_CREDENCIAL['CRED-TITULO']!,
      number: `TIT-${p.practitionerCode.slice(4)}`,
      issuingInstitutionText: 'Universidad Mayor de San Andrés',
      issueDate: isoDia(-365 * 12),
      stateConceptId: ESTADO['ST-VERIFIED']!,
      verifiedAt: iso(-200),
      verificationSourceUri: 'https://sedes.gob.bo/verificacion',
    },
    ...(p.especialidades.length === 0
      ? []
      : [
          {
            id: uuid(`cred-esp-${p.id}`),
            credentialTypeConceptId: TIPO_CREDENCIAL['CRED-ESPECIALIDAD']!,
            number: `ESP-${p.practitionerCode.slice(4)}`,
            issuingInstitutionText: 'Colegio Médico de Bolivia',
            issueDate: isoDia(-365 * 7),
            stateConceptId: p.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-PENDING']!,
            ...(p.verified ? { verifiedAt: iso(-180) } : {}),
          },
        ]),
    {
      id: uuid(`cred-sedes-${p.id}`),
      credentialTypeConceptId: TIPO_CREDENCIAL['CRED-SEDES']!,
      number: `SEDES-${p.matricula}`,
      issuingInstitutionText: 'SEDES Santa Cruz',
      issueDate: isoDia(-365 * 6),
      expiryDate: isoDia(365 * 2),
      stateConceptId: ESTADO['ST-ACTIVE']!,
    },
  ];
}

export function licenciasDe(p: ProfesionalSimulado) {
  return [
    {
      id: uuid(`lic-${p.id}`),
      jurisdictionConceptId: JURISDICCION['JUR-BO']!,
      licenseNumber: p.matricula,
      regulatoryAuthority: 'Ministerio de Salud y Deportes',
      stateConceptId: ESTADO['ST-ACTIVE']!,
      validFrom: isoDia(-365 * 10),
    },
  ];
}

export function idiomasDe(p: ProfesionalSimulado) {
  return [
    { languageConceptId: IDIOMA['LANG-ES']!, proficiencyConceptId: undefined, clinicalInterpretationAllowed: true },
    ...(p.telehealthAvailable
      ? [{ languageConceptId: IDIOMA['LANG-EN']!, proficiencyConceptId: undefined, clinicalInterpretationAllowed: false }]
      : []),
  ].map(({ proficiencyConceptId: _omitido, ...resto }) => resto);
}

export interface AfiliacionSimulada {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly organizationName: string;
  readonly roleTitle: string | null;
  readonly practiceSiteId: string | null;
  readonly affiliationTypeConceptId: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly current: boolean;
  readonly status: string;
  readonly statusKind: 'pendiente' | 'declarado' | 'aprobado' | 'rechazado' | 'revocado' | 'desconocido';
  readonly decisionReasonText: string | null;
  readonly createdAt: string;
}

export function afiliacionesIniciales(): AfiliacionSimulada[] {
  return PROFESIONALES.flatMap((p, i) => [
    {
      id: uuid(`aff-actual-${p.id}`),
      practitionerProfileId: p.id,
      organizationName: p.organizacion,
      roleTitle: i % 3 === 0 ? 'Jefa de servicio' : 'Médico/a de planta',
      practiceSiteId: null,
      affiliationTypeConceptId: TIPO_VINCULO['AFF-PLANTA']!,
      startDate: isoDia(-365 * 3 - i * 30),
      endDate: null,
      current: true,
      status: 'APPROVED',
      statusKind: 'aprobado',
      decisionReasonText: null,
      createdAt: iso(-300 - i),
    },
    {
      id: uuid(`aff-previa-${p.id}`),
      practitionerProfileId: p.id,
      organizationName: i % 2 === 0 ? 'Hospital Japonés' : 'Clínica Foianini',
      roleTitle: 'Residente',
      practiceSiteId: null,
      affiliationTypeConceptId: TIPO_VINCULO['AFF-HONORARIO']!,
      startDate: isoDia(-365 * 8 - i * 30),
      endDate: isoDia(-365 * 3 - i * 30 - 1),
      current: false,
      status: 'DECLARED',
      statusKind: 'declarado',
      decisionReasonText: null,
      createdAt: iso(-300 - i),
    },
    {
      id: uuid(`aff-propio-${p.id}`),
      practitionerProfileId: p.id,
      organizationName: `Consultorio ${p.lastName}`,
      roleTitle: null,
      practiceSiteId: null,
      affiliationTypeConceptId: TIPO_VINCULO['AFF-CONSULTORIO']!,
      startDate: isoDia(-365 - i * 10),
      endDate: null,
      current: true,
      status: 'DECLARED',
      statusKind: 'declarado',
      decisionReasonText: null,
      createdAt: iso(-100 - i),
    },
  ]);
}

export const afiliaciones = new Coleccion<AfiliacionSimulada>(afiliacionesIniciales());

/** Familiares y contactos de cada paciente. */
export function personasRelacionadasDe(p: PacienteSimulado) {
  const base = [
    { id: uuid(`rel-1-${p.id}`), displayName: `${['Rosa', 'Juan', 'Marta', 'Carlos'][p.patientCode.charCodeAt(6) % 4]} ${p.lastName}`, relationshipConceptId: PARENTESCO[p.sexAtBirth === 'FEMALE' ? 'REL-MADRE' : 'REL-PADRE']!, isEmergencyContact: true, isLegalGuardian: p.birthDate > '2007-01-01' },
    { id: uuid(`rel-2-${p.id}`), displayName: `${['Pedro', 'Laura', 'Raúl', 'Inés'][p.patientCode.charCodeAt(7) % 4]} ${p.motherLastName}`, relationshipConceptId: PARENTESCO['REL-HERMANO']!, isEmergencyContact: false, isLegalGuardian: false },
  ];
  return p.aseguradora === undefined ? base.slice(0, 1) : base;
}

export const CATEGORIA_MEDICO = CATEGORIA_PROFESIONAL['PC-MEDICO']!;
