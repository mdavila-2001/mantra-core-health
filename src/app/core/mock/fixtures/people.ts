import {
  PROFESSIONAL_CATEGORY,
  DEPARTMENT,
  SPECIALTY,
  STATUS,
  GENDER,
  GROUP_ABO,
  LANGUAGE,
  JURISDICTION,
  MUNICIPALITY,
  OCCUPATION,
  KINSHIP,
  RH,
  SEXO,
  CREDENTIAL_TYPE,
  LINK_TYPE,
} from './concepts';
import * as fk from '../faker';
import { IDS, TENANT_CLINICA, TENANT_HOSPITAL } from '../mock-session';
import { Coleccion, iso, isoDia, uuid } from '../mock-store';
import { profesionalesDeLaRed } from './insurer-network';
import { pacientesRegistrados, profesionalesRegistrados } from './registered-people';

/* ============================================================================
    Las personas del backend simulado: profesionales y pacientes.

    La médica (`medica@alovida.mock`) y la paciente (`paciente@alovida.mock`)
    son las dos cuentas con las que se entra; el resto puebla la guía, la
    agenda, el expediente y la red social.
    ========================================================================== */

import type { PacienteSimulado, ProfesionalSimulado } from './people.types';
export type { PacienteSimulado, ProfesionalSimulado } from './people.types';

const CITIES = [
  { ciudad: 'Santa Cruz de la Sierra', municipio: MUNICIPALITY['SC-SCZ']!, departamento: DEPARTMENT['geo:bo:department:SC']!, lat: -17.7833, lng: -63.1821 },
  { ciudad: 'La Paz', municipio: MUNICIPALITY['LP-LPZ']!, departamento: DEPARTMENT['geo:bo:department:LP']!, lat: -16.4897, lng: -68.1193 },
  { ciudad: 'Cochabamba', municipio: MUNICIPALITY['CB-CBB']!, departamento: DEPARTMENT['geo:bo:department:CB']!, lat: -17.3895, lng: -66.1568 },
];

function professional(
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
  const lugar = CITIES[datos.ciudad ?? 0]!;
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
   siendo la misma gente en `agenda.ts` y en `clinic.ts`. */

const WRITTEN_PROFESSIONALS: readonly ProfesionalSimulado[] = [
  professional(
    'medica',
    {
      nombre: 'Valeria',
      apellidos: ['Rojas', 'Mendoza'],
      titulo: 'Cardióloga',
      especialidades: [SPECIALTY['CARDIOLOGIA']!, SPECIALTY['MEDICINA_INTERNA']!],
      bio: 'Cardióloga clínica con 14 años de experiencia. Formada en la UMSA y el Instituto Nacional de Cardiología de México. Atiendo hipertensión, insuficiencia cardíaca y prevención cardiovascular, con especial interés en la salud cardíaca de la mujer.',
      rating: 4.9,
      tele: true,
      ids: { id: IDS.medica.practitionerProfileId, personId: IDS.medica.personId, userId: IDS.medica.userId },
      nacimiento: '1982-04-17',
    },
    0,
  ),
  professional('pediatra', { nombre: 'Jorge Andrés', apellidos: ['Salazar', 'Vaca'], titulo: 'Pediatra', especialidades: [SPECIALTY['PEDIATRIA']!], bio: 'Pediatra y neonatólogo. Control del niño sano, vacunación y seguimiento del desarrollo.', rating: 4.8 }, 1),
  professional('ginecologa', { nombre: 'María Fernanda', apellidos: ['Quiroga', 'Añez'], titulo: 'Ginecóloga obstetra', especialidades: [SPECIALTY['GINECOLOGIA_OBSTETRICIA']!], bio: 'Control prenatal, planificación familiar y salud de la mujer en todas las etapas.', org: 'hospital', rating: 4.7 }, 2),
  professional('dermatologo', { nombre: 'Rodrigo', apellidos: ['Paz', 'Soruco'], titulo: 'Dermatólogo', especialidades: [SPECIALTY['DERMATOLOGIA']!], bio: 'Dermatología clínica y estética. Acné, dermatitis, lunares y cáncer de piel.', ciudad: 1, rating: 4.5 }, 3),
  professional('traumatologo', { nombre: 'Luis Alberto', apellidos: ['Camacho', 'Justiniano'], titulo: 'Traumatólogo', especialidades: [SPECIALTY['TRAUMATOLOGIA']!], bio: 'Cirugía de rodilla y hombro, artroscopia y lesiones deportivas.', org: 'hospital', rating: 4.6 }, 4),
  professional('neurologa', { nombre: 'Carla', apellidos: ['Montero', 'Ribera'], titulo: 'Neuróloga', especialidades: [SPECIALTY['NEUROLOGIA']!], bio: 'Cefaleas, epilepsia y enfermedades neurodegenerativas.', ciudad: 2, rating: 4.4, tele: true }, 5),
  professional('psiquiatra', { nombre: 'Daniel', apellidos: ['Aguilar', 'Roca'], titulo: 'Psiquiatra', especialidades: [SPECIALTY['PSIQUIATRIA']!], bio: 'Ansiedad, depresión y salud mental del adulto. Atención presencial y por videollamada.', rating: 4.9, tele: true }, 6),
  professional('oftalmologa', { nombre: 'Patricia', apellidos: ['Vargas', 'Salinas'], titulo: 'Oftalmóloga', especialidades: [SPECIALTY['OFTALMOLOGIA']!], bio: 'Cirugía de cataratas, glaucoma y control de la vista.', ciudad: 1, rating: 4.3 }, 7),
  professional('odontologo', { nombre: 'Marco Antonio', apellidos: ['Suárez', 'Landívar'], titulo: 'Odontólogo', especialidades: [SPECIALTY['ODONTOLOGIA']!], bio: 'Odontología general, ortodoncia y estética dental.', rating: 4.6, nuevos: true }, 8),
  professional('endocrinologa', { nombre: 'Ana Belén', apellidos: ['Terrazas', 'Moreno'], titulo: 'Endocrinóloga', especialidades: [SPECIALTY['ENDOCRINOLOGIA']!, SPECIALTY['MEDICINA_INTERNA']!], bio: 'Diabetes, tiroides y obesidad. Enfoque integral con nutrición.', ciudad: 2, rating: 4.7, tele: true }, 9),
  professional('gastro', { nombre: 'Fernando', apellidos: ['Gutiérrez', 'Peña'], titulo: 'Gastroenterólogo', especialidades: [SPECIALTY['GASTROENTEROLOGIA']!], bio: 'Endoscopia digestiva, reflujo y enfermedad inflamatoria intestinal.', org: 'hospital', rating: 4.5 }, 10),
  professional('medgeneral', { nombre: 'Sofía', apellidos: ['Arce', 'Chávez'], titulo: 'Médica general', especialidades: [SPECIALTY['MEDICINA_GENERAL']!], bio: 'Medicina familiar. Primer contacto para toda la familia.', rating: 4.8, tele: true, nuevos: true }, 11),
  professional('nutricionista', { nombre: 'Gabriela', apellidos: ['Rivera', 'Ortiz'], titulo: 'Nutricionista', especialidades: [SPECIALTY['NUTRICION']!], bio: 'Planes de alimentación para diabetes, hipertensión y deporte.', rating: 4.9, tele: true }, 12),
  professional('neumologo', { nombre: 'Hugo', apellidos: ['Flores', 'Zambrana'], titulo: 'Neumólogo', especialidades: [SPECIALTY['NEUMOLOGIA']!], bio: 'Asma, EPOC y apnea del sueño.', ciudad: 1, org: 'hospital', rating: 4.2 }, 13),
  professional('sinespecialidad', { nombre: 'Ramiro', apellidos: ['Céspedes', 'Villca'], titulo: 'Médico', especialidades: [], bio: 'Médico recién titulado, en proceso de registro de especialidad.', rating: 0, verified: false, nuevos: false }, 14),
];

/* ---- y los de la red de las aseguradoras ----------------------------------
   El resto del padrón son los médicos reales que Alianza Seguros y Nacional
   Seguros publican como habilitados en Santa Cruz (`insurer-network.ts`).
   Reemplazan a los 45 que generaba faker: nombres inventados en un directorio
   que se le enseña a médicos bolivianos de verdad. Van **detrás** de los
   escritos, así que `PROFESIONALES[6]` y `.slice(1, 5)` siguen siendo la misma
   gente en `agenda.ts` y en `clinic.ts`. */

/* ---- y los 13 profesionales de demostración --------------------------------
   R-03 (22/09/2026) pide médicos con agenda para recorrer una reserva completa.
   Las 13 personas de la planilla del propietario son reales y la planilla no
   dice dónde atienden, así que no se les inventa agenda (D-H3-PROV-01,
   23/09/2026). En su lugar, 13 actores que no son nadie:

   - nombre «Profesional demo NN» y semilla `demo-registered-practitioner-NN`,
     sin nada tomado de la planilla;
   - especialidad del catálogo, repartida por índice;
   - sede en una de las dos instituciones inventadas de la maqueta (Clínica Los
     Olivos, Hospital San Lucas: ver `instituciones.spec.ts`), alternada;
   - sin verificar, sin puntuación, sin matrícula ni credenciales
     (`origen: 'DEMO'`, ver `credencialesDe` y `licenciasDe`).

   Van al **final** del padrón: los índices de los demás no se mueven. */

const SPECIALTIES_DEMO = [
  'MEDICINA_GENERAL',
  'PEDIATRIA',
  'CARDIOLOGIA',
  'DERMATOLOGIA',
  'TRAUMATOLOGIA',
  'NEUROLOGIA',
  'OFTALMOLOGIA',
  'ODONTOLOGIA',
  'ENDOCRINOLOGIA',
  'GASTROENTEROLOGIA',
  'NUTRICION',
  'NEUMOLOGIA',
  'PSIQUIATRIA',
] as const;

function professionalDemo(indice: number): ProfesionalSimulado {
  const numero = String(indice + 1).padStart(2, '0');
  const clave = `demo-registered-practitioner-${numero}`;
  const enHospital = indice % 2 === 1;
  const lugar = CITIES[0]!;
  return {
    id: uuid(`hpid-${clave}`),
    personId: uuid(`person-${clave}`),
    userId: uuid(`user-${clave}`),
    practitionerCode: `DEMO-${numero}`,
    displayName: `Profesional demo ${numero}`,
    name: 'Profesional',
    lastName: `demo ${numero}`,
    motherLastName: '',
    professionalTitle: 'Profesional de demostración',
    professionalBio: 'Actor de demostración de la maqueta. No es una persona real: su sede, su agenda y sus cupos son simulados.',
    slug: `profesional-demo-${numero}`,
    email: `profesional-demo-${numero}@demo.alovida.mock`,
    phone: '',
    especialidades: [SPECIALTY[SPECIALTIES_DEMO[indice % SPECIALTIES_DEMO.length]!]!],
    ciudad: lugar.ciudad,
    municipioId: lugar.municipio,
    departamentoId: lugar.departamento,
    tenantId: enHospital ? TENANT_HOSPITAL : TENANT_CLINICA,
    organizacion: enHospital ? 'Hospital San Lucas' : 'Clínica Los Olivos',
    verified: false,
    acceptsNewPatients: true,
    telehealthAvailable: false,
    ratingAverage: 0,
    ratingCount: 0,
    photoFileId: uuid(`photo-${clave}`),
    matricula: '',
    birthDate: '',
    nationalId: '',
    lat: lugar.lat,
    lng: lugar.lng,
    direccion: '',
    origen: 'DEMO',
  };
}

export const PROFESSIONALS_REGISTERED_DEMO: readonly ProfesionalSimulado[] = Array.from({ length: 13 }, (_, i) => professionalDemo(i));

export const PROFESSIONALS: readonly ProfesionalSimulado[] = [
  ...WRITTEN_PROFESSIONALS,
  ...profesionalesDeLaRed(WRITTEN_PROFESSIONALS.length),
  // Y las 13 personas de `USUARIO_MEDICOS_1.md` (ver `registered-people.ts`).
  ...profesionalesRegistrados(),
  ...PROFESSIONALS_REGISTERED_DEMO,
];

export const MEDICAL = PROFESSIONALS[0]!;

export function professionalById(id: string): ProfesionalSimulado | undefined {
  return PROFESSIONALS.find((p) => p.id === id || p.userId === id || p.personId === id);
}

export function professionalBySlug(slug: string): ProfesionalSimulado | undefined {
  return PROFESSIONALS.find((p) => p.slug === slug);
}

/* ---- pacientes ------------------------------------------------------------ */

function patient(
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
  const lugar = CITIES[datos.ciudad ?? 0]!;
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
    generoId: datos.sexo === 'FEMALE' ? GENDER['GEN-F']! : GENDER['GEN-M']!,
    sexoId: datos.sexo === 'FEMALE' ? SEXO['SEX-F']! : SEXO['SEX-M']!,
    nationalId: String(5000000 + indice * 9871),
    email: `${slug}@correo.mock`,
    phone: `+591 6${String(2000000 + indice * 5431).slice(0, 7)}`,
    municipioId: lugar.municipio,
    departamentoId: lugar.departamento,
    ocupacionId: OCCUPATION[datos.ocupacion] ?? OCCUPATION['occupation:bo:OTRA']!,
    direccion: `Calle ${['Libertad', 'Sucre', 'Ayacucho', 'Junín', 'Bolívar', 'Warnes'][indice % 6]} N.º ${45 + indice * 17}, ${lugar.ciudad}`,
    deceased: datos.fallecido ?? false,
    identityVerified: datos.verificado ?? true,
    ...(indice % 3 === 0 ? { photoFileId: uuid(`photo-${clave}`) } : {}),
    ...(datos.aseguradora === undefined ? {} : { aseguradora: datos.aseguradora, plan: datos.plan ?? 'Plan Familiar' }),
  };
}

const WRITTEN_PATIENTS: readonly PacienteSimulado[] = [
  patient('paciente', { nombre: 'Ana', segundo: 'Lucía', apellidos: ['Pérez', 'Quiroga'], nacimiento: '1990-06-21', sexo: 'FEMALE', ocupacion: 'occupation:bo:CONTADOR', aseguradora: 'Seguros Andina', plan: 'Plan Integral', ids: IDS.paciente }, 0),
  patient('p-mamani', { nombre: 'Jorge', segundo: 'Luis', apellidos: ['Mamani', 'Choque'], nacimiento: '1958-11-03', sexo: 'MALE', ocupacion: 'occupation:bo:JUBILADO', ciudad: 1 }, 1),
  patient('p-flores', { nombre: 'Daniela', apellidos: ['Flores', 'Cuéllar'], nacimiento: '1985-02-14', sexo: 'FEMALE', ocupacion: 'occupation:bo:DOCENTE', aseguradora: 'La Vitalicia' }, 2),
  patient('p-rocha', { nombre: 'Martín', apellidos: ['Rocha', 'Antelo'], nacimiento: '2015-09-30', sexo: 'MALE', ocupacion: 'occupation:bo:ESTUDIANTE' }, 3),
  patient('p-guzman', { nombre: 'Elena', segundo: 'María', apellidos: ['Guzmán', 'Arauz'], nacimiento: '1972-07-08', sexo: 'FEMALE', ocupacion: 'occupation:bo:COMERCIANTE', ciudad: 2 }, 4),
  patient('p-torrez', { nombre: 'Pablo', apellidos: ['Torrez', 'Nina'], nacimiento: '1995-12-25', sexo: 'MALE', ocupacion: 'occupation:bo:INGENIERO', aseguradora: 'Seguros Andina' }, 5),
  patient('p-vaca', { nombre: 'Lucía', apellidos: ['Vaca', 'Díez'], nacimiento: '2001-03-19', sexo: 'FEMALE', ocupacion: 'occupation:bo:ESTUDIANTE', verificado: false }, 6),
  patient('p-condori', { nombre: 'Ricardo', apellidos: ['Condori', 'Apaza'], nacimiento: '1949-01-10', sexo: 'MALE', ocupacion: 'occupation:bo:AGRICULTOR', ciudad: 1 }, 7),
  patient('p-medina', { nombre: 'Valentina', apellidos: ['Medina', 'Roca'], nacimiento: '1988-08-02', sexo: 'FEMALE', ocupacion: 'occupation:bo:ABOGADO', aseguradora: 'Alianza Seguros', plan: 'Plan Oro' }, 8),
  patient('p-soliz', { nombre: 'Andrés', apellidos: ['Solíz', 'Rojas'], nacimiento: '1979-05-27', sexo: 'MALE', ocupacion: 'occupation:bo:CHOFER' }, 9),
  patient('p-quispe', { nombre: 'Marta', apellidos: ['Quispe', 'Huanca'], nacimiento: '1966-10-15', sexo: 'FEMALE', ocupacion: 'occupation:bo:EMPLEADA_HOGAR', ciudad: 2 }, 10),
  patient('p-rivero', { nombre: 'Sebastián', apellidos: ['Rivero', 'Melgar'], nacimiento: '2010-04-04', sexo: 'MALE', ocupacion: 'occupation:bo:ESTUDIANTE' }, 11),
  patient('p-paredes', { nombre: 'Carmen', apellidos: ['Paredes', 'Ibáñez'], nacimiento: '1938-02-28', sexo: 'FEMALE', ocupacion: 'occupation:bo:JUBILADO', fallecido: true }, 12),
];

/* ---- y los generados ------------------------------------------------------
   Con trece pacientes no hay padrón que buscar: cabían enteros en la primera
   página y el buscador por nombre o por documento devolvía siempre lo mismo.
   Ciento veinte sí obligan a paginar, filtrar y ordenar, que es donde
   aparecen los fallos. Las edades se reparten a propósito —lactantes, niños,
   adultos y mayores— porque las pantallas clínicas pintan rangos por edad y
   con una sola franja no se ve si están bien. */

const OCCUPATIONS_BY_AGE: Readonly<Record<string, readonly string[]>> = {
  nino: ['occupation:bo:ESTUDIANTE'],
  joven: ['occupation:bo:ESTUDIANTE', 'occupation:bo:COMERCIANTE', 'occupation:bo:CHOFER', 'occupation:bo:ENFERMERO', 'occupation:bo:OTRA'],
  adulto: [
    'occupation:bo:DOCENTE',
    'occupation:bo:COMERCIANTE',
    'occupation:bo:INGENIERO',
    'occupation:bo:ABOGADO',
    'occupation:bo:CONTADOR',
    'occupation:bo:AGRICULTOR',
    'occupation:bo:CHOFER',
    'occupation:bo:ENFERMERO',
    'occupation:bo:EMPLEADO',
    'occupation:bo:EMPLEADA_HOGAR',
  ],
  mayor: ['occupation:bo:JUBILADO', 'occupation:bo:EMPLEADA_HOGAR', 'occupation:bo:AGRICULTOR', 'occupation:bo:COMERCIANTE'],
};

function generatedPatient(indice: number): PacienteSimulado {
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
  // Un laboratorio tipifica los dos juntos: si hay uno, hay el otro. El 40%
  // de la muestra basta para probar el filtro con resultados y sin ellos.
  const conTipificacion = f.datatype.boolean(0.4);
  const conIdiomaRegistrado = f.datatype.boolean(0.7);

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
    generoId: mujer ? GENDER['GEN-F']! : GENDER['GEN-M']!,
    sexoId: mujer ? SEXO['SEX-F']! : SEXO['SEX-M']!,
    nationalId: fk.cedulaSimple(f),
    email: `${slug}${indice}@correo.mock`,
    phone: fk.celular(f),
    municipioId: lugarDeVida.municipioId,
    departamentoId: lugarDeVida.departamentoId,
    ocupacionId: OCCUPATION[f.helpers.arrayElement(OCCUPATIONS_BY_AGE[tramo]!)] ?? OCCUPATION['occupation:bo:OTRA']!,
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
    ...(conTipificacion
      ? {
          aboGroupId: GROUP_ABO[f.helpers.arrayElement(['ABO-O', 'ABO-A', 'ABO-B', 'ABO-AB'])]!,
          rhFactorId: RH[f.helpers.arrayElement(['RH-POS', 'RH-NEG'])]!,
        }
      : {}),
    ...(conIdiomaRegistrado
      ? {
          idiomaClinicoId:
            LANGUAGE[f.helpers.arrayElement(['LANG-ES', 'LANG-QU', 'LANG-AY', 'LANG-EN'])]!,
        }
      : {}),
  };
}

export const PATIENTS: readonly PacienteSimulado[] = [
  ...WRITTEN_PATIENTS,
  ...Array.from({ length: 107 }, (_, i) => generatedPatient(WRITTEN_PATIENTS.length + i)),
  // Las 92 personas de `USUARIO_PACIENTES_1.md`, al final para no mover los
  // índices que usan `agenda.ts` y `clinic.ts` (ver `registered-people.ts`).
  ...pacientesRegistrados(),
];

export const PACIENTE = PATIENTS[0]!;

export const patientList = new Coleccion<PacienteSimulado>(PATIENTS);

export function patientById(id: string): PacienteSimulado | undefined {
  return patientList.todos().find((p) => p.id === id || p.userId === id || p.personId === id);
}

/* ---- lo que cuelga de cada profesional ----------------------------------- */

export function specialtiesOf(p: ProfesionalSimulado) {
  return p.especialidades.map((specialtyConceptId, i) => ({
    id: uuid(`spec-${p.id}-${i}`),
    specialtyConceptId,
    isPrimary: i === 0,
    boardCertified: i === 0 && p.origen === undefined,
    practiceScopeText: i === 0 ? 'Consulta y procedimientos ambulatorios' : 'Consulta',
    verificationStatusConceptId: p.verified ? STATUS['ST-VERIFIED']! : STATUS['ST-PENDING']!,
    verified: p.verified,
    validFrom: isoDia(-365 * 5),
  }));
}

/**
 * Un médico real de la red de una aseguradora no tiene títulos, matrículas,
 * idiomas ni trayectoria en la maqueta: la fuente no los publica, y un diploma
 * de la UMSA inventado para alguien que existe es una afirmación falsa.
 */
function isInNetwork(p: ProfesionalSimulado): boolean {
  return p.origen !== undefined;
}

export function credentialsOf(p: ProfesionalSimulado) {
  if (isInNetwork(p)) return [];
  return [
    {
      id: uuid(`cred-titulo-${p.id}`),
      credentialTypeConceptId: CREDENTIAL_TYPE['CREDENTIAL_TYPE_DEGREE']!,
      number: `TIT-${p.practitionerCode.slice(4)}`,
      issuingInstitutionText: 'Universidad Mayor de San Andrés',
      issueDate: isoDia(-365 * 12),
      stateConceptId: STATUS['ST-VERIFIED']!,
      verifiedAt: iso(-200),
      verificationSourceUri: 'https://sedes.gob.bo/verificacion',
      // El diploma escaneado. Lo registra `files.handlers.ts` con este mismo
      // id: sin un archivo detrás, «Descargar» sería un botón que falla.
      fileId: uuid(`file-diploma-${p.id}`),
    },
    ...(p.especialidades.length === 0
      ? []
      : [
          {
            id: uuid(`cred-esp-${p.id}`),
            credentialTypeConceptId: CREDENTIAL_TYPE['CREDENTIAL_TYPE_SPECIALTY']!,
            number: `ESP-${p.practitionerCode.slice(4)}`,
            issuingInstitutionText: 'Colegio Médico de Bolivia',
            issueDate: isoDia(-365 * 7),
            stateConceptId: p.verified ? STATUS['ST-VERIFIED']! : STATUS['ST-PENDING']!,
            ...(p.verified ? { verifiedAt: iso(-180) } : {}),
          },
        ]),
  ];
}

export function licensesOf(p: ProfesionalSimulado) {
  if (p.origen === 'USUARIO_PROPIETARIO') return rosterLicenses(p);
  if (isInNetwork(p)) return [];
  return [
    {
      id: uuid(`lic-${p.id}`),
      jurisdictionConceptId: JURISDICTION['JUR-BO']!,
      licenseNumber: p.matricula,
      regulatoryAuthority: 'Ministerio de Salud y Deportes',
      stateConceptId: STATUS['ST-ACTIVE']!,
      validFrom: isoDia(-365 * 10),
      /** El carnet del colegio. Mismo criterio que el diploma de arriba. */
      fileId: uuid(`file-matricula-${p.id}`),
    },
    {
      // SEDES es una habilitación departamental, no formación académica.
      id: uuid(`lic-sedes-${p.id}`),
      jurisdictionConceptId: JURISDICTION['JUR-SC']!,
      licenseNumber: `SEDES-${p.matricula}`,
      regulatoryAuthority: 'SEDES Santa Cruz',
      stateConceptId: STATUS['ST-ACTIVE']!,
      validFrom: isoDia(-365 * 6),
      validTo: isoDia(365 * 2),
    },
  ];
}

/** Las matrículas que declara la planilla de usuarios médicos, y ninguna más. */
function rosterLicenses(p: ProfesionalSimulado) {
  const r = p.registros;
  if (r === undefined) return [];
  return [
    ...(r.matriculaMinisterio === null
      ? []
      : [{
          id: uuid(`lic-${p.id}`),
          jurisdictionConceptId: JURISDICTION['JUR-BO']!,
          licenseNumber: r.matriculaMinisterio,
          regulatoryAuthority: 'Ministerio de Salud y Deportes',
          stateConceptId: STATUS['ST-ACTIVE']!,
          ...(r.fechaMatriculaMinisterio === null ? {} : { validFrom: r.fechaMatriculaMinisterio }),
        }]),
    ...(r.registroSedes === null
      ? []
      : [{
          id: uuid(`lic-sedes-${p.id}`),
          jurisdictionConceptId: JURISDICTION['JUR-SC']!,
          licenseNumber: r.registroSedes,
          regulatoryAuthority: 'SEDES Santa Cruz',
          stateConceptId: STATUS['ST-ACTIVE']!,
          ...(r.fechaRegistroSedes === null ? {} : { validFrom: r.fechaRegistroSedes }),
        }]),
    ...(r.registroColegioOdontologos === null
      ? []
      : [{
          id: uuid(`lic-colegio-${p.id}`),
          jurisdictionConceptId: JURISDICTION['JUR-SC']!,
          licenseNumber: r.registroColegioOdontologos,
          regulatoryAuthority: 'Colegio de Odontólogos',
          stateConceptId: STATUS['ST-ACTIVE']!,
        }]),
  ];
}

export function languagesOf(p: ProfesionalSimulado) {
  if (isInNetwork(p)) return [];
  return [
    { languageConceptId: LANGUAGE['LANG-ES']!, proficiencyConceptId: undefined, clinicalInterpretationAllowed: true },
    ...(p.telehealthAvailable
      ? [{ languageConceptId: LANGUAGE['LANG-EN']!, proficiencyConceptId: undefined, clinicalInterpretationAllowed: false }]
      : []),
  ].map(({ proficiencyConceptId: _omitido, ...resto }) => resto);
}

export interface SimulatedAffiliation {
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

export function initialAffiliations(): SimulatedAffiliation[] {
  return PROFESSIONALS.filter((p) => !isInNetwork(p)).flatMap((p, i) => [
    {
      id: uuid(`aff-actual-${p.id}`),
      practitionerProfileId: p.id,
      organizationName: p.organizacion,
      roleTitle: i % 3 === 0 ? 'Jefa de servicio' : 'Médico/a de planta',
      practiceSiteId: null,
      affiliationTypeConceptId: LINK_TYPE['AFF-PLANTA']!,
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
      affiliationTypeConceptId: LINK_TYPE['AFF-HONORARIO']!,
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
      affiliationTypeConceptId: LINK_TYPE['AFF-CONSULTORIO']!,
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

export const affiliationList = new Coleccion<SimulatedAffiliation>(initialAffiliations());

/** Familiares y contactos de cada paciente. */
export function relatedPeopleOf(p: PacienteSimulado) {
  const base = [
    { id: uuid(`rel-1-${p.id}`), displayName: `${['Rosa', 'Juan', 'Marta', 'Carlos'][p.patientCode.charCodeAt(6) % 4]} ${p.lastName}`, relationshipConceptId: KINSHIP[p.sexAtBirth === 'FEMALE' ? 'RELATIONSHIP_MOTHER' : 'RELATIONSHIP_FATHER']!, isEmergencyContact: true, isLegalGuardian: p.birthDate > '2007-01-01' },
    { id: uuid(`rel-2-${p.id}`), displayName: `${['Pedro', 'Laura', 'Raúl', 'Inés'][p.patientCode.charCodeAt(7) % 4]} ${p.motherLastName}`, relationshipConceptId: KINSHIP['RELATIONSHIP_SIBLING']!, isEmergencyContact: false, isLegalGuardian: false },
  ];
  return p.aseguradora === undefined ? base.slice(0, 1) : base;
}

export const DOCTOR_CATEGORY = PROFESSIONAL_CATEGORY['PC-MEDICO']!;

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
patientList.persistirEn('mock.personas.pacientes');
affiliationList.persistirEn('mock.personas.afiliaciones');
