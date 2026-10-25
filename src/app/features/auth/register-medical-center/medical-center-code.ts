/** Lo que la API acepta en `code`: de 3 a 100 caracteres de `[A-Za-z0-9._-]`. */
const MAX_CODE_LENGTH = 100;
const CODE_PREFIX = 'CM-';

/**
 * El código de la organización, derivado de la razón social.
 *
 * Nadie tiene que escribir un identificador técnico: se arma con el nombre,
 * sin diacríticos, en mayúsculas y con guiones. Si el nombre no deja ningún
 * carácter válido el resultado es `CM-CENTRO`, que igual cumple el patrón.
 *
 * @param razonSocial - La razón social tal como se escribió.
 * @returns Un código válido para `register-organization`.
 */
export function medicalCenterCodeFromName(razonSocial: string): string {
  const base = razonSocial
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${CODE_PREFIX}${base === '' ? 'CENTRO' : base}`.slice(0, MAX_CODE_LENGTH).replace(/-+$/g, '');
}
