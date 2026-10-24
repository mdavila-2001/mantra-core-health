import { CATALOG_OUTSIDE_INSTITUTION } from '../../../core/profession/educational-institutions';
import {
  CATALOG_OUTSIDE_COUNTRY,
  choiceFromText,
  cityToChooseUniversity,
  type UniversitiesRegistry,
} from '../../../core/profession/university-registry';

/**
 * Dónde estudió el médico CADA especialidad que declara.
 *
 * ## Por qué existe
 *
 * El título profesional ya preguntaba número del diploma, país, universidad y
 * ciudad. Las especialidades, no: se elegían de una lista y nada más. Pero una
 * especialidad se cursa en otro lugar y otro año que la carrera —cardiología en
 * Buenos Aires después de medicina en La Paz— y el propietario pidió el mismo
 * bloque para cada una (22/10/2026).
 *
 * Es **la misma pregunta y las mismas reglas** que el título principal y que las
 * filas de «Sus títulos» (ver `CampoDeEstudio` en el alta): país en desplegable,
 * universidad acotada a ese país con «Otra institución…», y la ciudad que sale de
 * la universidad. Por eso las transiciones son funciones puras sobre un valor y
 * no un segundo conjunto de métodos con estado en el componente.
 *
 * ## Qué viaja
 *
 * Una fila con **número** viaja como credencial de tipo `CREDENTIAL_TYPE_SPECIALTY`
 * (`professional_credentials`), con su universidad, ciudad, país y PDF. El número
 * es lo único obligatorio de la fila porque la columna es `NOT NULL`: una fila con
 * datos y sin número **frena el paso** ({@link isStudyMissingNumber}), en vez de
 * perderse en silencio.
 */
export interface SpecialtyStudy {
  /** El número del diploma de la especialidad. Lo único obligatorio de la fila. */
  readonly number: string;
  /** El país donde la cursó, por nombre. Vacío con «Otro país…» sin escribir. */
  readonly country: string;
  /** Qué opción del desplegable de país está marcada (nombre, centinela o nada). */
  readonly pickedCountry: string | null;
  /** La universidad, por nombre: es lo que viaja como `issuingInstitutionText`. */
  readonly university: string;
  /** Qué opción del desplegable de universidad está marcada. */
  readonly pickedUniversity: string | null;
  /** La ciudad (sede) donde la cursó. */
  readonly city: string;
  /** Nombre y peso del PDF elegido, o `null` si todavía no adjuntó ninguno. */
  readonly fileName: string | null;
  readonly fileBytes: number | null;
  /** El PDF ya subido, para que un reintento no lo suba dos veces. */
  readonly fileId: string | null;
}

/** Los datos de una fila que se escriben a mano. */
export type EditableStudyField = 'number' | 'country' | 'university' | 'city';

/** Lo que el padrón tiene que saber para poner un desplegable a tono con un texto. */
export type StudyRegistry = Pick<UniversitiesRegistry, 'isCatalogCountry' | 'isUniversityOf' | 'citiesOf'>;

/** Una fila en blanco: lo que tiene una especialidad recién agregada. */
export const EMPTY_STUDY: SpecialtyStudy = {
  number: '',
  country: '',
  pickedCountry: null,
  university: '',
  pickedUniversity: null,
  city: '',
  fileName: null,
  fileBytes: null,
  fileId: null,
};

/** Si la fila todavía no dice nada: no frena ni viaja. */
export function isStudyEmpty(study: SpecialtyStudy): boolean {
  return (
    study.number.trim() === '' &&
    study.country.trim() === '' &&
    study.pickedCountry === null &&
    study.university.trim() === '' &&
    study.pickedUniversity === null &&
    study.city.trim() === '' &&
    study.fileName === null
  );
}

/** Si la fila declara algo pero le falta el número que la hace guardable. */
export function isStudyMissingNumber(study: SpecialtyStudy): boolean {
  return !isStudyEmpty(study) && study.number.trim() === '';
}

/**
 * Una fila con un dato escrito, y su desplegable puesto a tono.
 *
 * Escribir el país o la universidad **como texto** —lo hacen las pruebas y lo
 * haría una restauración del borrador— deja el desplegable en la opción que
 * corresponde: el nombre si está en el padrón, «Otro…» si no. Con «Otro…» ya
 * elegido el desplegable se queda quieto: la casilla a mano no puede
 * desaparecer debajo del cursor porque lo tecleado coincida con un nombre.
 */
export function withStudyField(
  study: SpecialtyStudy,
  field: EditableStudyField,
  value: string,
  registry: StudyRegistry,
): SpecialtyStudy {
  const written = { ...study, [field]: value };
  if (field === 'country' && study.pickedCountry !== CATALOG_OUTSIDE_COUNTRY) {
    return {
      ...written,
      pickedCountry: choiceFromText(
        value,
        (country) => registry.isCatalogCountry(country),
        CATALOG_OUTSIDE_COUNTRY,
      ),
    };
  }
  if (field === 'university' && study.pickedUniversity !== CATALOG_OUTSIDE_INSTITUTION) {
    return {
      ...written,
      pickedUniversity: choiceFromText(
        value,
        (university) => registry.isUniversityOf(study.country, university),
        CATALOG_OUTSIDE_INSTITUTION,
      ),
    };
  }
  return written;
}

/**
 * Una fila con otra universidad marcada, y su ciudad puesta a tono: la de la
 * universidad nueva, salvo que la persona ya hubiera escrito la suya.
 */
export function withUniversity(
  study: SpecialtyStudy,
  choice: string | null,
  registry: StudyRegistry,
): SpecialtyStudy {
  const university = choice === null || choice === CATALOG_OUTSIDE_INSTITUTION ? '' : choice;
  return {
    ...study,
    pickedUniversity: choice,
    university,
    city: cityToChooseUniversity(study.city, registry.citiesOf(study.country, university)),
  };
}

/**
 * Una fila con otro país marcado. Cambiar de país **reinicia la universidad**:
 * la lista es la del país, y dejar «Universidad de Buenos Aires» marcada bajo
 * Chile sería mentir.
 */
export function withCountry(
  study: SpecialtyStudy,
  choice: string | null,
  registry: StudyRegistry,
): SpecialtyStudy {
  const country = choice === null || choice === CATALOG_OUTSIDE_COUNTRY ? '' : choice;
  const base = country === study.country ? study : withUniversity(study, null, registry);
  return { ...base, pickedCountry: choice, country };
}
