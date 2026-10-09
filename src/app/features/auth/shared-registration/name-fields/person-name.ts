import {
  FormArray,
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

import { unirNombres } from '../../../../core/profession/additional-names';

const MIN_PARTE_NOMBRE = 2;
const MAX_PARTE_NOMBRE = 100;

/** Tope del nombre compuesto: el `@MaxLength(200)` de `fullName` en el alta de organización. */
export const MAX_NOMBRE_COMPLETO = 200;

/**
 * Los controles con los que se declara el nombre de una persona: primer,
 * segundo y tercer nombre, los que se hayan agregado, y los dos apellidos.
 */
export interface ControlesDeNombre {
  name: FormControl<string>;
  middleName: FormControl<string>;
  thirdName: FormControl<string>;
  extraNames: FormArray<FormControl<string>>;
  lastName: FormControl<string>;
  motherLastName: FormControl<string>;
}

export type GrupoDeNombre = FormGroup<ControlesDeNombre>;

/** Una casilla de nombre agregada, en blanco. */
export function controlDeNombreExtra(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
  });
}

function nombreCompletoCabe(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const compuesto = nombreCompleto(grupo.getRawValue() as ValorDeNombre);
    return compuesto.length > MAX_NOMBRE_COMPLETO
      ? { nombreCompletoLargo: { max: MAX_NOMBRE_COMPLETO, actual: compuesto.length } }
      : null;
  };
}

/**
 * El grupo del nombre de una persona.
 *
 * @param obligatorio - `true`: primer nombre y apellido paterno son requeridos
 *   (el representante legal); `false`: todo es opcional (las gerencias).
 */
export function grupoDeNombre(obligatorio: boolean): GrupoDeNombre {
  const requeridas = obligatorio
    ? [Validators.required, Validators.minLength(MIN_PARTE_NOMBRE)]
    : [];
  const parte = (extra: ValidatorFn[]) =>
    new FormControl('', {
      nonNullable: true,
      validators: [...extra, Validators.maxLength(MAX_PARTE_NOMBRE)],
    });
  return new FormGroup<ControlesDeNombre>(
    {
      name: parte(requeridas),
      middleName: parte([]),
      thirdName: parte([]),
      extraNames: new FormArray<FormControl<string>>([]),
      lastName: parte(requeridas),
      motherLastName: parte([]),
    },
    { validators: [nombreCompletoCabe()] },
  );
}

/** Lo que devuelve `getRawValue()` de un {@link GrupoDeNombre}. */
export interface ValorDeNombre {
  readonly name: string;
  readonly middleName: string;
  readonly thirdName: string;
  readonly extraNames: readonly string[];
  readonly lastName: string;
  readonly motherLastName: string;
}

/** El nombre completo tal como viaja: las partes no vacías, en orden, separadas por un espacio. */
export function nombreCompleto(valor: ValorDeNombre): string {
  return unirNombres([
    valor.name,
    valor.middleName,
    valor.thirdName,
    ...valor.extraNames,
    valor.lastName,
    valor.motherLastName,
  ]);
}
