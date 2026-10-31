import type { ExactPatientQuery } from '../../../core/data-access/support-access/support-patients.types';

/**
 * La búsqueda de pacientes de quien trabaja con un vínculo de apoyo es
 * **exacta**: el documento completo, el teléfono completo, o el nombre completo
 * junto con la fecha de nacimiento. Nunca un pedazo: escribir «Juan» no encuentra
 * a «Juan Pérez» ni a nadie (caso 13 del contrato).
 *
 * Esta validación existe para **decirle a la persona cómo buscar** antes de ir
 * a la red; la API rechaza lo parcial de todos modos (422), y así lo hace.
 * Lógica pura.
 */
export type SearchMode = 'DOCUMENT' | 'PHONE' | 'NAME_BIRTH';

export interface SearchInput {
  readonly mode: SearchMode;
  /** Documento o teléfono, según el modo. */
  readonly text: string;
  readonly fullName: string;
  /** `YYYY-MM-DD`. */
  readonly birthDate: string;
}

export type SearchValidation =
  | { readonly ok: true; readonly query: ExactPatientQuery }
  | { readonly ok: false; readonly message: string; readonly help: string };

/** Los seis dígitos que tiene el documento más corto que circula (la misma cota que el resto de la agenda). */
export const MIN_DOCUMENT_LENGTH = 6;
/** Un celular boliviano tiene ocho dígitos (sin el 591). */
export const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 11;

export const SEARCH_MODES: readonly { readonly value: SearchMode; readonly label: string }[] = [
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'PHONE', label: 'Teléfono' },
  { value: 'NAME_BIRTH', label: 'Nombre y fecha' },
];

export const SEARCH_HELP: Readonly<Record<SearchMode, string>> = {
  DOCUMENT: 'Escriba el documento de identidad completo, por ejemplo 4123456.',
  PHONE: 'Escriba el teléfono completo, con sus 8 dígitos, por ejemplo 71234567.',
  NAME_BIRTH: 'Escriba el nombre y el apellido completos y la fecha de nacimiento.',
};

function cleanDocument(text: string): string {
  return text.trim().replace(/[\s.]/g, '');
}

function phoneDigits(text: string): string {
  return text.replace(/\D+/g, '');
}

function validBirthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 && date.getTime() < Date.now() && date.getFullYear() > 1900;
}

export function validateExactSearch(input: SearchInput): SearchValidation {
  switch (input.mode) {
    case 'DOCUMENT': {
      const document = cleanDocument(input.text);
      const tieneNumero = /\d/.test(document);
      if (document.length < MIN_DOCUMENT_LENGTH || !tieneNumero || !/^[A-Za-z0-9-]+$/.test(document)) {
        const escrito = input.text.trim();
        return {
          ok: false,
          message:
            escrito === ''
              ? 'Escriba el documento del paciente para buscarlo.'
              : `«${escrito}» no alcanza: la búsqueda es exacta y necesita el documento de identidad completo.`,
          help: `${SEARCH_HELP.DOCUMENT} Si solo conoce el nombre, use «Nombre y fecha».`,
        };
      }
      return { ok: true, query: { kind: 'DOCUMENT', document } };
    }
    case 'PHONE': {
      const digits = phoneDigits(input.text);
      const sinPais = digits.startsWith('591') && digits.length > MIN_PHONE_DIGITS ? digits.slice(3) : digits;
      if (sinPais.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
        const escrito = input.text.trim();
        return {
          ok: false,
          message:
            escrito === ''
              ? 'Escriba el teléfono del paciente para buscarlo.'
              : `«${escrito}» no alcanza: la búsqueda es exacta y necesita el teléfono completo.`,
          help: SEARCH_HELP.PHONE,
        };
      }
      return { ok: true, query: { kind: 'PHONE', phone: sinPais } };
    }
    case 'NAME_BIRTH': {
      const palabras = input.fullName.trim().split(/\s+/).filter((p) => p.length > 1);
      if (palabras.length < 2) {
        const escrito = input.fullName.trim();
        return {
          ok: false,
          message:
            escrito === ''
              ? 'Escriba el nombre completo del paciente.'
              : `«${escrito}» no alcanza: la búsqueda es exacta y necesita el nombre y el apellido completos.`,
          help: SEARCH_HELP.NAME_BIRTH,
        };
      }
      if (!validBirthDate(input.birthDate)) {
        return { ok: false, message: 'Falta la fecha de nacimiento: sin ella la búsqueda por nombre no se hace.', help: SEARCH_HELP.NAME_BIRTH };
      }
      return { ok: true, query: { kind: 'NAME_BIRTH', fullName: palabras.join(' '), birthDate: input.birthDate } };
    }
  }
}

/** Si una fecha de nacimiento (`YYYY-MM-DD`) corresponde a alguien menor de 18 años hoy. */
export function isMinorOn(birthDate: string, today: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (match === null) return false;
  const cumple18 = new Date(Number(match[1]) + 18, Number(match[2]) - 1, Number(match[3]));
  return cumple18.getTime() > today.getTime();
}
