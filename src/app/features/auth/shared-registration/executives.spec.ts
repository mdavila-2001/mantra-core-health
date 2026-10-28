import { executivesControls, executivesFrom, executivesIncomplete, executivesPages, type ExecutivesRaw } from './executives';
import { FormGroup } from '@angular/forms';

function formulario() {
  return new FormGroup(executivesControls());
}

function completar(form: ReturnType<typeof formulario>): void {
  form.patchValue({
    generalManagerName: { name: 'Gabriel', lastName: 'Gómez' },
    generalManagerPhone: '+591 70011111',
    generalManagerEmail: 'general@x.test',
    salesManagerName: { name: 'Carla', middleName: 'Ana', lastName: 'Cruz' },
    salesManagerPhone: '+591 70022222',
    salesManagerEmail: 'comercial@x.test',
    marketingManagerName: { name: 'Mario', lastName: 'Mena' },
    marketingManagerPhone: '+591 70033333',
    marketingManagerEmail: 'marketing@x.test',
  });
}

describe('gerencias del alta (shared-registration/executives)', () => {
  it('son opcionales: un formulario vacío es válido y no manda nada', () => {
    const form = formulario();
    expect(form.valid).toBe(true);
    expect(executivesFrom(form.getRawValue() as ExecutivesRaw)).toBeNull();
    expect(executivesIncomplete(form.getRawValue() as ExecutivesRaw)).toBe(false);
  });

  it('con las tres completas arma el bloque con el nombre completo', () => {
    const form = formulario();
    completar(form);

    expect(executivesFrom(form.getRawValue() as ExecutivesRaw)).toEqual({
      generalManager: { fullName: 'Gabriel Gómez', phone: '+591 70011111', email: 'general@x.test' },
      commercialManager: { fullName: 'Carla Ana Cruz', phone: '+591 70022222', email: 'comercial@x.test' },
      marketingManager: { fullName: 'Mario Mena', phone: '+591 70033333', email: 'marketing@x.test' },
    });
    expect(executivesIncomplete(form.getRawValue() as ExecutivesRaw)).toBe(false);
  });

  it.each([
    ['el celular', { marketingManagerPhone: '' }],
    ['el correo', { generalManagerEmail: '' }],
    ['el nombre', { salesManagerName: { name: '', middleName: '', lastName: '' } }],
  ])('si en una gerencia falta %s, el bloque es todo o nada: no viaja y se marca incompleto', (_etiqueta, cambio) => {
    const form = formulario();
    completar(form);
    form.patchValue(cambio);
    const raw = form.getRawValue() as ExecutivesRaw;

    expect(executivesFrom(raw)).toBeNull();
    expect(executivesIncomplete(raw)).toBe(true);
  });

  it('un correo mal escrito invalida el control aunque la gerencia sea opcional', () => {
    const form = formulario();
    form.controls.generalManagerEmail.setValue('no-es-correo');
    expect(form.controls.generalManagerEmail.invalid).toBe(true);
  });

  it('un celular incompleto invalida el control', () => {
    const form = formulario();
    form.controls.salesManagerPhone.setValue('+591 700');
    expect(form.controls.salesManagerPhone.invalid).toBe(true);
  });

  it('declara tres páginas, cada una con nombre, celular y correo y los testId con el prefijo dado', () => {
    const paginas = executivesPages('registro-x');

    expect(paginas.map((p) => p.clave)).toEqual(['gerencia-general', 'gerencia-comercial', 'gerencia-marketing']);
    expect(paginas[1]!.campos.map((c) => c.key)).toEqual([
      'salesManagerName',
      'salesManagerPhone',
      'salesManagerEmail',
    ]);
    expect(paginas[0]!.campos[1]!.testId).toBe('registro-x-gerente-general-celular');
    expect(paginas[2]!.campos[2]!.testId).toBe('registro-x-gerente-marketing-correo');
  });
});
