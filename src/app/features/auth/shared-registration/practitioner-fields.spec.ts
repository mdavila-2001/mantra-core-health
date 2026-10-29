import { FormControl } from '@angular/forms';

import {
  practitionerField,
  practitionerFields,
  validateOptionalPractitionerPhone,
  validatePractitionerPersonalEmail,
  validatePractitionerPhone,
} from './practitioner-fields';

const context = {
  professionalTitle: 'Médico / Médica',
  departmentIssuerField: () => ({
    key: 'issuerAdministrativeAreaConceptId',
    label: 'Departamento de emisión',
    control: 'select' as const,
    required: true,
    options: [],
  }),
};

describe('practitionerFields', () => {
  it('agrupa el alta en nueve páginas, con el correo y la contraseña juntos', () => {
    const pages = practitionerFields(context);

    // Eran quince; el propietario pidió juntarlas (26/10/2026).
    expect(pages.length).toBe(9);
    expect(pages.every((page) => page.campos.length <= 6)).toBe(true);
    const access = pages.find((page) => page.clave === 'access')?.campos.map((c) => c.key);
    expect(access).toContain('personalEmail');
    expect(access).toContain('password');
    // La autoridad emisora ya no se pregunta.
    expect(pages.flatMap((page) => page.campos).map((c) => c.key)).not.toContain(
      'regulatoryAuthority',
    );
    expect(pages[0].clave).toBe('name');
    expect(pages.map((page) => page.clave)).toContain('specialties');
  });

  it('cambia el rótulo de la matrícula según el título profesional', () => {
    const dentistry = practitionerFields({
      ...context,
      professionalTitle: 'Odontólogo / Odontóloga',
    });
    const medicine = practitionerFields(context);

    expect(dentistry.find((page) => page.clave === 'credentials')?.campos[0].label).toBe(
      'Matrícula de Odontólogo',
    );
    expect(medicine.find((page) => page.clave === 'credentials')?.campos[0].label).toBe(
      'Matrícula Profesional (Médico)',
    );
  });

  it('usa el campo del departamento que le da la pantalla', () => {
    expect(practitionerField('issuerAdministrativeAreaConceptId', context)).toMatchObject({
      control: 'select',
      required: true,
    });
  });

  it('expone la definición de un campo para reutilizar su rótulo y sus reglas', () => {
    expect(practitionerField('lastName', context)).toMatchObject({
      label: 'Apellido paterno',
      required: true,
      mensajeDeError: 'Ingrese su apellido paterno.',
    });
    expect(practitionerField('birthDate', context)).toMatchObject({
      required: true,
      maxDate: 'today',
    });
    expect(practitionerField('name', context)).toMatchObject({
      required: true,
      mensajeDeError: 'Ingrese su nombre.',
    });
    expect(practitionerField('motherLastName', context)?.required).toBeFalsy();
    expect(practitionerField('campo-inexistente', context)).toBeUndefined();
  });
});

describe('validateOptionalPractitionerPhone', () => {
  it('acepta el campo vacío y un número completo', () => {
    expect(validateOptionalPractitionerPhone(new FormControl(''))).toBeNull();
    expect(validateOptionalPractitionerPhone(new FormControl('+591 70012345'))).toBeNull();
  });

  it('rechaza un número incompleto', () => {
    expect(validateOptionalPractitionerPhone(new FormControl('+591 7001'))).toEqual({
      telefonoIncompleto: true,
    });
  });
});

describe('validatePractitionerPhone', () => {
  it('exige el celular personal y rechaza uno incompleto', () => {
    expect(validatePractitionerPhone(new FormControl(''))).toEqual({ required: true });
    expect(validatePractitionerPhone(new FormControl('+591 7001'))).toEqual({
      telefonoIncompleto: true,
    });
    expect(validatePractitionerPhone(new FormControl('+591 70012345'))).toBeNull();
  });
});

describe('validatePractitionerPersonalEmail', () => {
  it('exige el correo personal y valida su forma', () => {
    expect(validatePractitionerPersonalEmail(new FormControl(''))).toEqual({ required: true });
    expect(validatePractitionerPersonalEmail(new FormControl('no-es-un-correo'))).toEqual({
      email: true,
    });
    expect(validatePractitionerPersonalEmail(new FormControl('ana@clinica.bo'))).toBeNull();
  });
});
