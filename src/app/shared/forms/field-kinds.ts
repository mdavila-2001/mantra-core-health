import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/*
 * The data kinds a text field can declare: one decision per kind about which
 * characters the field accepts (the typing filter), which shape the value must
 * have to travel (the validator), what the person is told when it does not,
 * and which keyboard a phone opens.
 *
 * Before this, every registration screen made those three decisions on its
 * own, field by field, and they drifted apart: the patient filtered digits out
 * of names while the laboratory accepted "holaLTAD1" for its legal
 * representative and "541984844*" plus slashes as an identity document.
 *
 * `app-input` applies a kind through `fieldKind`, and the paginated-form engine
 * through `CampoDeFormulario.fieldKind`. Length and required-ness stay with each
 * screen: they belong to each DTO. This is not the authority either, the API
 * validates every request.
 */

/**
 * - `personName`: a part of a person's name. Letters (accents, ñ), and between
 *   words a single space, hyphen or apostrophe ("De la Cruz", "García-Lorca").
 * - `identityDocument`: what the API accepts (`^[A-Za-z0-9.-]+$`), no spaces:
 *   the issuing department has its own field.
 * - `identityDocumentWithComplement`: the same plus one space between parts
 *   ("4872190 SC"), for screens with no field for the complement.
 * - `email`: ASCII letters and digits, `.`, `_` or `-` only between them, one `@`.
 * - `taxId`: a company NIT, digits and hyphen, starting with a digit.
 * - `digits`: digits only.
 * - `phone`: a phone typed in a plain field (not `app-phone-input`): digits,
 *   `+`, spaces, parentheses and hyphen, as the API accepts.
 */
export type FieldKind =
  | 'personName'
  | 'identityDocument'
  | 'identityDocumentWithComplement'
  | 'email'
  | 'taxId'
  | 'digits'
  | 'phone';

export interface FieldKindRule {
  /** Removes what the field does not accept; applied on the DOM input itself. */
  readonly filter: (value: string) => string;
  /** Whether a trimmed, non-empty value has the shape it needs to travel. */
  readonly isWellFormed: (value: string) => boolean;
  /** What the person reads when the value does not pass. */
  readonly message: string;
  readonly inputMode: 'email' | 'tel' | 'numeric' | null;
}

const NAME_SHAPE = /^\p{L}[\p{L}\p{M}]*(?:[ '-]\p{L}[\p{L}\p{M}]*)*$/u;
const DOCUMENT_SHAPE = /^[A-Za-z0-9.-]+$/;
const DOCUMENT_WITH_COMPLEMENT_SHAPE = /^[A-Za-z0-9.-]+(?: [A-Za-z0-9.-]+)*$/;
const EMAIL_SHAPE =
  /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}$/;
/** The same `@Matches` the API puts on a hand-typed phone. */
const PHONE_SHAPE = /^[+]?[0-9 ()-]+$/;

/** Drops what `forbidden` matches, leading symbols and every symbol right after another one. */
function emailSegment(text: string, forbidden: RegExp): string {
  return text
    .replace(forbidden, '')
    .replace(/^[._-]+/, '')
    .replace(/([._-])[._-]+/g, '$1');
}

/** An email as it is typed: `---++++-++--+++++` leaves the field empty. */
function emailFilter(value: string): string {
  const at = value.indexOf('@');
  const local = emailSegment(at < 0 ? value : value.slice(0, at), /[^A-Za-z0-9._-]/g);
  if (at < 0) return local;
  const user = local.replace(/[._-]+$/, '');
  if (user === '') return '';
  return `${user}@${emailSegment(value.slice(at + 1), /[^A-Za-z0-9.-]/g)}`;
}

export const FIELD_KINDS: Readonly<Record<FieldKind, FieldKindRule>> = {
  personName: {
    // A trailing separator stays while typing (`fieldKindNormalize` drops it on blur).
    // iOS smart punctuation types ’ instead of ': it becomes the plain apostrophe.
    filter: (value) =>
      value
        .replace(/[‘’ʼ]/g, "'")
        .replace(/[^\p{L}\p{M} '-]/gu, '')
        .replace(/^[\p{M} '-]+/u, '')
        .replace(/([ '-])[ '-]+/g, '$1'),
    isWellFormed: (value) => NAME_SHAPE.test(value),
    message:
      'Escriba sólo letras; un nombre compuesto se separa con un espacio, un guion o un apóstrofo.',
    inputMode: null,
  },
  identityDocument: {
    filter: (value) => value.replace(/[^A-Za-z0-9.-]/g, ''),
    isWellFormed: (value) => DOCUMENT_SHAPE.test(value),
    message: 'Escriba el documento sólo con letras, números, punto y guion, sin espacios.',
    inputMode: null,
  },
  identityDocumentWithComplement: {
    filter: (value) =>
      value
        .replace(/[^A-Za-z0-9. -]/g, '')
        .replace(/^ +/, '')
        .replace(/ {2,}/g, ' '),
    isWellFormed: (value) => DOCUMENT_WITH_COMPLEMENT_SHAPE.test(value),
    message:
      'Escriba el documento sólo con letras, números, punto y guion; el complemento va después de un espacio (4872190 SC).',
    inputMode: null,
  },
  email: {
    filter: emailFilter,
    isWellFormed: (value) => EMAIL_SHAPE.test(value),
    message: 'Escriba un correo válido, como nombre@dominio.com.',
    inputMode: 'email',
  },
  taxId: {
    filter: (value) => value.replace(/[^0-9-]/g, '').replace(/^-+/, ''),
    isWellFormed: (value) => /^[0-9][0-9-]*$/.test(value),
    message: 'Escriba el NIT sólo con números y, si lo tiene, el guion.',
    inputMode: 'numeric',
  },
  digits: {
    filter: (value) => value.replace(/\D/g, ''),
    isWellFormed: (value) => /^\d+$/.test(value),
    message: 'Escriba sólo números.',
    inputMode: 'numeric',
  },
  phone: {
    filter: (value) => value.replace(/[^0-9 ()+-]/g, '').replace(/(?!^)\+/g, ''),
    isWellFormed: (value) => PHONE_SHAPE.test(value),
    message: 'Escriba el teléfono sólo con números; se admiten +, espacios, paréntesis y guion.',
    inputMode: 'tel',
  },
};

/** A form field's kind: the declared one, or `email` for an email field, which is one without saying so. */
export function fieldKindOf(field: { readonly control: string; readonly fieldKind?: FieldKind }): FieldKind | null {
  return field.fieldKind ?? (field.control === 'email' ? 'email' : null);
}

/** What a field keeps on blur: trimmed, and a name without its dangling separator ("Quispe-"). */
export function fieldKindNormalize(kind: FieldKind | null | undefined): (value: string) => string {
  return kind === 'personName' ? (value) => value.trim().replace(/[ '-]+$/, '') : (value) => value.trim();
}

export function fieldKindFilter(kind: FieldKind | null | undefined): ((value: string) => string) | null {
  return kind ? FIELD_KINDS[kind].filter : null;
}

export function fieldKindInputMode(kind: FieldKind | null | undefined): string | null {
  return kind ? FIELD_KINDS[kind].inputMode : null;
}

export function fieldKindMessage(kind: FieldKind): string {
  return FIELD_KINDS[kind].message;
}

export interface FieldKindError {
  readonly kind: FieldKind;
  readonly message: string;
}

/**
 * Form validator for a kind. Checks the trimmed value, since that is what
 * travels; empty is `Validators.required`'s business. The error carries its
 * message so any screen can show it: `{ fieldKind: { kind, message } }`.
 */
export function fieldKindValidator(kind: FieldKind): ValidatorFn {
  const rule = FIELD_KINDS[kind];
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: unknown = control.value;
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (value === '' || rule.isWellFormed(value)) return null;
    const error: FieldKindError = { kind, message: rule.message };
    return { fieldKind: error };
  };
}

/** The message of a `fieldKind` error, if there is one. */
export function fieldKindErrorMessage(errors: ValidationErrors | null | undefined): string | null {
  const error = errors?.['fieldKind'] as FieldKindError | undefined;
  return error?.message ?? null;
}
