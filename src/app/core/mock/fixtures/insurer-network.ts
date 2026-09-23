import { DEPARTAMENTO, ESPECIALIDAD, MUNICIPIO } from './conceptos';
import {
  INSURER_NETWORK_PRACTITIONERS,
  type InsurerNetworkPractitioner,
} from './insurer-network.generated';
import type { ProfesionalSimulado } from './personas';
import { uuid } from '../mock-store';

/* ============================================================================
    Los médicos reales de la red de las aseguradoras, con la forma de un
    profesional del simulador.

    Reemplazan a los 45 médicos que generaba faker detrás de los quince
    escritos a mano. Son los que Alianza Seguros y Nacional Seguros publican
    como habilitados en Santa Cruz (`insurer-network.generated.ts`).

    ## Sin puntuación, sin agenda, sin verificación

    El mismo criterio que ya siguen las clínicas y los laboratorios reales: son
    personas con nombre y apellido. Fabricarles una nota media, unos horarios o
    un sello de «verificado en AloVida» sería afirmar algo sobre alguien que
    existe y puede leerlo. Se muestran con lo que su aseguradora publica —
    especialidad, consultorio, teléfono y planes— y nada más.

    ## De la especialidad de la aseguradora al catálogo

    Cada rótulo tiene su fila en `ESPECIALIDADES_DE_LA_RED`, escrita a mano y
    completa: un rótulo nuevo hace fallar la carga en vez de desaparecer. Un
    rótulo compuesto («MEDICINA INTERNA CARDIOLOGIA») son dos especialidades.
    Lo que el catálogo no tiene —fonoaudiología, psicopedagogía, medicina
    nuclear— se muestra con su nombre y sin código: forzarle uno sería decir
    que una fonoaudióloga es otra cosa.
    ========================================================================== */

/** Rótulo de la aseguradora → títulos visibles y códigos del catálogo. */
const ESPECIALIDADES_DE_LA_RED: Readonly<Record<string, { readonly titulo: string; readonly codigos: readonly string[] }>> = {
  'ALERGIA E INMUNOLOGIA': { titulo: 'Alergia e inmunología', codigos: [] },
  'ALERGOLOGIA': { titulo: 'Alergología', codigos: [] },
  'ANESTESIOLOGIA': { titulo: 'Anestesiología', codigos: ['ANESTESIOLOGIA'] },
  'ANGIOPLASTIA CORONARIA': { titulo: 'Angioplastia coronaria', codigos: ['CARDIOLOGIA'] },
  'CARDIOLOGIA': { titulo: 'Cardiología', codigos: ['CARDIOLOGIA'] },
  'CARDIOLOGIA INFANTIL': { titulo: 'Cardiología infantil', codigos: ['CARDIOLOGIA_PEDIATRICA'] },
  'CARDIOLOGIA MEDICINA CRITICA Y TERAPIA INTENSIVA': { titulo: 'Cardiología · Medicina crítica y terapia intensiva', codigos: ['CARDIOLOGIA', 'MEDICINA_INTENSIVA'] },
  'CARDIOLOGIA PEDIATRICA': { titulo: 'Cardiología pediátrica', codigos: ['CARDIOLOGIA_PEDIATRICA'] },
  'CINEANGIOCORONARIOGRAFIA': { titulo: 'Cineangiocoronariografía', codigos: ['CARDIOLOGIA'] },
  'CIRUGIA CARDIACA': { titulo: 'Cirugía cardíaca', codigos: [] },
  'CIRUGIA CARDIOVASCULAR': { titulo: 'Cirugía cardiovascular', codigos: [] },
  'CIRUGIA DE CABEZA Y CUELLO': { titulo: 'Cirugía de cabeza y cuello', codigos: [] },
  'CIRUGIA DE COLUMNA Y ARTRSCOPICA': { titulo: 'Cirugía de columna y artroscópica', codigos: ['TRAUMATOLOGIA'] },
  'CIRUGIA GENERAL': { titulo: 'Cirugía general', codigos: ['CIRUGIA_GENERAL'] },
  'CIRUGIA GENERAL CIRUGIA ONCOLOGICA': { titulo: 'Cirugía general · Cirugía oncológica', codigos: ['CIRUGIA_GENERAL', 'CIRUGIA_ONCOLOGICA'] },
  'CIRUGIA GENERAL CIRUGIA PEDIATRICA': { titulo: 'Cirugía general · Cirugía pediátrica', codigos: ['CIRUGIA_GENERAL', 'CIRUGIA_PEDIATRICA'] },
  'CIRUGIA GENERAL COLOPROCTOLOGIA': { titulo: 'Cirugía general · Coloproctología', codigos: ['CIRUGIA_GENERAL', 'COLOPROCTOLOGIA'] },
  'CIRUGIA GENERAL ONCOLOGIA CLINICA': { titulo: 'Cirugía general · Oncología clínica', codigos: ['CIRUGIA_GENERAL', 'ONCOLOGIA'] },
  'CIRUGIA LAPAROSCOPICA': { titulo: 'Cirugía laparoscópica', codigos: ['CIRUGIA_GENERAL'] },
  'CIRUGIA ONCOLOGICA': { titulo: 'Cirugía oncológica', codigos: ['CIRUGIA_ONCOLOGICA'] },
  'CIRUGIA PEDIATRA': { titulo: 'Cirugía pediátrica', codigos: ['CIRUGIA_PEDIATRICA'] },
  'CIRUGIA PEDIATRICA': { titulo: 'Cirugía pediátrica', codigos: ['CIRUGIA_PEDIATRICA'] },
  'CIRUGIA PEDIATRICA UROLOGIA PEDIATRICA': { titulo: 'Cirugía pediátrica · Urología pediátrica', codigos: ['CIRUGIA_PEDIATRICA', 'UROLOGIA'] },
  'CIRUGIA PLASTICA ESTETICA Y RECONSTRUCTIVA': { titulo: 'Cirugía plástica, estética y reconstructiva', codigos: [] },
  'CIRUGIA TORACICA': { titulo: 'Cirugía torácica', codigos: [] },
  'CIRUGIA TORACICA Y CARDIOVASCULAR': { titulo: 'Cirugía torácica y cardiovascular', codigos: [] },
  'CIRUGIA VASCULAR': { titulo: 'Cirugía vascular', codigos: [] },
  'CIRUGIA VASCULAR Y ANGIOLOGIA': { titulo: 'Cirugía vascular y angiología', codigos: [] },
  'CIRUGIA Y TRAUMATOLOGIA EN BUCOMAXILOFACIAL': { titulo: 'Cirugía y traumatología bucomaxilofacial', codigos: ['CIRUGIA_BUCOMAXILOFACIAL'] },
  'COLOPROCTOLOGIA': { titulo: 'Coloproctología', codigos: ['COLOPROCTOLOGIA'] },
  'DERMATOLOGIA': { titulo: 'Dermatología', codigos: ['DERMATOLOGIA'] },
  'DERMATOLOGIA PEDIATRICA': { titulo: 'Dermatología pediátrica', codigos: ['DERMATOLOGIA'] },
  'EDUCACION PARA EL PARTO': { titulo: 'Educación para el parto', codigos: [] },
  'ENDOCRINOLOGIA': { titulo: 'Endocrinología', codigos: ['ENDOCRINOLOGIA'] },
  'ENDOCRINOLOGIA MEDICINA INTERNA': { titulo: 'Endocrinología · Medicina interna', codigos: ['ENDOCRINOLOGIA', 'MEDICINA_INTERNA'] },
  'ENDOCRINOLOGO PEDIATRA': { titulo: 'Endocrinología pediátrica', codigos: ['ENDOCRINOLOGIA'] },
  'FISIATRA': { titulo: 'Fisiatría', codigos: ['MEDICINA_FISICA_REHABILITACION'] },
  'FISIOTERAPIA': { titulo: 'Fisioterapia', codigos: ['FISIOTERAPIA'] },
  'FISIOTERAPIA DEL STRESS': { titulo: 'Fisioterapia del estrés', codigos: ['FISIOTERAPIA'] },
  'FISIOTERAPIA Y REHABILITACION': { titulo: 'Fisioterapia y rehabilitación', codigos: ['FISIOTERAPIA'] },
  'FONOAUDIOLOGIA': { titulo: 'Fonoaudiología', codigos: [] },
  'GASTROENTEROLOGIA': { titulo: 'Gastroenterología', codigos: ['GASTROENTEROLOGIA'] },
  'GASTROENTEROLOGIA PEDIATRICA': { titulo: 'Gastroenterología pediátrica', codigos: ['GASTROENTEROLOGIA'] },
  'GERIATRIA': { titulo: 'Geriatría', codigos: ['GERIATRIA'] },
  'GERIATRIA Y GERONTOLOGIA': { titulo: 'Geriatría y gerontología', codigos: ['GERIATRIA'] },
  'GINECOLOGIA ONCOLOGICA': { titulo: 'Ginecología oncológica', codigos: ['ONCOLOGIA_GINECOLOGICA'] },
  'GINECOLOGIA Y OBSTETRICIA': { titulo: 'Ginecología y obstetricia', codigos: ['GINECOLOGIA_OBSTETRICIA'] },
  'GINECOLOGIA Y OBSTETRICIA MASTOLOGIA': { titulo: 'Ginecología y obstetricia · Mastología', codigos: ['GINECOLOGIA_OBSTETRICIA'] },
  'HEMATOLOGIA Y HEMOTERAPIA': { titulo: 'Hematología y hemoterapia', codigos: ['HEMATOLOGIA'] },
  'INFECTOLOGIA': { titulo: 'Infectología', codigos: ['INFECTOLOGIA'] },
  'INFECTOLOGIA PEDIATRICA': { titulo: 'Infectología pediátrica', codigos: ['INFECTOLOGIA_PEDIATRICA'] },
  'MASTOLOGIA': { titulo: 'Mastología', codigos: [] },
  'MEDICINA DEL DOLOR': { titulo: 'Medicina del dolor', codigos: ['MEDICINA_DEL_DOLOR'] },
  'MEDICINA FAMILIAR': { titulo: 'Medicina familiar', codigos: ['MEDICINA_FAMILIAR'] },
  'MEDICINA FISICA Y REHABILITACION FISIOTERAPIA Y REHABILITACION': { titulo: 'Medicina física y rehabilitación', codigos: ['MEDICINA_FISICA_REHABILITACION', 'FISIOTERAPIA'] },
  'MEDICINA GENERAL': { titulo: 'Medicina general', codigos: ['MEDICINA_GENERAL'] },
  'MEDICINA INTERNA': { titulo: 'Medicina interna', codigos: ['MEDICINA_INTERNA'] },
  'MEDICINA INTERNA CARDIOLOGIA': { titulo: 'Medicina interna · Cardiología', codigos: ['MEDICINA_INTERNA', 'CARDIOLOGIA'] },
  'MEDICINA INTERNA HEMATOLOGIA Y HEMOTERAPIA': { titulo: 'Medicina interna · Hematología', codigos: ['MEDICINA_INTERNA', 'HEMATOLOGIA'] },
  'MEDICINA INTERNA INFECTOLOGIA': { titulo: 'Medicina interna · Infectología', codigos: ['MEDICINA_INTERNA', 'INFECTOLOGIA'] },
  'MEDICINA INTERNA MEDICINA FISICA Y REHABILITACION': { titulo: 'Medicina interna · Medicina física y rehabilitación', codigos: ['MEDICINA_INTERNA', 'MEDICINA_FISICA_REHABILITACION'] },
  'MEDICINA INTERNA ONCOLOGIA CLINICA': { titulo: 'Medicina interna · Oncología clínica', codigos: ['MEDICINA_INTERNA', 'ONCOLOGIA'] },
  'MEDICINA NUCLEAR': { titulo: 'Medicina nuclear', codigos: [] },
  'NEFROLOGIA': { titulo: 'Nefrología', codigos: ['NEFROLOGIA'] },
  'NEFROLOGIA PEDIATRA': { titulo: 'Nefrología pediátrica', codigos: ['NEFROLOGIA'] },
  'NEONATOLOGIA': { titulo: 'Neonatología', codigos: ['NEONATOLOGIA'] },
  'NEUMOLOGIA': { titulo: 'Neumología', codigos: ['NEUMOLOGIA'] },
  'NEUMOLOGIA PEDIATRICA': { titulo: 'Neumología pediátrica', codigos: ['NEUMOLOGIA'] },
  'NEUROCIRUGIA': { titulo: 'Neurocirugía', codigos: [] },
  'NEUROFISIOLOGIA': { titulo: 'Neurofisiología', codigos: [] },
  'NEUROLOGIA': { titulo: 'Neurología', codigos: ['NEUROLOGIA'] },
  'NEUROLOGIA PEDIATRICA': { titulo: 'Neurología pediátrica', codigos: ['NEUROLOGIA_PEDIATRICA'] },
  'NUTRICIONISTA': { titulo: 'Nutrición', codigos: ['NUTRICION'] },
  'ODONTOLOGIA': { titulo: 'Odontología', codigos: ['ODONTOLOGIA'] },
  'OFTALMOLOGIA': { titulo: 'Oftalmología', codigos: ['OFTALMOLOGIA'] },
  'OFTALMOLOGIA PEDIATRICA': { titulo: 'Oftalmología pediátrica', codigos: ['OFTALMOLOGIA'] },
  'ONCOLOGIA': { titulo: 'Oncología', codigos: ['ONCOLOGIA'] },
  'ONCOLOGIA CLINICA': { titulo: 'Oncología clínica', codigos: ['ONCOLOGIA'] },
  'ONCOLOGIA-QUIMIOTERAPIA': { titulo: 'Oncología · Quimioterapia', codigos: ['ONCOLOGIA'] },
  'ORTOPEDIA Y TRAUMATOLOGIA': { titulo: 'Ortopedia y traumatología', codigos: ['TRAUMATOLOGIA'] },
  'OTORRINOLARINGOLOGIA': { titulo: 'Otorrinolaringología', codigos: ['OTORRINOLARINGOLOGIA'] },
  'PEDIATRIA': { titulo: 'Pediatría', codigos: ['PEDIATRIA'] },
  'PEDIATRIA CIRUGIA PEDIATRICA': { titulo: 'Pediatría · Cirugía pediátrica', codigos: ['PEDIATRIA', 'CIRUGIA_PEDIATRICA'] },
  'PEDIATRIA ENDOCRINOLOGIA PEDIATRICA': { titulo: 'Pediatría · Endocrinología pediátrica', codigos: ['PEDIATRIA', 'ENDOCRINOLOGIA'] },
  'PEDIATRIA NEFROLOGIA PEDIATRICA': { titulo: 'Pediatría · Nefrología pediátrica', codigos: ['PEDIATRIA', 'NEFROLOGIA'] },
  'PEDIATRIA NEONATOLOGIA': { titulo: 'Pediatría · Neonatología', codigos: ['PEDIATRIA', 'NEONATOLOGIA'] },
  'PEDIATRIA ONCO HEMATOLOGIA PEDIATRICA': { titulo: 'Pediatría · Oncohematología pediátrica', codigos: ['PEDIATRIA', 'ONCOLOGIA_PEDIATRICA'] },
  'PEDIATRIA TERAPIA INTENSIVA PEDIATRICA': { titulo: 'Pediatría · Terapia intensiva pediátrica', codigos: ['PEDIATRIA', 'TERAPIA_INTENSIVA_PEDIATRICA'] },
  'PROCTOLOGIA': { titulo: 'Proctología', codigos: ['COLOPROCTOLOGIA'] },
  'PSICOLOGIA': { titulo: 'Psicología', codigos: ['PSICOLOGIA_CLINICA'] },
  'PSICOLOGIA CLINICA': { titulo: 'Psicología clínica', codigos: ['PSICOLOGIA_CLINICA'] },
  'PSICOLOGIA INFANTIL': { titulo: 'Psicología infantil', codigos: ['PSICOLOGIA_CLINICA'] },
  'PSICOPEDAGOGIA CLINICA': { titulo: 'Psicopedagogía clínica', codigos: [] },
  'PSIQUIATRIA': { titulo: 'Psiquiatría', codigos: ['PSIQUIATRIA'] },
  'RADIOLOGIA': { titulo: 'Radiología', codigos: ['RADIOLOGIA'] },
  'REUMATOLOGIA': { titulo: 'Reumatología', codigos: ['REUMATOLOGIA'] },
  'REUMATOLOGIA MEDICINA INTERNA': { titulo: 'Reumatología · Medicina interna', codigos: ['REUMATOLOGIA', 'MEDICINA_INTERNA'] },
  'REUMATOLOGIA PEDIATRA': { titulo: 'Reumatología pediátrica', codigos: ['REUMATOLOGIA'] },
  'TERAPIA INTENSIVA': { titulo: 'Terapia intensiva', codigos: ['MEDICINA_INTENSIVA'] },
  'TRAUMATOLOGIA PEDIATRICA': { titulo: 'Traumatología pediátrica', codigos: ['ORTOPEDIA_PEDIATRICA'] },
  'TRAUMATOLOGIA Y ORTOPEDIA': { titulo: 'Traumatología y ortopedia', codigos: ['TRAUMATOLOGIA'] },
  'UROLOGIA': { titulo: 'Urología', codigos: ['UROLOGIA'] },
  'UROLOGIA INFANTIL': { titulo: 'Urología infantil', codigos: ['UROLOGIA'] },
  'UROLOGIA PEDIATRICA': { titulo: 'Urología pediátrica', codigos: ['UROLOGIA'] },
};

const MUNICIPIO_DE_CIUDAD: Readonly<Record<string, string>> = {
  'Santa Cruz de la Sierra': 'SC-SCZ',
  'Montero': 'SC-MON',
  'Puerto Suárez': 'SC-PUERTO_SUAREZ',
  'Puerto Quijarro': 'SC-PUERTO_QUIJARRO',
};

function especialidadDeLaRed(rotulo: string) {
  const fila = ESPECIALIDADES_DE_LA_RED[rotulo];
  if (fila === undefined) {
    throw new Error(`Especialidad de la red sin mapear: «${rotulo}». Agregala a ESPECIALIDADES_DE_LA_RED.`);
  }
  return fila;
}

/** «Alianza Seguros (AFI GOLD, OASIS) y Nacional Seguros (SALUD FLEXIBLE)». */
function redesEnPalabras(p: InsurerNetworkPractitioner): string {
  const partes = p.networks.map((r) => `${r.insurer} (${r.plans.join(', ')})`);
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)!}`;
}

function slugDe(p: InsurerNetworkPractitioner, indice: number): string {
  const base = `${p.givenNames.split(' ')[0] ?? ''}-${p.surnames.split(' ')[0] ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // El índice desempata: dos «Ana Rojas» de la red tendrían el mismo slug.
  return `${base}-${indice}`;
}

function profesionalDeLaRed(p: InsurerNetworkPractitioner, indice: number): ProfesionalSimulado {
  const filas = p.specialties.map(especialidadDeLaRed);
  const codigos = [...new Set(filas.flatMap((f) => f.codigos))];
  const consultorio = p.offices[0]!;
  const municipio = MUNICIPIO_DE_CIUDAD[consultorio.municipality];
  if (municipio === undefined) {
    throw new Error(`Municipio de la red sin mapear: «${consultorio.municipality}».`);
  }
  const slug = slugDe(p, indice);
  const titulos = [...new Set(filas.map((f) => f.titulo))];
  const telefono = consultorio.phones[0];
  // Si la fuente no separa apellidos de nombres, el nombre visible respeta el
  // orden en que lo publica la aseguradora en vez de reordenarlo con una
  // suposición: «Aicardi Miriam del Valle» no es «Del Valle Aicardi Miriam».
  const displayName = p.nameSplit === 'source' ? `${p.givenNames} ${p.surnames}` : `${p.surnames} ${p.givenNames}`;
  const [lastName = '', motherLastName = ''] = p.surnames.split(' ');

  return {
    id: uuid(`hpid-${p.id}`),
    personId: uuid(`person-${p.id}`),
    userId: uuid(`user-${p.id}`),
    practitionerCode: `RED-${String(indice).padStart(4, '0')}`,
    displayName,
    name: p.givenNames,
    lastName,
    motherLastName,
    professionalTitle: titulos.join(' · '),
    professionalBio: `Profesional habilitado en la red médica de ${redesEnPalabras(p)}, según el listado que publica la aseguradora.`,
    slug,
    // Dominio `.mock`: no es su correo y no lo pretende. La fuente no publica ninguno.
    email: `${slug}@red.alovida.mock`,
    phone: telefono === undefined ? '' : `+591 ${telefono}`,
    especialidades: codigos.map((c) => ESPECIALIDAD[c]!),
    ciudad: consultorio.city,
    municipioId: MUNICIPIO[municipio]!,
    departamentoId: DEPARTAMENTO['geo:bo:department:SC']!,
    tenantId: uuid(`tenant-red-${p.id}`),
    organizacion: p.networks.map((r) => r.insurer).join(' · '),
    verified: false,
    acceptsNewPatients: true,
    telehealthAvailable: false,
    ratingAverage: 0,
    ratingCount: 0,
    photoFileId: uuid(`photo-${p.id}`),
    // La red no publica matrícula, fecha de nacimiento ni cédula.
    matricula: '',
    birthDate: '',
    nationalId: '',
    lat: consultorio.lat,
    lng: consultorio.lng,
    direccion: consultorio.address,
    origen: 'RED_ASEGURADORA',
  };
}

/** Los médicos de la red, a partir del índice que les toque en el padrón. */
export function profesionalesDeLaRed(desde: number): readonly ProfesionalSimulado[] {
  return INSURER_NETWORK_PRACTITIONERS.map((p, i) => profesionalDeLaRed(p, desde + i));
}
