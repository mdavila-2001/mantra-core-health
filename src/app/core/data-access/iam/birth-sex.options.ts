import type { BirthSexCode } from './iam.types';

/**
 * La forma de una opción de desplegable, escrita acá en vez de importada.
 *
 * `SelectOption<T>` vive en `shared/components/atoms/select`, y `core` no
 * importa de `shared`: la dirección de las capas es `features → shared → core`
 * y `check-architecture.mjs` la hace cumplir. Traerse el tipo —aunque sea sólo
 * un tipo, que desaparece al compilar— ataba el contrato de datos al átomo que
 * hoy lo pinta, y mañana podría pintarlo otro.
 *
 * Es estructuralmente el mismo tipo, así que `app-select` sigue aceptando esta
 * lista sin conversión ninguna.
 */
interface OpcionDeLista<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * Género, con sus etiquetas en castellano.
 *
 * Va como lista fija y no como lectura de terminología porque la API lo recibe
 * **por código legible** (`sexAtBirth: 'FEMALE'`), no por uuid de concepto:
 * pedir el catálogo sólo para pintar dos etiquetas agregaría una petición y un
 * estado de fallo sin ganar nada. Los códigos son los que valida el `@IsIn` del
 * backend; el mapeo a concepto lo hace él.
 *
 * ## Por qué son dos y no cuatro
 *
 * Son las mismas dos que ofrece el alta de paciente, y el editor tiene que
 * ofrecer exactamente lo que la persona pudo elegir al registrarse: una lista
 * más larga acá significaría que corrigiendo sus datos se puede declarar algo
 * que el alta no admite. El campo es opcional —«Sin especificar» deja el
 * desplegable vacío—, así que quien no quiera contestar no elige.
 *
 * `INTERSEX` y `UNKNOWN` siguen siendo códigos válidos del contrato y no se
 * quitan del tipo: un perfil que los traiga de antes se muestra como «Sin
 * especificar» —no hay opción que los represente— y **no se envía nada**
 * mientras la persona no elija otra cosa, así que el dato heredado se conserva.
 */
export const BIRTH_SEX_OPTIONS: readonly OpcionDeLista<BirthSexCode>[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];
