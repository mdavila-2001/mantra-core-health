import { uuid } from '../mock-store';

/* ============================================================================
    El catálogo de terminología del backend simulado.

    Todo `*ConceptId` que aparece en cualquier fixture sale de acá, así que
    `GET /terminology/concepts?ids=` siempre puede etiquetarlo. Cada concepto
    pertenece a uno o más conjuntos de valores (`valueSets`, por código
    interno), que es lo que expanden los selectores.
    ========================================================================== */

export interface ConceptoSimulado {
  readonly id: string;
  readonly code: string;
  readonly display: string;
  readonly definition?: string;
  readonly valueSets: readonly string[];
  readonly selectable: boolean;
  readonly ordinal: number;
  /**
   * Lo que el sistema de codificación declara del concepto, por código
   * (`concept_properties.property_code` en el modelo real). Ausente en la
   * mayoría de los conceptos: sólo lo llevan quienes lo declaran con
   * {@link declararPropiedades}. Espeja `ConceptDetail.properties` de
   * `core/data-access/terminology/terminology.types.ts`.
   */
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface ConjuntoSimulado {
  readonly id: string;
  readonly internalCode: string;
  readonly name: string;
  readonly description: string;
  readonly defaultVersionId: string;
}

const registro = new Map<string, ConceptoSimulado>();
const conjuntos = new Map<string, ConjuntoSimulado>();

export const CODE_SYSTEM_VERSION_ID = uuid('code-system-version-alovida-1');
export const CODE_SYSTEM_ID = uuid('code-system-alovida');

function conjunto(internalCode: string, name: string, description: string): ConjuntoSimulado {
  const c: ConjuntoSimulado = {
    id: uuid(`value-set-${internalCode}`),
    internalCode,
    name,
    description,
    defaultVersionId: uuid(`value-set-version-${internalCode}`),
  };
  conjuntos.set(internalCode, c);
  return c;
}

function definir(
  valueSet: string,
  entradas: readonly (readonly [code: string, display: string, definition?: string])[],
  ordinalInicial = 1,
): Readonly<Record<string, string>> {
  const ids: Record<string, string> = {};
  entradas.forEach(([code, display, definition], indice) => {
    const existente = registro.get(code);
    if (existente !== undefined) {
      registro.set(code, { ...existente, valueSets: [...existente.valueSets, valueSet] });
      ids[code] = existente.id;
      return;
    }
    const id = uuid(`concept-${code}`);
    registro.set(code, {
      id,
      code,
      display,
      ...(definition === undefined ? {} : { definition }),
      valueSets: [valueSet],
      selectable: true,
      ordinal: indice + ordinalInicial,
    });
    ids[code] = id;
  });
  return ids;
}

/**
 * Agrega propiedades (`concept_properties`) a un concepto ya definido.
 *
 * Sólo se usa para lo que el `GET /terminology/concepts/:id` real declara
 * como `properties: Record<string, unknown>` — un mapa `código -> value_json`
 * que el modelo NO acota (`terminology.constants.ts` de la API: "tantas como
 * haga falta, una por código"). No lanza si el código no existe: mejor una
 * propiedad que no aparece que romper el arranque del catálogo.
 */
function declararPropiedades(code: string, propiedades: Readonly<Record<string, unknown>>): void {
  const existente = registro.get(code);
  if (existente === undefined) return;
  registro.set(code, { ...existente, properties: { ...existente.properties, ...propiedades } });
}

/* ---- Bolivia: departamentos, municipios, ocupaciones, empleadores --------- */

/* Los codigos no son decorativos: `BoMunicipalitiesService` saca la sigla del
   departamento quitandole el prefijo `geo:bo:department:` al codigo, y la del
   municipio por el prefijo INE o, si no, por las dos letras iniciales. Con los
   `BO-SC` de antes la sigla quedaba en `BO-SC`, no casaba con ninguna silueta
   y el mapa de departamentos del alta se dibujaba vacio —y sin departamento no
   habia ciudades, que es un campo obligatorio: el registro no se podia
   terminar. */
conjunto('VS_BO_DEPARTMENT', 'Departamentos de Bolivia', 'Los nueve departamentos.');
export const DEPARTAMENTO = definir('VS_BO_DEPARTMENT', [
  ['geo:bo:department:SC', 'Santa Cruz'],
  ['geo:bo:department:LP', 'La Paz'],
  ['geo:bo:department:CB', 'Cochabamba'],
  ['geo:bo:department:OR', 'Oruro'],
  ['geo:bo:department:PT', 'Potosí'],
  ['geo:bo:department:CH', 'Chuquisaca'],
  ['geo:bo:department:TJ', 'Tarija'],
  ['geo:bo:department:BE', 'Beni'],
  ['geo:bo:department:PD', 'Pando'],
]);

conjunto('VS_BO_MUNICIPALITY', 'Municipios de Bolivia', 'Municipios, agrupados por departamento.');
export const MUNICIPIO = definir('VS_BO_MUNICIPALITY', [
  ['SC-SCZ', 'Santa Cruz de la Sierra'],
  ['SC-MON', 'Montero'],
  ['SC-WAR', 'Warnes'],
  ['SC-COT', 'Cotoca'],
  ['SC-LGD', 'La Guardia'],
  // Con el código del catálogo real (`03_terminology.seeds.json`): los traen
  // los consultorios de la red de Nacional Seguros en la frontera con Brasil.
  ['SC-PUERTO_SUAREZ', 'Puerto Suárez'],
  ['SC-PUERTO_QUIJARRO', 'Puerto Quijarro'],
  ['LP-LPZ', 'La Paz'],
  ['LP-ELA', 'El Alto'],
  ['LP-VIA', 'Viacha'],
  ['CB-CBB', 'Cochabamba'],
  ['CB-QUI', 'Quillacollo'],
  ['CB-SAC', 'Sacaba'],
  ['OR-ORU', 'Oruro'],
  ['PT-PTS', 'Potosí'],
  ['CH-SRE', 'Sucre'],
  ['TJ-TJA', 'Tarija'],
  ['BE-TRI', 'Trinidad'],
  ['PD-COB', 'Cobija'],
]);

/* Las ocupaciones y los empleadores llevan el código del catálogo real por lo
   mismo que los departamentos de acá arriba, y es la tercera vez que muerde: la
   pantalla decide por código, no por nombre.

   El alta de paciente ofrece «Otra ocupación» al final de la lista —el registro
   de procesos lo pide así (módulo Paciente §1.4.1: «dejar uno al final libre
   para que él pueda detallar la ocupación que no encontró»)— y, elegida ésa y
   sólo ésa, destraba un «¿Cuál?» escrito a mano que viaja en
   `occupationFreeText`. Quién decide si es «Otra» compara contra
   `CODIGO_OCUPACION_OTRA` (`bo-occupations.service.ts`), que vale
   **`occupation:bo:OTRA`**. Con los `OCC-*` inventados que había antes esa
   comparación nunca daba verdadera, así que el campo escrito a mano **no
   aparecía nunca**: la ocupación personalizada estaba construida y era
   inalcanzable. Lo mismo le pasaba a «Otra empresa» con `employer:bo:OTRA`.

   El prefijo no es adorno, y el backend explica por qué: `catalog_concepts.code`
   es único por versión del sistema de códigos y todo el catálogo interno
   comparte una sola, así que un `MEDICO` a secas chocaría con el de otro
   catálogo.

   Las ocupaciones son las 64 del catálogo real (`bo-occupations.catalog.ts`,
   COB-2023 del INE — el SEGIP no publica su lista; el porqué está en el
   encabezado de ese archivo). Los empleadores siguen siendo un puñado: son 155
   allá y esto es una maqueta, no el paquete de seeds. Lo que no se recorta son
   las cuatro salidas del final, que son las que la pantalla necesita para
   ofrecerle una respuesta a quien no se encuentra en la lista. */
conjunto('VS_BO_OCCUPATION', 'Ocupaciones', 'Catálogo normado de ocupaciones.');
export const OCUPACION = definir('VS_BO_OCCUPATION', [
  ['occupation:bo:ABOGADO', 'Abogado / Abogada'],
  ['occupation:bo:ADMINISTRADOR', 'Administrador / Administradora'],
  ['occupation:bo:AGRICULTOR', 'Agricultor / Agricultora'],
  ['occupation:bo:ALBANIL', 'Albañil'],
  ['occupation:bo:ARQUITECTO', 'Arquitecto / Arquitecta'],
  ['occupation:bo:ARTESANO', 'Artesano / Artesana'],
  ['occupation:bo:ARTISTA', 'Artista'],
  ['occupation:bo:AUXILIAR_ENFERMERIA', 'Auxiliar de enfermería'],
  ['occupation:bo:BIOQUIMICO', 'Bioquímico / Bioquímica'],
  ['occupation:bo:CARNICERO', 'Carnicero / Carnicera'],
  ['occupation:bo:CARPINTERO', 'Carpintero / Carpintera'],
  ['occupation:bo:CHOFER', 'Chofer'],
  ['occupation:bo:COCINERO', 'Cocinero / Cocinera'],
  ['occupation:bo:COMERCIANTE', 'Comerciante'],
  ['occupation:bo:CONTADOR', 'Contador / Contadora'],
  ['occupation:bo:COSTURERO', 'Costurero / Costurera'],
  ['occupation:bo:DEPORTISTA', 'Deportista'],
  ['occupation:bo:DOCENTE', 'Docente'],
  ['occupation:bo:ECONOMISTA', 'Economista'],
  ['occupation:bo:ELECTRICISTA', 'Electricista'],
  ['occupation:bo:EMPLEADA_HOGAR', 'Empleada / Empleado del hogar'],
  ['occupation:bo:EMPLEADO', 'Empleado / Empleada'],
  ['occupation:bo:EMPRESARIO', 'Empresario / Empresaria'],
  ['occupation:bo:ENFERMERO', 'Enfermero / Enfermera'],
  ['occupation:bo:ESTUDIANTE', 'Estudiante'],
  ['occupation:bo:FARMACEUTICO', 'Farmacéutico / Farmacéutica'],
  ['occupation:bo:FOTOGRAFO', 'Fotógrafo / Fotógrafa'],
  ['occupation:bo:FUNCIONARIO_PUBLICO', 'Funcionario público / Funcionaria pública'],
  ['occupation:bo:GANADERO', 'Ganadero / Ganadera'],
  ['occupation:bo:GASTRONOMO', 'Gastrónomo / Gastrónoma'],
  ['occupation:bo:INGENIERO', 'Ingeniero / Ingeniera'],
  ['occupation:bo:JOYERO', 'Joyero / Joyera'],
  ['occupation:bo:JUBILADO', 'Jubilado / Jubilada'],
  ['occupation:bo:LABORES_CASA', 'Labores de casa'],
  ['occupation:bo:MECANICO', 'Mecánico / Mecánica'],
  ['occupation:bo:MEDICO', 'Médico / Médica'],
  ['occupation:bo:MILITAR', 'Militar'],
  ['occupation:bo:MINERO', 'Minero / Minera'],
  ['occupation:bo:MUSICO', 'Músico / Música'],
  ['occupation:bo:NUTRICIONISTA', 'Nutricionista'],
  ['occupation:bo:OBRERO', 'Obrero / Obrera'],
  ['occupation:bo:ODONTOLOGO', 'Odontólogo / Odontóloga'],
  ['occupation:bo:PANADERO', 'Panadero / Panadera'],
  ['occupation:bo:PELUQUERO', 'Peluquero / Peluquera'],
  ['occupation:bo:PERIODISTA', 'Periodista'],
  ['occupation:bo:PESCADOR', 'Pescador / Pescadora'],
  ['occupation:bo:PILOTO', 'Piloto'],
  ['occupation:bo:PINTOR', 'Pintor / Pintora'],
  ['occupation:bo:PLOMERO', 'Plomero / Plomera'],
  ['occupation:bo:POLICIA', 'Policía'],
  ['occupation:bo:PSICOLOGO', 'Psicólogo / Psicóloga'],
  ['occupation:bo:RELIGIOSO', 'Religioso / Religiosa'],
  ['occupation:bo:SASTRE', 'Sastre'],
  ['occupation:bo:SECRETARIO', 'Secretario / Secretaria'],
  ['occupation:bo:SEGURIDAD', 'Personal de seguridad'],
  ['occupation:bo:SIN_OCUPACION', 'Sin ocupación'],
  ['occupation:bo:SOLDADOR', 'Soldador / Soldadora'],
  ['occupation:bo:TECNICO', 'Técnico / Técnica'],
  ['occupation:bo:TRABAJADOR_SOCIAL', 'Trabajador social / Trabajadora social'],
  ['occupation:bo:TRANSPORTISTA', 'Transportista'],
  ['occupation:bo:VENDEDOR', 'Vendedor / Vendedora'],
  ['occupation:bo:VETERINARIO', 'Veterinario / Veterinaria'],
  ['occupation:bo:ZAPATERO', 'Zapatero / Zapatera'],
  ['occupation:bo:OTRA', 'Otra ocupación'], // la salida escrita a mano
]);

conjunto('VS_BO_EMPLOYER', 'Empleadores', 'Empresas e instituciones registradas.');
export const EMPLEADOR = definir('VS_BO_EMPLOYER', [
  ['employer:bo:YPFB_ANDINA', 'YPFB Andina'],
  ['employer:bo:UAGRM', 'UAGRM (Universidad Autónoma Gabriel René Moreno)'],
  ['employer:bo:CRE', 'CRE (Cooperativa Rural de Electrificación)'],
  ['employer:bo:BANCO_UNION', 'Banco Unión'],
  ['employer:bo:ENTEL', 'Entel (Empresa Nacional de Telecomunicaciones)'],
  ['employer:bo:INDEPENDIENTE', 'Trabajo por mi cuenta (independiente)'],
  ['employer:bo:NEGOCIO_PROPIO', 'Tengo mi propio negocio'],
  ['employer:bo:SIN_EMPLEADOR', 'No estoy trabajando'],
  ['employer:bo:OTRA', 'Otra empresa (la escribo)'], // la salida escrita a mano
]);

/* ---- especialidades médicas ----------------------------------------------

   Las 63 de `VS_MEDICAL_SPECIALTY`, **con el código del catálogo real**
   (`seedsGenerales/modules/45_system_context.seeds.json`, patch v4.0.11) y en
   su mismo orden.

   El código no es decorativo, y por eso no se inventa acá. El alta profesional
   parte el catálogo en dos por código —`ESPECIALIDADES_ODONTOLOGICAS` en
   `register-practitioner.ts`— para que quien elige «Odontólogo» vea las suyas
   y no las 52 médicas. Con los `SP-*` inventados que había antes ese conjunto
   no acertaba ninguno, así que la rama odontológica del alta ofrecía una lista
   **vacía**: el simulador tenía especialidades y aun así no había ninguna que
   elegir. Es el mismo síntoma que el stakeholder ya había reportado contra la
   API real por otro motivo, y la lección es la de `faker/clinico.ts`: los
   códigos se eligen del catálogo, nunca se inventan.

   Las once odontológicas salen del listado del stakeholder
   (`markdown_convertidos/LISTA_DE_ESPECIALIDADES_ODONTOLOGICAS.md`), que trae
   diez; la que suma es `CIRUGIA_BUCOMAXILOFACIAL`, la única especialidad de
   residencia médica cuyo requisito es Odontología.
   -------------------------------------------------------------------------- */

conjunto('VS_MEDICAL_SPECIALTY', 'Especialidades médicas', 'Especialidades reconocidas.');
export const ESPECIALIDAD = definir('VS_MEDICAL_SPECIALTY', [
  ['MEDICINA_GENERAL', 'Medicina General', 'Primer contacto y seguimiento.'],
  ['MEDICINA_FAMILIAR', 'Medicina Familiar'],
  ['MEDICINA_INTERNA', 'Medicina Interna', 'Atención integral del adulto.'],
  ['PEDIATRIA', 'Pediatría', 'Salud de niñas, niños y adolescentes.'],
  ['GINECOLOGIA_OBSTETRICIA', 'Ginecología y Obstetricia', 'Salud de la mujer, embarazo y parto.'],
  ['CARDIOLOGIA', 'Cardiología', 'Diagnóstico y tratamiento de las enfermedades del corazón.'],
  ['NEUROLOGIA', 'Neurología', 'Enfermedades del sistema nervioso.'],
  ['DERMATOLOGIA', 'Dermatología', 'Enfermedades de la piel, cabello y uñas.'],
  ['ENDOCRINOLOGIA', 'Endocrinología', 'Diabetes, tiroides y hormonas.'],
  ['GASTROENTEROLOGIA', 'Gastroenterología', 'Aparato digestivo.'],
  ['NEUMOLOGIA', 'Neumología', 'Aparato respiratorio.'],
  ['NEFROLOGIA', 'Nefrología'],
  ['UROLOGIA', 'Urología', 'Aparato urinario y reproductor masculino.'],
  ['TRAUMATOLOGIA', 'Traumatología y Ortopedia', 'Lesiones y enfermedades del aparato locomotor.'],
  ['CIRUGIA_GENERAL', 'Cirugía General'],
  ['OFTALMOLOGIA', 'Oftalmología', 'Salud visual.'],
  ['OTORRINOLARINGOLOGIA', 'Otorrinolaringología'],
  ['PSIQUIATRIA', 'Psiquiatría', 'Salud mental.'],
  ['PSICOLOGIA_CLINICA', 'Psicología Clínica'],
  ['ONCOLOGIA', 'Oncología'],
  ['HEMATOLOGIA', 'Hematología'],
  ['REUMATOLOGIA', 'Reumatología'],
  ['INFECTOLOGIA', 'Infectología'],
  ['GERIATRIA', 'Geriatría'],
  ['ANESTESIOLOGIA', 'Anestesiología', 'Anestesia y manejo del dolor.'],
  ['RADIOLOGIA', 'Radiología e Imagenología'],
  ['PATOLOGIA_CLINICA', 'Patología Clínica'],
  ['MEDICINA_EMERGENCIA', 'Medicina de Emergencia'],
  ['MEDICINA_INTENSIVA', 'Medicina Intensiva'],
  ['NUTRICION', 'Nutrición y Dietética', 'Alimentación y metabolismo.'],
  ['ODONTOLOGIA', 'Odontología', 'Salud bucal.'], // odontológica
  ['FISIOTERAPIA', 'Fisioterapia y Rehabilitación', 'Rehabilitación física.'],
  ['ENFERMERIA', 'Enfermería'],
  ['BIOQUIMICA_CLINICA', 'Bioquímica Clínica'],
  ['OBSTETRICIA', 'Obstetricia'],
  ['MEDICINA_DEPORTIVA', 'Medicina Deportiva'],
  ['ANATOMIA_PATOLOGICA', 'Anatomía Patológica'],
  ['CIRUGIA_BUCOMAXILOFACIAL', 'Cirugía Bucomaxilofacial'], // odontológica
  ['CIRUGIA_PEDIATRICA', 'Cirugía Pediátrica'],
  ['MEDICINA_DEL_TRABAJO', 'Medicina del Trabajo'],
  ['MEDICINA_FISICA_REHABILITACION', 'Medicina Física y Rehabilitación'],
  ['SALUD_FAMILIAR_COMUNITARIA_INTERCULTURAL', 'Salud Familiar Comunitaria Intercultural'],
  ['CIRUGIA_ONCOLOGICA', 'Cirugía Oncológica'],
  ['COLOPROCTOLOGIA', 'Coloproctología'],
  ['CARDIOLOGIA_PEDIATRICA', 'Cardiología Pediátrica'],
  ['INFECTOLOGIA_PEDIATRICA', 'Infectología Pediátrica'],
  ['MEDICINA_DEL_DOLOR', 'Medicina del Dolor'],
  ['MEDICINA_MATERNO_FETAL', 'Medicina Materno Fetal'],
  ['NEONATOLOGIA', 'Neonatología'],
  ['NEUROLOGIA_PEDIATRICA', 'Neurología Pediátrica'],
  ['ONCOLOGIA_GINECOLOGICA', 'Oncología Ginecológica'],
  ['ONCOLOGIA_PEDIATRICA', 'Oncología Pediátrica'],
  ['ORTOPEDIA_PEDIATRICA', 'Ortopedia Pediátrica'],
  ['TERAPIA_INTENSIVA_PEDIATRICA', 'Terapia Intensiva Pediátrica'],
  ['ENDODONCIA', 'Endodoncia'], // odontológica
  ['ORTODONCIA', 'Ortodoncia'], // odontológica
  ['PERIODONCIA', 'Periodoncia'], // odontológica
  ['ESTETICA_DENTAL', 'Estética Dental'], // odontológica
  ['REHABILITACION_ORAL', 'Rehabilitación Oral'], // odontológica
  ['CIRUGIA_ORAL_MAXILOFACIAL', 'Cirugía Oral y Maxilofacial'], // odontológica
  ['ODONTOPEDIATRIA', 'Odontopediatría'], // odontológica
  ['IMPLANTOLOGIA_ORAL', 'Implantología Oral'], // odontológica
  ['ARMONIZACION_OROFACIAL', 'Armonización Orofacial'], // odontológica
]);

/* ---- demografía y contactos ---------------------------------------------- */

conjunto(
  'VS_ADMINISTRATIVE_GENDER',
  'Género administrativo',
  'Género con el que se registra la persona.',
);
export const GENERO = definir('VS_ADMINISTRATIVE_GENDER', [
  ['GEN-F', 'Femenino'],
  ['GEN-M', 'Masculino'],
  ['GEN-X', 'No binario'],
  ['GEN-U', 'No declarado'],
]);

conjunto('VS_BIRTH_SEX', 'Sexo al nacer', 'Sexo asignado al nacer.');
export const SEXO = definir('VS_BIRTH_SEX', [
  ['SEX-F', 'Femenino'],
  ['SEX-M', 'Masculino'],
  ['SEX-I', 'Intersexual'],
  ['SEX-U', 'Desconocido'],
]);

conjunto(
  'VS_RELATED_PERSON_RELATIONSHIP',
  'Parentesco',
  'Relación de una persona con el paciente.',
);
export const PARENTESCO = definir('VS_RELATED_PERSON_RELATIONSHIP', [
  ['RELATIONSHIP_MOTHER', 'Madre'],
  ['RELATIONSHIP_FATHER', 'Padre'],
  ['RELATIONSHIP_SPOUSE', 'Cónyuge'],
  ['RELATIONSHIP_CHILD', 'Hijo/a'],
  ['RELATIONSHIP_SIBLING', 'Hermano/a'],
  ['RELATIONSHIP_GUARDIAN', 'Tutor/a legal'],
  ['RELATIONSHIP_FRIEND', 'Amigo/a'],
  ['RELATIONSHIP_OTHER', 'Otro'],
]);

conjunto('VS_LANGUAGE', 'Idiomas', 'Idiomas de atención.');
export const IDIOMA = definir('VS_LANGUAGE', [
  ['LANG-ES', 'Español'],
  ['LANG-QU', 'Quechua'],
  ['LANG-AY', 'Aymara'],
  ['LANG-EN', 'Inglés'],
  ['LANG-PT', 'Portugués'],
]);

conjunto('VS_LANGUAGE_PROFICIENCY', 'Dominio del idioma', 'Nivel de dominio.');
export const DOMINIO_IDIOMA = definir('VS_LANGUAGE_PROFICIENCY', [
  ['PROF-NATIVO', 'Nativo'],
  ['PROF-AVANZADO', 'Avanzado'],
  ['PROF-BASICO', 'Básico'],
]);

conjunto('VS_NATIONALITY', 'Nacionalidad', 'País de nacionalidad.');
export const NACIONALIDAD = definir('VS_NATIONALITY', [
  ['NAT-BO', 'Boliviana'],
  ['NAT-AR', 'Argentina'],
  ['NAT-BR', 'Brasileña'],
  ['NAT-PE', 'Peruana'],
]);

conjunto('VS_BLOOD_GROUP', 'Grupo sanguíneo', 'Grupo ABO.');
export const GRUPO_ABO = definir('VS_BLOOD_GROUP', [
  ['ABO-O', 'O'],
  ['ABO-A', 'A'],
  ['ABO-B', 'B'],
  ['ABO-AB', 'AB'],
]);

conjunto('VS_RH_FACTOR', 'Factor Rh', 'Factor Rh.');
export const RH = definir('VS_RH_FACTOR', [
  ['RH-POS', 'Positivo'],
  ['RH-NEG', 'Negativo'],
]);

/* ---- estados genéricos --------------------------------------------------- */

conjunto(
  'VS_RECORD_STATUS',
  'Estados de registro',
  'Estados administrativos de personas y perfiles.',
);
export const ESTADO = definir('VS_RECORD_STATUS', [
  ['ST-ACTIVE', 'Activo'],
  ['ST-INACTIVE', 'Inactivo'],
  ['ST-PENDING', 'Pendiente'],
  ['ST-VERIFIED', 'Verificado'],
  ['ST-UNVERIFIED', 'Sin verificar'],
  ['ST-REJECTED', 'Rechazado'],
  ['ST-REVOKED', 'Revocado'],
  ['ST-SUSPENDED', 'Suspendido'],
  ['ST-ARCHIVED', 'Archivado'],
  ['ST-DRAFT', 'Borrador'],
  ['ST-PUBLISHED', 'Publicado'],
  ['ST-CLOSED', 'Cerrado'],
  ['ST-COMPLETED', 'Completado'],
  ['ST-IN-PROGRESS', 'En curso'],
  ['ST-LINKED', 'Vinculado'],
  ['ST-UNLINKED', 'Sin vincular'],
  ['ST-ALIVE', 'Con vida'],
  ['ST-DECEASED', 'Fallecido/a'],
  /**
   * Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2): el estado de
   * una orden que el médico decidió NO repetir — nace satisfecha por el
   * informe previo, sin ser facturable. Espejo del concepto dinámico
   * `SERVICE_REQUEST_SATISFIED_BY_PRIOR` (`SR_SATISFIED_BY_PRIOR`) que la API
   * siembra al arrancar.
   */
  ['ST-SATISFIED-BY-PRIOR', 'Satisfecha por informe previo'],
]);

/* ---- profesionales ------------------------------------------------------- */

conjunto('VS_PRACTITIONER_CATEGORY', 'Categoría profesional', 'Tipo de profesional sanitario.');
export const CATEGORIA_PROFESIONAL = definir('VS_PRACTITIONER_CATEGORY', [
  ['PC-MEDICO', 'Médico/a'],
  ['PC-ODONTOLOGO', 'Odontólogo/a'],
  ['PC-ENFERMERO', 'Enfermero/a'],
  ['PC-PSICOLOGO', 'Psicólogo/a'],
  ['PC-NUTRICIONISTA', 'Nutricionista'],
  ['PC-FISIOTERAPEUTA', 'Fisioterapeuta'],
]);

conjunto('VS_CREDENTIAL_TYPE', 'Tipos de credencial', 'Títulos y certificaciones.');
/*
 * Los rótulos son los que la API sirve en castellano, copiados de
 * `src/common/seed/terminology-designations.es.ts` del backend. Hasta el
 * 20/09/2026 la maqueta repetía el rótulo del **sistema de codificación**
 * —«Academic degree credential», «Specialty degree credential»—, que está en
 * inglés a propósito porque es el catálogo, no la interfaz: el perfil del
 * profesional los mostraba así, en inglés, contra la regla 29. La designación
 * en castellano existía en el catálogo desde siempre y es la que el cliente de
 * terminología pide con `lang`.
 */
export const TIPO_CREDENCIAL = definir('VS_CREDENTIAL_TYPE', [
  ['CREDENTIAL_TYPE_DEGREE', 'Título universitario'],
  ['CREDENTIAL_TYPE_DIPLOMA', 'Diplomado'],
  ['CREDENTIAL_TYPE_MASTER', 'Maestría'],
  ['CREDENTIAL_TYPE_DOCTORATE', 'Doctorado'],
  ['CREDENTIAL_TYPE_SPECIALTY', 'Título de especialidad'],
], 0);

conjunto('VS_JURISDICTION', 'Jurisdicciones', 'Ámbito de la matrícula.');
export const JURISDICCION = definir('VS_JURISDICTION', [
  ['JUR-BO', 'Nacional (Bolivia)'],
  ['JUR-SC', 'Departamental Santa Cruz'],
  ['JUR-LP', 'Departamental La Paz'],
]);

conjunto(
  'VS_AFFILIATION_TYPE',
  'Tipos de vínculo laboral',
  'Cómo se vincula el profesional con una organización.',
);
export const TIPO_VINCULO = definir('VS_AFFILIATION_TYPE', [
  ['AFF-PLANTA', 'Personal de planta'],
  ['AFF-CONSULTOR', 'Consultor/a'],
  ['AFF-CONSULTORIO', 'Consultorio propio'],
  ['AFF-HONORARIO', 'Honorario'],
]);

conjunto('VS_PRACTICE_SCOPE', 'Alcance de práctica', 'Qué habilita la matrícula.');
export const ALCANCE = definir('VS_PRACTICE_SCOPE', [
  ['SCOPE-GENERAL', 'Práctica general'],
  ['SCOPE-ESPECIALISTA', 'Práctica especializada'],
]);

/* ---- agenda ------------------------------------------------------------- */

conjunto('VS_APPOINTMENT_CHANNEL', 'Medio de atención', 'Por qué medio ocurre la consulta.');
export const CANAL = definir('VS_APPOINTMENT_CHANNEL', [
  ['CH-PRESENCIAL', 'Presencial'],
  ['CH-TELECONSULTA', 'Teleconsulta'],
  ['CH-DOMICILIO', 'A domicilio'],
]);

conjunto('VS_ACTIVITY_TYPE', 'Tipos de actividad', 'Qué se agenda en un cupo.');
export const ACTIVIDAD = definir('VS_ACTIVITY_TYPE', [
  ['ACT-CONSULTA', 'Consulta médica'],
  ['ACT-CONTROL', 'Control'],
  ['ACT-PROCEDIMIENTO', 'Procedimiento'],
  ['ACT-TELECONSULTA', 'Teleconsulta'],
  ['ACT-EXAMEN', 'Examen'],
  ['ACT-FOLLOW-UP', 'Reconsulta', 'Cita para continuar la atención de una consulta previa.'],
]);

conjunto('VS_EXCEPTION_TYPE', 'Tipos de bloqueo', 'Por qué no se atiende.');
export const TIPO_BLOQUEO = definir('VS_EXCEPTION_TYPE', [
  ['EXC-VACACIONES', 'Vacaciones'],
  ['EXC-CONGRESO', 'Congreso'],
  ['EXC-FERIADO', 'Feriado'],
  ['EXC-PERSONAL', 'Motivo personal'],
  ['EXC-CIRUGIA', 'Cirugía programada'],
]);

conjunto('VS_APPOINTMENT_TYPE', 'Tipos de cita', 'Cómo se clasifica la cita.');
export const TIPO_CITA = definir('VS_APPOINTMENT_TYPE', [
  ['APT-PRIMERA', 'Primera consulta'],
  ['APT-CONTROL', 'Control'],
  ['APT-URGENCIA', 'Urgencia'],
  ['APT-RECONSULTA', 'Reconsulta', 'Cita vinculada a su reserva y encuentro de origen.'],
]);

conjunto('VS_BOOKING_STATUS', 'Estados de reserva', 'Ciclo de vida de una reserva.');
export const ESTADO_RESERVA = definir('VS_BOOKING_STATUS', [
  ['BK-REQUESTED', 'Solicitada'],
  ['BK-CONFIRMED', 'Confirmada'],
  ['BK-CHECKED-IN', 'Paciente llegó'],
  ['BK-IN-PROGRESS', 'En consulta'],
  ['BK-COMPLETED', 'Atendida'],
  ['BK-CANCELLED', 'Cancelada'],
  ['BK-REJECTED', 'Rechazada'],
  ['BK-NO-SHOW', 'No se presentó'],
]);

/* ---- clínica ------------------------------------------------------------- */

conjunto('VS_CONDITION_CLINICAL_STATUS', 'Estado clínico', 'Estado clínico de una condición.');
export const ESTADO_CONDICION = definir('VS_CONDITION_CLINICAL_STATUS', [
  ['COND-ACTIVE', 'Activa'],
  ['COND-REMISSION', 'En remisión'],
  ['COND-RESOLVED', 'Resuelta'],
  ['COND-RECURRENCE', 'Recurrente'],
]);

/* Los tres catálogos del diagnóstico que faltaban, con **los códigos del
   backend** (`clinical.concepts.ts`) y no con unos inventados: el bloque de
   diagnóstico traduce por código —`ETIQUETAS_DE_CURSO`, `ETIQUETAS_DE_CATEGORIA`,
   `ETIQUETAS_DE_LATERALIDAD`—, así que un código distinto deja el selector
   mostrando el `display` en inglés. Es la misma clase de defecto que ya mordió
   con los departamentos, las especialidades y las ocupaciones. */

conjunto(
  'VS_CONDITION_CLINICAL_COURSE',
  'Curso clínico del diagnóstico',
  'Si la condición es aguda —con resolución esperada— o crónica —seguimiento continuo—. Eje distinto del estado clínico.',
);
export const CURSO_CLINICO = definir('VS_CONDITION_CLINICAL_COURSE', [
  ['COND_COURSE_ACUTE', 'Aguda'],
  ['COND_COURSE_CHRONIC', 'Crónica'],
  ['COND_COURSE_SUBACUTE', 'Subaguda'],
  ['COND_COURSE_RECURRENT', 'Recurrente'],
  ['COND_COURSE_UNKNOWN', 'Sin determinar'],
]);

conjunto(
  'VS_CONDITION_CATEGORY',
  'Categoría del diagnóstico',
  'Si el registro es un diagnóstico del encuentro o un problema de la lista.',
);
export const CATEGORIA_CONDICION = definir('VS_CONDITION_CATEGORY', [
  ['COND_DIAGNOSIS', 'Diagnóstico del encuentro'],
  ['COND_PROBLEM', 'Problema de la lista'],
]);

conjunto('VS_CONDITION_LATERALITY', 'Lateralidad', 'Lado del cuerpo afectado, cuando aplica.');
export const LATERALIDAD = definir('VS_CONDITION_LATERALITY', [
  ['COND_LAT_LEFT', 'Izquierda'],
  ['COND_LAT_RIGHT', 'Derecha'],
  ['COND_LAT_BILATERAL', 'Bilateral'],
]);

conjunto('VS_CONDITION_VERIFICATION', 'Verificación diagnóstica', 'Certeza del diagnóstico.');
export const VERIFICACION_DX = definir('VS_CONDITION_VERIFICATION', [
  ['DXV-CONFIRMED', 'Confirmado'],
  ['DXV-PROVISIONAL', 'Provisional'],
  ['DXV-DIFFERENTIAL', 'Diferencial'],
  ['DXV-REFUTED', 'Descartado'],
]);

conjunto('VS_SEVERITY', 'Severidad', 'Gravedad de una condición o reacción.');
export const SEVERIDAD = definir('VS_SEVERITY', [
  ['SEV-MILD', 'Leve'],
  ['SEV-MODERATE', 'Moderada'],
  ['SEV-SEVERE', 'Grave'],
]);

/* Los catálogos de la alergia.
   ⚠️ **Provisionales, y declarados como tales.** El backend tiene cinco
   conceptos sueltos de alergia (`ALG_ACTIVE`, `ALG_TYPE`, `ALG_HIGH`…) y
   **ningún binding de enum dinámico**: `dynamic-enum-catalog.ts` no declara un
   solo `target` de `clinical.allergy_intolerances.*`. Sin catálogo no hay
   formulario, así que acá se acuñan los mínimos para que la maqueta funcione,
   con el mismo criterio que `bo-occupations.catalog.ts`: cierran hoy el campo
   sin fingir que son un catálogo clínico publicado. El real —un subconjunto
   SNOMED, o el que el equipo clínico apruebe— es P26. */

conjunto('VS_ALLERGY_TYPE', 'Tipo', 'Si es alergia inmunológica o intolerancia.');
export const TIPO_ALERGIA = definir('VS_ALLERGY_TYPE', [
  ['ALG_TYPE', 'Alergia'],
  ['ALG_TYPE_INTOLERANCE', 'Intolerancia'],
]);

conjunto(
  'VS_ALLERGY_MANIFESTATION',
  'Manifestación',
  'Qué le pasó a la persona. Provisional: ver P26.',
);
export const MANIFESTACION = definir('VS_ALLERGY_MANIFESTATION', [
  ['ALG_MANIF_URTICARIA', 'Urticaria'],
  ['ALG_MANIF_ANGIOEDEMA', 'Angioedema'],
  ['ALG_MANIF_ANAPHYLAXIS', 'Anafilaxia'],
  ['ALG_MANIF_BRONCHOSPASM', 'Broncoespasmo'],
  ['ALG_MANIF_RASH', 'Erupción cutánea'],
  ['ALG_MANIF_PRURITUS', 'Prurito'],
  ['ALG_MANIF_NAUSEA', 'Náuseas o vómitos'],
  ['ALG_MANIF_DIARRHEA', 'Diarrea'],
]);

conjunto(
  'VS_ALLERGY_SUBSTANCE',
  'Sustancia',
  'Alérgenos que no son medicamentos. Los medicamentos salen del vademécum.',
);
export const SUSTANCIA_ALERGENO = definir('VS_ALLERGY_SUBSTANCE', [
  ['ALG_SUB_PEANUT', 'Maní'],
  ['ALG_SUB_SHELLFISH', 'Mariscos'],
  ['ALG_SUB_EGG', 'Huevo'],
  ['ALG_SUB_MILK', 'Leche de vaca'],
  ['ALG_SUB_GLUTEN', 'Gluten'],
  ['ALG_SUB_LATEX', 'Látex'],
  ['ALG_SUB_DUST', 'Ácaros del polvo'],
  ['ALG_SUB_POLLEN', 'Polen'],
  ['ALG_SUB_HYMENOPTERA', 'Picadura de abeja o avispa'],
  ['ALG_SUB_IODINE', 'Contraste yodado'],
]);

conjunto('VS_ALLERGY_CATEGORY', 'Categoría de alergia', 'Qué clase de alérgeno.');
export const CATEGORIA_ALERGIA = definir('VS_ALLERGY_CATEGORY', [
  ['ALG-MEDICATION', 'Medicamento'],
  ['ALG-FOOD', 'Alimento'],
  ['ALG-ENVIRONMENT', 'Ambiental'],
]);

conjunto('VS_ALLERGY_CRITICALITY', 'Criticidad', 'Riesgo de la alergia.');
export const CRITICIDAD = definir('VS_ALLERGY_CRITICALITY', [
  ['CRIT-LOW', 'Baja'],
  ['CRIT-HIGH', 'Alta'],
]);

conjunto('VS_ENCOUNTER_CLASS', 'Clase de encuentro', 'Ambulatorio, urgencia, internación.');
export const CLASE_ENCUENTRO = definir('VS_ENCOUNTER_CLASS', [
  ['ENC-AMB', 'Ambulatorio'],
  ['ENC-EMER', 'Urgencia'],
  ['ENC-IMP', 'Internación'],
  ['ENC-VIRTUAL', 'Teleconsulta'],
]);

conjunto('VS_ENCOUNTER_STATUS', 'Estado del encuentro', 'Ciclo de vida del encuentro.');
export const ESTADO_ENCUENTRO = definir('VS_ENCOUNTER_STATUS', [
  ['ENCST-PLANNED', 'Planificado'],
  ['ENCST-IN-PROGRESS', 'En curso'],
  ['ENCST-FINISHED', 'Finalizado'],
  ['ENCST-CANCELLED', 'Cancelado'],
]);

conjunto('VS_MEDICATION_REQUEST_STATUS', 'Estado de la receta', 'Estado de una prescripción.');
export const ESTADO_RECETA = definir('VS_MEDICATION_REQUEST_STATUS', [
  ['RX-ACTIVE', 'Vigente'],
  ['RX-COMPLETED', 'Completada'],
  ['RX-CANCELLED', 'Cancelada'],
  ['RX-DRAFT', 'Borrador'],
]);

conjunto('VS_OBSERVATION_CODE', 'Signos vitales y mediciones', 'Códigos de observación.');
export const OBSERVACION = definir('VS_OBSERVATION_CODE', [
  ['OBS-BP-SYS', 'Presión arterial sistólica'],
  ['OBS-BP-DIA', 'Presión arterial diastólica'],
  ['OBS-HR', 'Frecuencia cardíaca'],
  ['OBS-TEMP', 'Temperatura corporal'],
  ['OBS-WEIGHT', 'Peso'],
  ['OBS-HEIGHT', 'Talla'],
  ['OBS-BMI', 'Índice de masa corporal'],
  ['OBS-GLUCOSE', 'Glucemia en ayunas'],
  ['OBS-SPO2', 'Saturación de oxígeno'],
  ['OBS-HBA1C', 'Hemoglobina glicosilada'],
]);

/* ---- lo que la observación, el plan y el documento necesitan para su alta ---
   Los tres bloques nuevos del expediente —observación, plan de cuidados y
   documento— llenan columnas `*_concept_id` que el catálogo real todavía no
   publica con un binding declarado. Se acuñan acá con el mismo criterio que los
   de alergia: cierran hoy el campo sin fingir que son un catálogo clínico
   aprobado. El real —UCUM para las unidades, un subconjunto SNOMED/LOINC para
   el resto— sigue siendo P26. */

conjunto('VS_OBSERVATION_UNIT', 'Unidad de medida', 'Unidades de una medición clínica.');
export const UNIDAD_OBSERVACION = definir('VS_OBSERVATION_UNIT', [
  ['OBSU-MMHG', 'mmHg'],
  ['OBSU-BPM', 'latidos por minuto'],
  ['OBSU-CELSIUS', '°C'],
  ['OBSU-KG', 'kg'],
  ['OBSU-CM', 'cm'],
  ['OBSU-PERCENT', '%'],
  ['OBSU-MGDL', 'mg/dL'],
  ['OBSU-KGM2', 'kg/m²'],
]);

conjunto('VS_OBSERVATION_CATEGORY', 'Categoría de observación', 'De dónde sale la medición.');
export const CATEGORIA_OBSERVACION = definir('VS_OBSERVATION_CATEGORY', [
  ['OBSC-VITALS', 'Signos vitales'],
  ['OBSC-EXAM', 'Examen físico'],
  ['OBSC-LAB', 'Laboratorio'],
  ['OBSC-SURVEY', 'Cuestionario'],
]);

conjunto('VS_OBSERVATION_INTERPRETATION', 'Interpretación', 'Cómo se lee el valor.');
export const INTERPRETACION = definir('VS_OBSERVATION_INTERPRETATION', [
  ['OBSI-NORMAL', 'Dentro de lo esperado'],
  ['OBSI-HIGH', 'Por encima de lo esperado'],
  ['OBSI-LOW', 'Por debajo de lo esperado'],
  ['OBSI-CRITICAL', 'Valor crítico'],
]);

conjunto('VS_OBSERVATION_PERFORMER_TYPE', 'Tipo de ejecutante', 'Quién tomó la medición.');
export const TIPO_DE_EJECUTANTE = definir('VS_OBSERVATION_PERFORMER_TYPE', [
  ['OBSP-PRACTITIONER', 'Profesional que atiende'],
  ['OBSP-LAB', 'Laboratorio'],
  ['OBSP-DEVICE', 'Dispositivo'],
  ['OBSP-PATIENT', 'La propia persona'],
]);

conjunto('VS_CARE_PLAN_INTENT', 'Intención del plan', 'Qué clase de plan es.');
export const INTENCION_DEL_PLAN = definir('VS_CARE_PLAN_INTENT', [
  ['CP-INTENT-PROPOSAL', 'Propuesta'],
  ['CP-INTENT-PLAN', 'Plan'],
  ['CP-INTENT-ORDER', 'Indicación'],
]);

conjunto('VS_CARE_PLAN_ACTIVITY', 'Actividad del plan', 'Qué clase de paso es.');
export const ACTIVIDAD_DEL_PLAN = definir('VS_CARE_PLAN_ACTIVITY', [
  ['CP-ACT-CONTROL', 'Control clínico'],
  ['CP-ACT-STUDY', 'Estudio o laboratorio'],
  ['CP-ACT-TREATMENT', 'Tratamiento'],
  ['CP-ACT-EDUCATION', 'Educación de la persona'],
  ['CP-ACT-REFERRAL', 'Derivación'],
]);

conjunto('VS_DOCUMENT_CATEGORY', 'Categoría documental', 'Qué clase de papel es.');
export const CATEGORIA_DOCUMENTAL = definir('VS_DOCUMENT_CATEGORY', [
  ['DOC-CAT-REPORT', 'Informe clínico'],
  ['DOC-CAT-LAB', 'Resultado de laboratorio'],
  ['DOC-CAT-IMAGING', 'Estudio de imagen'],
  ['DOC-CAT-CONSENT', 'Consentimiento informado'],
  ['DOC-CAT-CERTIFICATE', 'Certificado'],
  ['DOC-CAT-DISCHARGE', 'Epicrisis o alta'],
  ['DOC-CAT-EXTERNAL', 'Documento externo'],
]);

conjunto('VS_ROUTE', 'Vía de administración', 'Vía por la que se administra.');
export const VIA = definir('VS_ROUTE', [
  ['ROUTE-ORAL', 'Vía oral'],
  ['ROUTE-IM', 'Intramuscular'],
  ['ROUTE-IV', 'Intravenosa'],
  ['ROUTE-TOPICAL', 'Tópica'],
  ['ROUTE-INH', 'Inhalatoria'],
]);

conjunto('VS_DOSE_UNIT', 'Unidad de dosis', 'Unidades de dosis.');
export const UNIDAD = definir('VS_DOSE_UNIT', [
  ['UNIT-MG', 'mg'],
  ['UNIT-ML', 'ml'],
  ['UNIT-TAB', 'comprimido'],
  ['UNIT-UI', 'UI'],
  ['UNIT-GOTAS', 'gotas'],
]);

conjunto(
  'VS_SERVICE_REQUEST_CATEGORY',
  'Categoría de orden',
  'Laboratorio, imagen, interconsulta.',
);
export const CATEGORIA_ORDEN = definir('VS_SERVICE_REQUEST_CATEGORY', [
  ['SRQ-LAB', 'Laboratorio'],
  ['SRQ-IMAGING', 'Imagenología'],
  ['SRQ-REFERRAL', 'Interconsulta'],
  ['SRQ-PROCEDURE', 'Procedimiento'],
  ['SRQ-OTHER', 'Otro', 'Orden de análisis que no pertenece a laboratorio ni imagenología.'],
]);

conjunto('VS_PRIORITY', 'Prioridad', 'Prioridad de una orden.');
export const PRIORIDAD = definir('VS_PRIORITY', [
  ['PRI-ROUTINE', 'Rutina'],
  ['PRI-URGENT', 'Urgente'],
  ['PRI-STAT', 'Inmediata'],
]);

conjunto('VS_DIAGNOSTIC_STUDY', 'Estudios diagnósticos', 'Estudios de laboratorio e imagen.');
export const ESTUDIO = definir('VS_DIAGNOSTIC_STUDY', [
  ['STUDY-HEMOGRAMA', 'Hemograma completo'],
  ['STUDY-GLUCOSA', 'Glucosa en ayunas'],
  ['STUDY-PERFIL-LIPIDICO', 'Perfil lipídico'],
  ['STUDY-TSH', 'TSH'],
  ['STUDY-ORINA', 'Examen general de orina'],
  ['STUDY-RX-TORAX', 'Radiografía de tórax'],
  ['STUDY-ECO-ABD', 'Ecografía abdominal'],
  ['STUDY-ECG', 'Electrocardiograma'],
  ['STUDY-RMN-RODILLA', 'Resonancia de rodilla'],
  ['STUDY-TAC-CRANEO', 'Tomografía de cráneo'],
  /* Un catálogo de diez estudios dejaba a cada centro con cinco, o sea siempre
     por debajo del umbral con el que la ficha muestra su buscador y su
     paginador: la sección se veía entera y sus controles no aparecían nunca.
     Un laboratorio real ofrece decenas. */
  ['STUDY-CREATININA', 'Creatinina en sangre'],
  ['STUDY-UREA', 'Urea en sangre'],
  ['STUDY-HBA1C', 'Hemoglobina glicosilada'],
  ['STUDY-COAGULACION', 'Tiempo de coagulación'],
  ['STUDY-HEPATICO', 'Perfil hepático'],
  ['STUDY-COPROLOGICO', 'Coproparasitológico'],
  ['STUDY-CULTIVO', 'Urocultivo con antibiograma'],
  ['STUDY-VITAMINA-D', 'Vitamina D'],
  ['STUDY-MAMOGRAFIA', 'Mamografía bilateral'],
  ['STUDY-ECO-OBSTETRICA', 'Ecografía obstétrica'],
  ['STUDY-RX-COLUMNA', 'Radiografía de columna'],
  ['STUDY-TAC-ABDOMEN', 'Tomografía de abdomen'],
  ['STUDY-RMN-CEREBRO', 'Resonancia de cerebro'],
  ['STUDY-DENSITOMETRIA', 'Densitometría ósea'],
]);

conjunto('VS_IMMUNIZATION', 'Vacunas', 'Vacunas del esquema.');
export const VACUNA = definir('VS_IMMUNIZATION', [
  ['VAC-INFLUENZA', 'Influenza estacional'],
  ['VAC-COVID', 'COVID-19'],
  ['VAC-TETANOS', 'Antitetánica'],
  ['VAC-HEPB', 'Hepatitis B'],
]);

conjunto('VS_PROCEDURE', 'Procedimientos', 'Procedimientos clínicos y quirúrgicos.');
export const PROCEDIMIENTO = definir('VS_PROCEDURE', [
  ['PROC-APENDICECTOMIA', 'Apendicectomía laparoscópica'],
  ['PROC-COLECISTECTOMIA', 'Colecistectomía laparoscópica'],
  ['PROC-ARTROSCOPIA', 'Artroscopia de rodilla'],
  ['PROC-CESAREA', 'Cesárea'],
  ['PROC-ENDOSCOPIA', 'Endoscopia digestiva alta'],
  ['PROC-SUTURA', 'Sutura de herida'],
  ['PROC-INFILTRACION', 'Infiltración articular'],
]);

/* ---- diagnósticos (CIE-10 abreviado, también en el glosario) ------------- */

conjunto('VS_CONDITION_CODE', 'Diagnósticos (CIE-10)', 'Códigos de diagnóstico.');
export const DIAGNOSTICO = definir('VS_CONDITION_CODE', [
  [
    'I10',
    'Hipertensión arterial esencial',
    'Presión arterial persistentemente elevada sin causa secundaria identificada.',
  ],
  [
    'E11',
    'Diabetes mellitus tipo 2',
    'Trastorno metabólico crónico con hiperglucemia por resistencia a la insulina.',
  ],
  ['E78.5', 'Dislipidemia', 'Alteración de los niveles de lípidos en sangre.'],
  ['J45', 'Asma bronquial', 'Enfermedad inflamatoria crónica de las vías respiratorias.'],
  ['M54.5', 'Lumbalgia', 'Dolor en la región lumbar.'],
  ['K21.0', 'Enfermedad por reflujo gastroesofágico', 'Retorno del contenido gástrico al esófago.'],
  [
    'F41.1',
    'Trastorno de ansiedad generalizada',
    'Ansiedad y preocupación excesivas y persistentes.',
  ],
  ['E03.9', 'Hipotiroidismo', 'Producción insuficiente de hormona tiroidea.'],
  ['N39.0', 'Infección urinaria', 'Infección del tracto urinario.'],
  [
    'J06.9',
    'Infección respiratoria aguda',
    'Infección aguda de las vías respiratorias superiores.',
  ],
  ['M17', 'Gonartrosis', 'Artrosis de la rodilla.'],
  ['G43', 'Migraña', 'Cefalea primaria recurrente.'],
  ['E66', 'Obesidad', 'Exceso de grasa corporal.'],
  ['D50', 'Anemia ferropénica', 'Anemia por déficit de hierro.'],
  ['L20', 'Dermatitis atópica', 'Enfermedad inflamatoria crónica de la piel.'],
]);

/* ---- medicamentos (vademécum abreviado) ---------------------------------- */

conjunto('VS_MEDICATION', 'Medicamentos', 'Vademécum.');
export const MEDICAMENTO = definir('VS_MEDICATION', [
  ['MED-ENALAPRIL', 'Enalapril 10 mg comprimidos', 'Inhibidor de la ECA. Antihipertensivo.'],
  ['MED-LOSARTAN', 'Losartán 50 mg comprimidos', 'Antagonista del receptor de angiotensina II.'],
  ['MED-METFORMINA', 'Metformina 850 mg comprimidos', 'Antidiabético oral.'],
  ['MED-ATORVASTATINA', 'Atorvastatina 20 mg comprimidos', 'Hipolipemiante.'],
  ['MED-AMOXICILINA', 'Amoxicilina 500 mg cápsulas', 'Antibiótico betalactámico.'],
  ['MED-IBUPROFENO', 'Ibuprofeno 400 mg comprimidos', 'Antiinflamatorio no esteroideo.'],
  ['MED-PARACETAMOL', 'Paracetamol 500 mg comprimidos', 'Analgésico y antipirético.'],
  ['MED-OMEPRAZOL', 'Omeprazol 20 mg cápsulas', 'Inhibidor de la bomba de protones.'],
  ['MED-SALBUTAMOL', 'Salbutamol 100 mcg inhalador', 'Broncodilatador.'],
  ['MED-LEVOTIROXINA', 'Levotiroxina 50 mcg comprimidos', 'Hormona tiroidea.'],
  ['MED-SERTRALINA', 'Sertralina 50 mg comprimidos', 'Antidepresivo ISRS.'],
  ['MED-LORATADINA', 'Loratadina 10 mg comprimidos', 'Antihistamínico.'],
  ['MED-SULFATO-FERROSO', 'Sulfato ferroso 300 mg comprimidos', 'Suplemento de hierro.'],
  ['MED-CIPROFLOXACINO', 'Ciprofloxacino 500 mg comprimidos', 'Antibiótico quinolona.'],
  ['MED-INSULINA-NPH', 'Insulina NPH 100 UI/ml', 'Insulina de acción intermedia.'],
]);

/**
 * Frecuencia por defecto del medicamento (C-20 / H4, reparto de Ender 2026-09-20).
 *
 * `property_code: 'default_frequency'` es una **extensión declarada del
 * simulador** (regla 65): el vademécum real
 * (`mantra-core-health-api/src/common/seed/data/vademecum/vademecum.dataset.json`)
 * sólo publica `dose_forms`, `strengths`, `routes`, `therapeutic_class` y
 * `atc_route_variants` — cero apariciones de `frequency`, verificado con
 * `git grep -n "dose_forms\|strengths\|therapeutic_class" origin/dev` sobre
 * `mantra-core-health-api` el 2026-09-20/21. La clave se acordó con Justin
 * (que la consume en `patient-chart/medication-block/**`) para su H4.
 *
 * Mismo camino que B-13 (`mantra-core-health-api/REGISTRO-DEFECTOS.md:101`):
 * **dato de desarrollo sin fuente autoritativa, no apto para uso clínico ni
 * producción.** Quién debe proveer la posología real —negocio + un
 * profesional prescriptor, nunca quien escribe el simulador— queda registrado
 * como Q-D6 en `docs/trabajo/2026-09-20-ender-contratos-panel/PLAN.md`.
 *
 * Deliberadamente en ALGUNOS medicamentos y no en todos (H4.S3.M1): la ficha
 * de un medicamento sin esta propiedad tiene que seguir andando en la receta.
 * `MED-INSULINA-NPH` la lleva con un `value_json` del tipo equivocado (un
 * número en vez de texto) a propósito, para ejercitar el caso inválido de
 * H4.S3.M2 sin inventar un medicamento que no exista en el catálogo.
 */
declararPropiedades('MED-PARACETAMOL', {
  default_frequency: 'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
});
declararPropiedades('MED-IBUPROFENO', {
  default_frequency: 'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
});
declararPropiedades('MED-OMEPRAZOL', {
  default_frequency: 'Una vez al día — dato sintético de desarrollo, no apto para uso clínico',
});
declararPropiedades('MED-AMOXICILINA', {
  default_frequency: 'Cada 8 horas — dato sintético de desarrollo, no apto para uso clínico',
});
declararPropiedades('MED-METFORMINA', {
  default_frequency: 'Cada 12 horas — dato sintético de desarrollo, no apto para uso clínico',
});
// `value_json` mal formado a propósito (número, no texto): ver el comentario de arriba.
declararPropiedades('MED-INSULINA-NPH', { default_frequency: 42 });

/* ---- organizaciones ------------------------------------------------------ */

conjunto('VS_ORGANIZATION_TYPE', 'Tipos de organización', 'Clínica, hospital, laboratorio…');
export const TIPO_ORGANIZACION = definir('VS_ORGANIZATION_TYPE', [
  ['ORG-CLINICA', 'Clínica'],
  ['ORG-HOSPITAL', 'Hospital'],
  ['ORG-LABORATORIO', 'Laboratorio'],
  ['ORG-FARMACIA', 'Farmacia'],
  ['ORG-ASEGURADORA', 'Aseguradora'],
  ['ORG-CENTRO-IMAGEN', 'Centro de imagenología'],
  ['ORG-CONSULTORIO', 'Consultorio'],
]);

// El `display` en inglés técnico es a propósito: es lo que devuelve el
// catálogo real (`legal-entity-type` en `dynamic-enum-catalog.ts` de la API).
// La etiqueta que ve la persona sale de `legal-entity-types.dictionary.ts`,
// por código — este conjunto sólo simula los VALORES y sus `conceptId`.
conjunto(
  'VS_LEGAL_ENTITY_TYPE',
  'Forma societaria',
  'Figura jurídica de la organización, por país.',
);
export const TIPO_SOCIETARIO = definir('VS_LEGAL_ENTITY_TYPE', [
  ['UNIPERSONAL', 'Sole proprietorship'],
  ['SRL', 'Limited liability company (S.R.L.)'],
  ['LTDA', 'Limited company (Ltda.)'],
  ['SA', 'Corporation (S.A.)'],
  ['SOCIEDAD_COLECTIVA', 'General partnership'],
  ['COMANDITA_SIMPLE', 'Limited partnership'],
  ['COMANDITA_ACCIONES', 'Partnership limited by shares'],
  ['SUCURSAL_EXTRANJERA', 'Branch of a foreign company'],
  ['BR_LTDA', 'Sociedade Limitada (Brazil)'],
  ['BR_SA', 'Sociedade Anônima (Brazil)'],
  ['BR_MEI', 'Microempreendedor Individual (Brazil)'],
  ['BR_EI', 'Empresário Individual (Brazil)'],
  ['BR_SLU', 'Sociedade Limitada Unipessoal (Brazil)'],
  ['BR_FILIAL_EST', 'Foreign company branch (Brazil)'],
  ['US_LLC', 'Limited Liability Company (US)'],
  ['US_CORP', 'Corporation (US)'],
  ['US_SOLE_PROP', 'Sole Proprietorship (US)'],
  ['US_LLP', 'Limited Liability Partnership (US)'],
  ['US_BRANCH', 'Foreign company branch (US)'],
  ['AR_SAS', 'Sociedad por Acciones Simplificada (Argentina)'],
  ['MX_S_RL', 'Sociedad de Responsabilidad Limitada (Mexico)'],
]);

conjunto('VS_FACILITY', 'Establecimientos de salud', 'Padrón de establecimientos.');
export const ESTABLECIMIENTO = definir('VS_FACILITY', [
  ['FAC-OLIVOS', 'Clínica Los Olivos'],
  ['FAC-SANLUCAS', 'Hospital San Lucas'],
  ['FAC-JAPONES', 'Hospital Japonés'],
  ['FAC-FOIANINI', 'Clínica Foianini'],
  ['FAC-LAB-CENTRAL', 'Laboratorio Central'],
  ['FAC-IMAGEN-SUR', 'Centro de Imagen Sur'],
]);

conjunto('VS_ROLE', 'Cargos', 'Cargos dentro de una organización.');
export const CARGO = definir('VS_ROLE', [
  ['ROLE-MEDICO', 'Médico/a de planta'],
  ['ROLE-JEFE', 'Jefe/a de servicio'],
  ['ROLE-RESIDENTE', 'Residente'],
  ['ROLE-ADMIN', 'Administrativo/a'],
  ['ROLE-ENFERMERIA', 'Enfermería'],
]);

/* ---- seguros ------------------------------------------------------------- */

conjunto('VS_CLAIM_STATUS', 'Estado de solicitud de seguro', 'Ciclo de una solicitud.');
export const ESTADO_SOLICITUD = definir('VS_CLAIM_STATUS', [
  ['CLM-SUBMITTED', 'Enviada'],
  ['CLM-IN-REVIEW', 'En revisión'],
  ['CLM-APPROVED', 'Aprobada'],
  ['CLM-PARTIAL', 'Aprobada parcialmente'],
  ['CLM-REJECTED', 'Rechazada'],
  ['CLM-PAID', 'Pagada'],
]);

/* ---- glosario ------------------------------------------------------------
   El glosario médico ya no vive acá. Hasta el 2026-09-11 este archivo
   inventaba siete categorías (`glossary-diseases`, `glossary-symptoms`…) con
   códigos que el backend no tiene: la pantalla filtra por el prefijo canónico
   `glossary-category-*` y las descartaba todas, así que la maqueta nunca
   mostró una definición. Ahora lo sirve `fixtures/glosario.ts`, que indexa el
   catálogo curado del backend — 12 categorías, 15 etiquetas y 69 términos. */

/* ---- Estados de un caso de verificación de identidad ---------------------- *
   Los nueve que `identity_assurance` emite, con el código **tal como llega al
   catálogo**: `identity_assurance:CASE_*`. El módulo los declara internamente
   como `IDA_CASE_*`, pero ese código nunca sale — ver el comentario de cabecera
   de `features/identity-verification/case-status.ts`.

   Sin estos nueve, `CaseStatusCatalog` busca por el prefijo, no encuentra nada,
   y las dos pantallas que muestran un trámite pintan «Desconocido» en todas las
   filas sin romper nada. Es exactamente lo que se veía antes del 2026-09-10. */
conjunto(
  'VS_IDENTITY_CASE_STATUS',
  'Estados de un caso de verificación',
  'El ciclo de vida de un trámite de identidad.',
);

export const ESTADO_DE_CASO = definir('VS_IDENTITY_CASE_STATUS', [
  ['identity_assurance:CASE_OPEN', 'Case open'],
  ['identity_assurance:CASE_CHECKS_PENDING', 'Case checks pending'],
  ['identity_assurance:CASE_IN_VERIFICATION', 'Case in verification'],
  ['identity_assurance:CASE_MANUAL_REVIEW', 'Case in manual review'],
  ['identity_assurance:CASE_AT_RISK', 'Case at risk'],
  ['identity_assurance:CASE_VERIFIED', 'Case verified'],
  ['identity_assurance:CASE_ASSERTED', 'Case asserted'],
  ['identity_assurance:CASE_REJECTED', 'Case rejected'],
  ['identity_assurance:CASE_REVOKED', 'Case revoked'],
  ['identity_assurance:CASE_EXPIRED', 'Case expired'],
]);

/* ---- alta pública de laboratorio y centro de imagenología (BR-09) --------
   Los cuatro catálogos que el alta lee por `dynamic-enums` y resuelve **por
   código** (`registro-compartido/alta-de-centro-diagnostico.ts`). Los códigos
   son los que publica la API —`diagnostic_units.concepts.ts`,
   `CONCEPTS.COUNTRY_BO` y `PROF.JURISDICTION_*`—: con cualquier otro, el alta
   de la maqueta frenaba en «No pudimos cargar los catálogos del alta» antes de
   subir un solo PDF. */

conjunto('VS_DIAGNOSTIC_UNIT_TYPE', 'Tipo de unidad diagnóstica', 'Laboratorio clínico o centro de imagenología.');
export const DIAGNOSTIC_UNIT_TYPE = definir('VS_DIAGNOSTIC_UNIT_TYPE', [
  ['DU_TYPE_LAB', 'Laboratorio clínico'],
  ['DU_TYPE_IMAGING', 'Centro de imagenología'],
]);

conjunto('VS_DIAGNOSTIC_MODALITY', 'Modalidad diagnóstica', 'Las modalidades que un alta puede declarar.');
export const DIAGNOSTIC_MODALITY = definir('VS_DIAGNOSTIC_MODALITY', [
  ['DU_MODALITY_LAB', 'Laboratorio'],
  ['DU_MODALITY_XRAY', 'Rayos X'],
  ['DU_MODALITY_ULTRASOUND', 'Ecografía'],
  ['DU_MODALITY_CT', 'Tomografía computarizada'],
  ['DU_MODALITY_MRI', 'Resonancia magnética'],
  ['DU_MODALITY_MAMMOGRAPHY', 'Mamografía'],
  ['DU_MODALITY_BONE_DENSITOMETRY', 'Densitometría ósea'],
]);

// Hoy sólo Bolivia, igual que `tenant-country` en la API: no es el
// `VS_COUNTRY` universal, que allá sigue sin miembros.
conjunto('VS_TENANT_COUNTRY', 'País de la organización', 'País donde está constituida la organización.');
export const TENANT_COUNTRY = definir('VS_TENANT_COUNTRY', [['BO', 'Bolivia']]);

// El catálogo `jurisdiction` de la API, con sus dos códigos. No reemplaza a
// `VS_JURISDICTION` (`JUR-*`), que siguen usando las matrículas sembradas de
// la maqueta: sólo lo lee el alta de centros de diagnóstico.
conjunto('VS_LICENSE_JURISDICTION', 'Jurisdicción', 'Ámbito territorial de la licencia para operar.');
export const LICENSE_JURISDICTION = definir('VS_LICENSE_JURISDICTION', [
  ['JURISDICTION_NATIONAL', 'Nacional'],
  ['JURISDICTION_SEDES_SANTA_CRUZ', 'SEDES Santa Cruz'],
]);

/* ---- circuito de especímenes del laboratorio (BR-17, CL-47) --------------
   Estados, custodia y rechazo con los códigos de `diagnostics.concepts.ts` de
   la API. */

conjunto('VS_SPECIMEN_STATUS', 'Estado del espécimen', 'Ciclo de vida de un espécimen.');
export const SPECIMEN_STATUS = definir('VS_SPECIMEN_STATUS', [
  ['SPEC_COLLECTED', 'Recolectado'],
  ['SPEC_RECEIVED', 'Recibido en el laboratorio'],
  ['SPEC_REJECTED', 'Rechazado'],
]);

conjunto('VS_ACCESSION_STATUS', 'Estado de la acesión', 'Ciclo de vida de una acesión de laboratorio.');
export const ACCESSION_STATUS = definir('VS_ACCESSION_STATUS', [
  ['ACC_RECEIVED', 'Recibida'],
  ['ACC_IN_PROCESS', 'En proceso'],
  ['ACC_ITEM_RECEIVED', 'Espécimen recibido'],
  ['ACC_ITEM_REJECTED', 'Espécimen rechazado'],
]);

conjunto('VS_CUSTODY_EVENT_TYPE', 'Evento de custodia', 'Qué pasó con el espécimen en la cadena de custodia.');
export const CUSTODY_EVENT_TYPE = definir('VS_CUSTODY_EVENT_TYPE', [
  ['CUSTODY_RECEPTION', 'Recepción'],
  ['CUSTODY_TRANSFER', 'Traslado'],
  ['CONTAINER_EVT_TRANSFER', 'Traslado del contenedor'],
]);

conjunto('VS_CONTAINER_STATUS', 'Estado del contenedor', 'Dónde está el contenedor del espécimen.');
export const CONTAINER_STATUS = definir('VS_CONTAINER_STATUS', [
  ['CONTAINER_ACTIVE', 'En uso'],
  ['CONTAINER_IN_TRANSIT', 'En tránsito'],
  ['CONTAINER_STORED', 'Almacenado'],
]);

conjunto('VS_SPECIMEN_REJECTION_REASON', 'Motivo de rechazo', 'Por qué el laboratorio rechaza un espécimen.');
export const SPECIMEN_REJECTION_REASON = definir('VS_SPECIMEN_REJECTION_REASON', [
  ['REJECTION_QUALITY', 'Calidad insuficiente (hemólisis o volumen)'],
]);

/* El tipo de espécimen y el de contenedor son los catálogos que la API publica
   por `dynamic-enums` (`specimen-type`, `specimen-container-type`), con sus
   mismos códigos: HL7 v2-0487 para la muestra y el color de tapa (ISO 6710)
   para el tubo. El orden es el de la API. */

conjunto('VS_SPECIMEN_TYPE', 'Tipo de espécimen', 'Qué muestra se tomó al paciente.');
export const SPECIMEN_TYPE = definir('VS_SPECIMEN_TYPE', [
  ['BLDV', 'Sangre venosa'],
  ['SER', 'Suero'],
  ['PLAS', 'Plasma'],
  ['UR', 'Orina'],
  ['UR24', 'Orina de 24 horas'],
  ['BLDA', 'Sangre arterial'],
  ['BLDC', 'Sangre capilar'],
  ['STL', 'Heces'],
  ['CSF', 'Líquido cefalorraquídeo'],
  ['SPT', 'Esputo'],
  ['THRT', 'Hisopado de garganta'],
]);

conjunto('VS_SPECIMEN_CONTAINER_TYPE', 'Tipo de contenedor', 'Tubo o frasco en el que viaja la muestra.');
export const SPECIMEN_CONTAINER_TYPE = definir('VS_SPECIMEN_CONTAINER_TYPE', [
  ['TUBE_LAVENDER_EDTA', 'Tubo tapa lila (EDTA)'],
  ['TUBE_GOLD_SST', 'Tubo tapa amarilla (gel separador)'],
  ['TUBE_RED_PLAIN', 'Tubo tapa roja'],
  ['TUBE_LIGHT_BLUE_CITRATE', 'Tubo tapa celeste (citrato)'],
  ['TUBE_GREEN_HEPARIN', 'Tubo tapa verde (heparina)'],
  ['TUBE_GRAY_FLUORIDE', 'Tubo tapa gris (fluoruro)'],
  ['SYRINGE_BLOOD_GAS', 'Jeringa de gasometría'],
  ['CUP_URINE_STERILE', 'Frasco estéril de orina'],
  ['JUG_URINE_24H', 'Bidón de orina de 24 horas'],
  ['CUP_STOOL', 'Frasco para heces'],
  ['TUBE_STERILE', 'Tubo estéril con tapa a rosca'],
  ['SWAB_TRANSPORT', 'Hisopo con medio de transporte'],
]);

/* ---- Catálogos administrativos de seguros -------------------------------- */
conjunto(
  'VS_INSURANCE_PLAN_CURRENCY',
  'Monedas de planes de seguro',
  'Monedas admitidas para los importes de planes y coberturas.',
);

export const MONEDA_PLAN_SEGURO = definir('VS_INSURANCE_PLAN_CURRENCY', [
  ['BOB', 'Boliviano'],
  ['USD', 'Dólar estadounidense'],
]);

conjunto(
  'VS_INSURANCE_BENEFIT_CATEGORY',
  'Categorías de cobertura',
  'Categorías administrables de prestaciones cubiertas por un plan.',
);

export const CATEGORIA_COBERTURA = definir('VS_INSURANCE_BENEFIT_CATEGORY', [
  ['BENEFIT_CATEGORY_GENERAL', 'General'],
  ['BENEFIT_CATEGORY_OUTPATIENT', 'Consulta externa'],
  ['BENEFIT_CATEGORY_EMERGENCY', 'Emergencias'],
  ['BENEFIT_CATEGORY_HOSPITALIZATION', 'Hospitalización'],
  ['BENEFIT_CATEGORY_LAB_IMAGING', 'Laboratorio e imagen'],
  ['BENEFIT_CATEGORY_PHARMACY', 'Farmacia'],
]);

/* ---- consultas ----------------------------------------------------------- */

export function conceptos(): readonly ConceptoSimulado[] {
  return [...registro.values()];
}

export function conceptoPorId(id: string): ConceptoSimulado | undefined {
  for (const c of registro.values()) {
    if (c.id === id) return c;
  }
  return undefined;
}

export function conceptoPorCodigo(code: string): ConceptoSimulado | undefined {
  return registro.get(code);
}

export function displayDe(id: string): string {
  return conceptoPorId(id)?.display ?? id;
}

export function conjuntoPorCodigo(internalCode: string): ConjuntoSimulado | undefined {
  return conjuntos.get(internalCode);
}

export function conjuntoPorId(id: string): ConjuntoSimulado | undefined {
  for (const c of conjuntos.values()) {
    if (c.id === id || c.defaultVersionId === id) return c;
  }
  return conjuntos.get(id);
}

export function todosLosConjuntos(): readonly ConjuntoSimulado[] {
  return [...conjuntos.values()];
}

export function miembrosDe(internalCode: string): readonly ConceptoSimulado[] {
  return conceptos().filter((c) => c.valueSets.includes(internalCode));
}

/** Slug legible para el glosario. */
export function slugDe(display: string): string {
  return display
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
