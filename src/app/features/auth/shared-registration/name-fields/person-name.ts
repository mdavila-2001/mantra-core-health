import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

import { joinNames } from '../../../../core/profession/additional-names';
import { noSoloEspacios } from '../trimmed-text';

const MIN_PART_NAME = 2;
const MAX_PART_NAME = 100;

/** Tope de `middleName` en la API: lo que no es el primer nombre viaja plegado ahí (ver {@link nameParts}). */
export const MAX_FOLDED_MIDDLE_NAME = 100;

/** Tope del nombre compuesto: el `@MaxLength(200)` de `fullName` en el alta de organización. */
export const MAX_COMPLETE_NAME = 200;

/**
 * Los controles con los que se declara el nombre de una persona: primer,
 * segundo y tercer nombre, los que se hayan agregado, y los dos apellidos.
 */
export interface NameControls {
  name: FormControl<string>;
  middleName: FormControl<string>;
  thirdName: FormControl<string>;
  extraNames: FormArray<FormControl<string>>;
  lastName: FormControl<string>;
  motherLastName: FormControl<string>;
}

export type NameGroup = FormGroup<NameControls>;

/** Una casilla de nombre agregada, en blanco. */
export function nameExtraControl(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(MAX_PART_NAME)],
  });
}

function completeNameFits(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const compuesto = completeName(grupo.getRawValue() as NameValue);
    return compuesto.length > MAX_COMPLETE_NAME
      ? { nombreCompletoLargo: { max: MAX_COMPLETE_NAME, actual: compuesto.length } }
      : null;
  };
}

/**
 * El segundo nombre, el tercero y los agregados viajan plegados en un solo
 * `middleName`, que la API topa en {@link MAX_FOLDED_MIDDLE_NAME}: cada casilla
 * puede estar dentro de sus 100 y la suma no. Sin esto el envío llegaba a la
 * red para volver con un 400.
 */
function additionalNamesFit(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const nombre = grupo.getRawValue() as NameValue;
    const plegado = joinNames([nombre.middleName, nombre.thirdName, ...nombre.extraNames]);
    return plegado.length > MAX_FOLDED_MIDDLE_NAME
      ? { nombresAdicionalesLargos: { max: MAX_FOLDED_MIDDLE_NAME, actual: plegado.length } }
      : null;
  };
}

/**
 * El grupo del nombre de una persona.
 *
 * @param obligatorio - `true`: primer nombre y apellido paterno son requeridos
 *   (el representante legal); `false`: todo es opcional (las gerencias).
 * @param viajaEnPartes - `true` cuando el nombre sale como `name`, `middleName`,
 *   `lastName` y `motherLastName` (ver {@link nameParts}): un primer nombre o
 *   apellido de solo espacios cuenta como vacío, porque sale recortado y vacío,
 *   y el segundo nombre plegado no puede pasar de {@link MAX_FOLDED_MIDDLE_NAME}.
 *   Por omisión no se pide: las demás altas validan lo suyo por su cuenta.
 */
export function nameGroup(obligatorio: boolean, viajaEnPartes = false): NameGroup {
  const requeridas = obligatorio
    ? [
        Validators.required,
        ...(viajaEnPartes ? [noSoloEspacios] : []),
        Validators.minLength(MIN_PART_NAME),
      ]
    : [];
  const parte = (extra: ValidatorFn[]) =>
    new FormControl('', {
      nonNullable: true,
      validators: [...extra, Validators.maxLength(MAX_PART_NAME)],
    });
  return new FormGroup<NameControls>(
    {
      name: parte(requeridas),
      middleName: parte([]),
      thirdName: parte([]),
      extraNames: new FormArray<FormControl<string>>([]),
      lastName: parte(requeridas),
      motherLastName: parte([]),
    },
    { validators: [completeNameFits(), ...(viajaEnPartes ? [additionalNamesFit()] : [])] },
  );
}

/** Lo que devuelve `getRawValue()` de un {@link NameGroup}. */
export interface NameValue {
  readonly name: string;
  readonly middleName: string;
  readonly thirdName: string;
  readonly extraNames: readonly string[];
  readonly lastName: string;
  readonly motherLastName: string;
}

/** El nombre completo tal como viaja: las partes no vacías, en orden, separadas por un espacio. */
export function completeName(valor: NameValue): string {
  return joinNames([
    valor.name,
    valor.middleName,
    valor.thirdName,
    ...valor.extraNames,
    valor.lastName,
    valor.motherLastName,
  ]);
}

/** El nombre de una persona en las partes que la API guarda por separado. */
export interface NameParts {
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
}

/**
 * Las partes del nombre tal como las reciben `owner` y `medicalDirector`.
 *
 * La base no tiene columna de tercer nombre: lo que no es el primer nombre se
 * pliega en `middleName` (ver `joinNames`), igual que en el alta de paciente,
 * de médico y de aseguradora. El segundo nombre y el apellido materno no
 * viajan si están vacíos.
 */
export function nameParts(valor: NameValue): NameParts {
  const segundo = joinNames([valor.middleName, valor.thirdName, ...valor.extraNames]);
  const materno = valor.motherLastName.trim();
  return {
    name: valor.name.trim(),
    ...(segundo === '' ? {} : { middleName: segundo }),
    lastName: valor.lastName.trim(),
    ...(materno === '' ? {} : { motherLastName: materno }),
  };
}
