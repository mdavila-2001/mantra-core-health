import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { BirthSexCode } from './iam.types';

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
export const BIRTH_SEX_OPTIONS: readonly SelectOption<BirthSexCode>[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];
