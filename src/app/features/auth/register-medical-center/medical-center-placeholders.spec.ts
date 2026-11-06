import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { medicalCenterPages } from './medical-center-pages';

/** Controls that render an empty box unless the field declares an example. */
const WITH_FREE_TEXT = new Set(['text', 'email', 'password']);

const POWER_FIELD: CampoDeFormulario = {
  key: 'powerOfAttorneyFileId',
  label: 'Poder',
  control: 'custom',
  mensajeDeError: '',
};

describe('medicalCenterPages · empty fields show an example', () => {
  const pages = medicalCenterPages({
    tiposDeOrganizacion: [],
    tiposSocietarios: [],
    camposDeDocumentos: [],
    campoDePoder: POWER_FIELD,
    gerenciasEnUso: true,
  });
  const fields = pages.flatMap((page) => page.campos);

  it('every text, email and password field declares a placeholder', () => {
    const bare = fields
      .filter((field) => WITH_FREE_TEXT.has(field.control) && !field.placeholder)
      .map((field) => field.key);

    expect(bare).toEqual([]);
  });

  it('checks something: the form has text, email and password fields', () => {
    const controls = new Set(fields.map((field) => field.control));

    expect([...WITH_FREE_TEXT].every((control) => controls.has(control as never))).toBe(true);
  });
});
