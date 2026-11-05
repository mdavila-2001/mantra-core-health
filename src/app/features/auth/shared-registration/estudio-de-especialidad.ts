import { CATALOG_OUTSIDE_INSTITUTION } from '../../../core/profession/educational-institutions';
import {
  CATALOG_OUTSIDE_COUNTRY,
  cityToChooseUniversity,
  choiceFromText,
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
 * datos y sin número **frena el paso** (`estudioSinNumero`), en vez de perderse en
 * silencio.
 */
export interface EstudioDeEspecialidad {
  /** El número del diploma de la especialidad. Lo único obligatorio de la fila. */
  readonly numero: string;
  /** El país donde la cursó, por nombre. Vacío con «Otro país…» sin escribir. */
  readonly pais: string;
  /** Qué opción del desplegable de país está marcada (nombre, centinela o nada). */
  readonly paisElegido: string | null;
  /** La universidad, por nombre: es lo que viaja como `issuingInstitutionText`. */
  readonly universidad: string;
  /** Qué opción del desplegable de universidad está marcada. */
  readonly universidadElegida: string | null;
  /** La ciudad (sede) donde la cursó. */
  readonly ciudad: string;
  /** Nombre y peso del PDF elegido, o `null` si todavía no adjuntó ninguno. */
  readonly archivo: string | null;
  readonly pesoBytes: number | null;
  /** El PDF ya subido, para que un reintento no lo suba dos veces. */
  readonly fileId: string | null;
}

/** Los datos de una fila que se escriben a mano. */
export type CampoEditableDeEstudio = 'numero' | 'pais' | 'universidad' | 'ciudad';

/** Lo que el padrón tiene que saber para poner un desplegable a tono con un texto. */
export type PadronParaEstudio = Pick<
  UniversitiesRegistry,
  'isCatalogCountry' | 'isUniversityOf' | 'citiesOf'
>;

/** Una fila en blanco: lo que tiene una especialidad recién agregada. */
export const ESTUDIO_VACIO: EstudioDeEspecialidad = {
  numero: '',
  pais: '',
  paisElegido: null,
  universidad: '',
  universidadElegida: null,
  ciudad: '',
  archivo: null,
  pesoBytes: null,
  fileId: null,
};

/** Si la fila todavía no dice nada: no frena ni viaja. */
export function estudioVacio(estudio: EstudioDeEspecialidad): boolean {
  return (
    estudio.numero.trim() === '' &&
    estudio.pais.trim() === '' &&
    estudio.paisElegido === null &&
    estudio.universidad.trim() === '' &&
    estudio.universidadElegida === null &&
    estudio.ciudad.trim() === '' &&
    estudio.archivo === null
  );
}

/** Si la fila declara algo pero le falta el número que la hace guardable. */
export function estudioSinNumero(estudio: EstudioDeEspecialidad): boolean {
  return !estudioVacio(estudio) && estudio.numero.trim() === '';
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
export function conDatoEscrito(
  estudio: EstudioDeEspecialidad,
  campo: CampoEditableDeEstudio,
  valor: string,
  padron: PadronParaEstudio,
): EstudioDeEspecialidad {
  const escrito = { ...estudio, [campo]: valor };
  if (campo === 'pais' && estudio.paisElegido !== CATALOG_OUTSIDE_COUNTRY) {
    return {
      ...escrito,
      paisElegido: choiceFromText(
        valor,
        (pais) => padron.isCatalogCountry(pais),
        CATALOG_OUTSIDE_COUNTRY,
      ),
    };
  }
  if (campo === 'universidad' && estudio.universidadElegida !== CATALOG_OUTSIDE_INSTITUTION) {
    return {
      ...escrito,
      universidadElegida: choiceFromText(
        valor,
        (universidad) => padron.isUniversityOf(estudio.pais, universidad),
        CATALOG_OUTSIDE_INSTITUTION,
      ),
    };
  }
  return escrito;
}

/**
 * Una fila con otra universidad marcada, y su ciudad puesta a tono: la de la
 * universidad nueva, salvo que la persona ya hubiera escrito la suya.
 */
export function conUniversidadElegida(
  estudio: EstudioDeEspecialidad,
  eleccion: string | null,
  padron: PadronParaEstudio,
): EstudioDeEspecialidad {
  const universidad =
    eleccion === null || eleccion === CATALOG_OUTSIDE_INSTITUTION ? '' : eleccion;
  return {
    ...estudio,
    universidadElegida: eleccion,
    universidad,
    ciudad: cityToChooseUniversity(estudio.ciudad, padron.citiesOf(estudio.pais, universidad)),
  };
}

/**
 * Una fila con otro país marcado. Cambiar de país **reinicia la universidad**:
 * la lista es la del país, y dejar «Universidad de Buenos Aires» marcada bajo
 * Chile sería mentir.
 */
export function conPaisElegido(
  estudio: EstudioDeEspecialidad,
  eleccion: string | null,
  padron: PadronParaEstudio,
): EstudioDeEspecialidad {
  const pais = eleccion === null || eleccion === CATALOG_OUTSIDE_COUNTRY ? '' : eleccion;
  const base = pais === estudio.pais ? estudio : conUniversidadElegida(estudio, null, padron);
  return { ...base, paisElegido: eleccion, pais };
}
