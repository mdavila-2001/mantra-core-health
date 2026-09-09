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
      ordinal: indice + 1,
    });
    ids[code] = id;
  });
  return ids;
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
  ['occupation:bo:OTRA', 'Otra ocupación'],  // la salida escrita a mano
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
  ['employer:bo:OTRA', 'Otra empresa (la escribo)'],  // la salida escrita a mano
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
  ['ODONTOLOGIA', 'Odontología', 'Salud bucal.'],  // odontológica
  ['FISIOTERAPIA', 'Fisioterapia y Rehabilitación', 'Rehabilitación física.'],
  ['ENFERMERIA', 'Enfermería'],
  ['BIOQUIMICA_CLINICA', 'Bioquímica Clínica'],
  ['OBSTETRICIA', 'Obstetricia'],
  ['MEDICINA_DEPORTIVA', 'Medicina Deportiva'],
  ['ANATOMIA_PATOLOGICA', 'Anatomía Patológica'],
  ['CIRUGIA_BUCOMAXILOFACIAL', 'Cirugía Bucomaxilofacial'],  // odontológica
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
  ['ENDODONCIA', 'Endodoncia'],  // odontológica
  ['ORTODONCIA', 'Ortodoncia'],  // odontológica
  ['PERIODONCIA', 'Periodoncia'],  // odontológica
  ['ESTETICA_DENTAL', 'Estética Dental'],  // odontológica
  ['REHABILITACION_ORAL', 'Rehabilitación Oral'],  // odontológica
  ['CIRUGIA_ORAL_MAXILOFACIAL', 'Cirugía Oral y Maxilofacial'],  // odontológica
  ['ODONTOPEDIATRIA', 'Odontopediatría'],  // odontológica
  ['IMPLANTOLOGIA_ORAL', 'Implantología Oral'],  // odontológica
  ['ARMONIZACION_OROFACIAL', 'Armonización Orofacial'],  // odontológica
]);

/* ---- demografía y contactos ---------------------------------------------- */

conjunto('VS_ADMINISTRATIVE_GENDER', 'Género administrativo', 'Género con el que se registra la persona.');
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

conjunto('VS_RELATED_PERSON_RELATIONSHIP', 'Parentesco', 'Relación de una persona con el paciente.');
export const PARENTESCO = definir('VS_RELATED_PERSON_RELATIONSHIP', [
  ['REL-MADRE', 'Madre'],
  ['REL-PADRE', 'Padre'],
  ['REL-CONYUGE', 'Cónyuge'],
  ['REL-HIJO', 'Hijo/a'],
  ['REL-HERMANO', 'Hermano/a'],
  ['REL-TUTOR', 'Tutor/a legal'],
  ['REL-AMIGO', 'Amigo/a'],
  ['REL-OTRO', 'Otro'],
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

conjunto('VS_RECORD_STATUS', 'Estados de registro', 'Estados administrativos de personas y perfiles.');
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
export const TIPO_CREDENCIAL = definir('VS_CREDENTIAL_TYPE', [
  ['CRED-TITULO', 'Título profesional'],
  ['CRED-ESPECIALIDAD', 'Título de especialidad'],
  ['CRED-MAESTRIA', 'Maestría'],
  ['CRED-DOCTORADO', 'Doctorado'],
  ['CRED-DIPLOMADO', 'Diplomado'],
  ['CRED-SEDES', 'Registro SEDES'],
]);

conjunto('VS_JURISDICTION', 'Jurisdicciones', 'Ámbito de la matrícula.');
export const JURISDICCION = definir('VS_JURISDICTION', [
  ['JUR-BO', 'Nacional (Bolivia)'],
  ['JUR-SC', 'Departamental Santa Cruz'],
  ['JUR-LP', 'Departamental La Paz'],
]);

conjunto('VS_AFFILIATION_TYPE', 'Tipos de vínculo laboral', 'Cómo se vincula el profesional con una organización.');
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

conjunto('VS_SERVICE_REQUEST_CATEGORY', 'Categoría de orden', 'Laboratorio, imagen, interconsulta.');
export const CATEGORIA_ORDEN = definir('VS_SERVICE_REQUEST_CATEGORY', [
  ['SRQ-LAB', 'Laboratorio'],
  ['SRQ-IMAGING', 'Imagenología'],
  ['SRQ-REFERRAL', 'Interconsulta'],
  ['SRQ-PROCEDURE', 'Procedimiento'],
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
  ['I10', 'Hipertensión arterial esencial', 'Presión arterial persistentemente elevada sin causa secundaria identificada.'],
  ['E11', 'Diabetes mellitus tipo 2', 'Trastorno metabólico crónico con hiperglucemia por resistencia a la insulina.'],
  ['E78.5', 'Dislipidemia', 'Alteración de los niveles de lípidos en sangre.'],
  ['J45', 'Asma bronquial', 'Enfermedad inflamatoria crónica de las vías respiratorias.'],
  ['M54.5', 'Lumbalgia', 'Dolor en la región lumbar.'],
  ['K21.0', 'Enfermedad por reflujo gastroesofágico', 'Retorno del contenido gástrico al esófago.'],
  ['F41.1', 'Trastorno de ansiedad generalizada', 'Ansiedad y preocupación excesivas y persistentes.'],
  ['E03.9', 'Hipotiroidismo', 'Producción insuficiente de hormona tiroidea.'],
  ['N39.0', 'Infección urinaria', 'Infección del tracto urinario.'],
  ['J06.9', 'Infección respiratoria aguda', 'Infección aguda de las vías respiratorias superiores.'],
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

/* ---- glosario: categorías --------------------------------------------- */

conjunto('glossary-all-terms', 'Glosario de terminología médica', 'Todos los términos del glosario.');
conjunto('glossary-diseases', 'Enfermedades', 'Diagnósticos y enfermedades.');
conjunto('glossary-symptoms', 'Síntomas', 'Síntomas y signos.');
conjunto('glossary-procedures', 'Procedimientos', 'Procedimientos y cirugías.');
conjunto('glossary-medications', 'Medicamentos', 'Fármacos del vademécum.');
conjunto('glossary-anatomy', 'Anatomía', 'Partes del cuerpo.');
conjunto('glossary-tests', 'Estudios diagnósticos', 'Laboratorio e imagen.');
conjunto('glossary-other', 'Otros términos', 'Términos que no caen en otra categoría.');

export const SINTOMA = definir('glossary-symptoms', [
  ['SX-FIEBRE', 'Fiebre', 'Elevación de la temperatura corporal por encima de 38 °C.'],
  ['SX-CEFALEA', 'Cefalea', 'Dolor de cabeza.'],
  ['SX-DISNEA', 'Disnea', 'Sensación de falta de aire.'],
  ['SX-TOS', 'Tos', 'Expulsión brusca de aire de los pulmones.'],
  ['SX-NAUSEA', 'Náusea', 'Sensación de malestar con ganas de vomitar.'],
  ['SX-MAREO', 'Mareo', 'Sensación de inestabilidad o vértigo.'],
  ['SX-DOLOR-TORACICO', 'Dolor torácico', 'Dolor en el pecho.'],
  ['SX-FATIGA', 'Fatiga', 'Cansancio persistente.'],
]);

export const ANATOMIA = definir('glossary-anatomy', [
  ['AN-CORAZON', 'Corazón', 'Órgano muscular que bombea la sangre.'],
  ['AN-HIGADO', 'Hígado', 'Órgano que metaboliza nutrientes y depura toxinas.'],
  ['AN-RINON', 'Riñón', 'Órgano que filtra la sangre y produce la orina.'],
  ['AN-TIROIDES', 'Tiroides', 'Glándula que regula el metabolismo.'],
  ['AN-RODILLA', 'Rodilla', 'Articulación entre el fémur y la tibia.'],
]);

export const OTRO_TERMINO = definir('glossary-other', [
  ['OT-TRIAJE', 'Triaje', 'Clasificación de pacientes según la urgencia de su atención.'],
  ['OT-INTERCONSULTA', 'Interconsulta', 'Consulta a otro especialista sobre un paciente.'],
  ['OT-ALTA', 'Alta médica', 'Fin de la atención por recuperación o derivación.'],
  ['OT-CONSENTIMIENTO', 'Consentimiento informado', 'Autorización del paciente tras conocer riesgos y beneficios.'],
]);

// Los diagnósticos, medicamentos, procedimientos y estudios también son
// términos del glosario, bajo su categoría.
for (const [code, vs] of [
  ...Object.keys(DIAGNOSTICO).map((c) => [c, 'glossary-diseases'] as const),
  ...Object.keys(MEDICAMENTO).map((c) => [c, 'glossary-medications'] as const),
  ...Object.keys(PROCEDIMIENTO).map((c) => [c, 'glossary-procedures'] as const),
  ...Object.keys(ESTUDIO).map((c) => [c, 'glossary-tests'] as const),
]) {
  const existente = registro.get(code);
  if (existente !== undefined) {
    registro.set(code, { ...existente, valueSets: [...existente.valueSets, vs] });
  }
}
for (const [code, c] of registro) {
  if (c.valueSets.some((vs) => vs.startsWith('glossary-'))) {
    registro.set(code, { ...c, valueSets: [...c.valueSets, 'glossary-all-terms'] });
  }
}

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
