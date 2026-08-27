import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { BirthSexCode } from './iam.types';

/**
 * Sexo al nacer, con sus etiquetas en castellano.
 *
 * Va como lista fija y no como lectura de terminología porque la API lo recibe
 * **por código legible** (`sexAtBirth: 'FEMALE'`), no por uuid de concepto:
 * pedir el catálogo sólo para pintar cuatro etiquetas agregaría una petición y
 * un estado de fallo sin ganar nada. Los códigos son los que valida el `@IsIn`
 * del backend; el mapeo a concepto lo hace él.
 *
 * El registro de paciente conserva su propia copia hasta unificar.
 */
export const BIRTH_SEX_OPTIONS: readonly SelectOption<BirthSexCode>[] = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'INTERSEX', label: 'Intersexual' },
  { value: 'UNKNOWN', label: 'Prefiero no decirlo' },
];
