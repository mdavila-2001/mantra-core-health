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

const MIN_PART_NAME = 2;
const MAX_PART_NAME = 100;

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
 * El grupo del nombre de una persona.
 *
 * @param obligatorio - `true`: primer nombre y apellido paterno son requeridos
 *   (el representante legal); `false`: todo es opcional (las gerencias).
 */
export function nameGroup(obligatorio: boolean): NameGroup {
  const requeridas = obligatorio
    ? [Validators.required, Validators.minLength(MIN_PART_NAME)]
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
    { validators: [completeNameFits()] },
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
