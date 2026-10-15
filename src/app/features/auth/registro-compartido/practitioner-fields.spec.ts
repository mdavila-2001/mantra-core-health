import { FormControl } from '@angular/forms';

import {
  practitionerField,
  practitionerFields,
  validatePractitionerPersonalEmail,
  validatePractitionerPhone,
  validateOptionalPractitionerPhone,
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
  it('mantiene las páginas del alta y el máximo del motor de cuatro campos', () => {
    const paginas = practitionerFields(context);

    expect(paginas.length).toBeGreaterThan(10);
    expect(paginas.every((pagina) => pagina.campos.length <= 4)).toBe(true);
    expect(paginas.map((pagina) => pagina.clave)).toContain('specialties');
  });

  it('resuelve las mismas etiquetas de matrícula según el título profesional', () => {
    const odontologia = practitionerFields({
      ...context,
      professionalTitle: 'Odontólogo / Odontóloga',
    });
    const medicina = practitionerFields(context);

    expect(odontologia.find((pagina) => pagina.clave === 'credentials')?.campos[0].label).toBe(
      'Matrícula de Odontólogo',
    );
    expect(medicina.find((pagina) => pagina.clave === 'credentials')?.campos[0].label).toBe(
      'Matrícula Profesional (Médico)',
    );
  });

  it('expone una definición reutilizable y obligatoria para el nombre', () => {
    expect(practitionerField('name', context)).toMatchObject({
      key: 'name',
      required: true,
      mensajeDeError: 'Ingrese su nombre.',
    });
    expect(practitionerField('campo-inexistente', context)).toBeUndefined();
  });
});

describe('validateOptionalPractitionerPhone', () => {
  it('acepta el campo vacío y un número completo', () => {
    const vacio = new FormControl('', {
      nonNullable: true,
      validators: [validateOptionalPractitionerPhone],
    });
    const completo = new FormControl('+591 70012345', {
      nonNullable: true,
      validators: [validateOptionalPractitionerPhone],
    });

    expect(vacio.valid).toBe(true);
    expect(completo.valid).toBe(true);
  });

  it('rechaza un número incompleto con el validador que comparte el alta', () => {
    const control = new FormControl('+591 7001', {
      nonNullable: true,
      validators: [validateOptionalPractitionerPhone],
    });

    expect(control.invalid).toBe(true);
    expect(control.errors).toEqual({ telefonoIncompleto: true });
  });
});

describe('validatePractitionerPhone', () => {
  it('exige el teléfono personal del alta y rechaza números incompletos', () => {
    const vacio = new FormControl('', {
      nonNullable: true,
      validators: [validatePractitionerPhone],
    });
    const incompleto = new FormControl('+591 7001', {
      nonNullable: true,
      validators: [validatePractitionerPhone],
    });
    const completo = new FormControl('+591 70012345', {
      nonNullable: true,
      validators: [validatePractitionerPhone],
    });

    expect(vacio.errors).toEqual({ required: true });
    expect(incompleto.errors).toEqual({ telefonoIncompleto: true });
    expect(completo.valid).toBe(true);
  });
});

describe('validatePractitionerPersonalEmail', () => {
  it('requiere el correo personal y valida su formato como en el alta', () => {
    const vacio = new FormControl('');
    const invalido = new FormControl('no-es-un-correo');
    const valido = new FormControl('ana@clinica.bo');

    expect(validatePractitionerPersonalEmail(vacio)).toEqual({ required: true });
    expect(validatePractitionerPersonalEmail(invalido)).toEqual({ email: true });
    expect(validatePractitionerPersonalEmail(valido)).toBeNull();
  });
});
