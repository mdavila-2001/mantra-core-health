import { nameGroup, nameParts, completeName, type NameValue } from './person-name';

function valor(parcial: Partial<NameValue>): NameValue {
  return {
    name: '',
    middleName: '',
    thirdName: '',
    extraNames: [],
    lastName: '',
    motherLastName: '',
    ...parcial,
  };
}

describe('nameParts', () => {
  it('manda sólo nombre y apellido cuando no hay más', () => {
    expect(nameParts(valor({ name: ' Ana ', lastName: ' Paz ' }))).toEqual({ name: 'Ana', lastName: 'Paz' });
  });

  it('pliega segundo, tercero y los agregados en middleName, en orden', () => {
    expect(
      nameParts(
        valor({
          name: 'Ana',
          middleName: 'Lucía',
          thirdName: 'María',
          extraNames: ['Isabel', ' '],
          lastName: 'Rojas',
          motherLastName: 'Paz',
        }),
      ),
    ).toEqual({
      name: 'Ana',
      middleName: 'Lucía María Isabel',
      lastName: 'Rojas',
      motherLastName: 'Paz',
    });
  });

  it('es consistente con el nombre completo', () => {
    const v = valor({ name: 'Ana', middleName: 'Lucía', lastName: 'Rojas', motherLastName: 'Paz' });
    const p = nameParts(v);

    expect([p.name, p.middleName, p.lastName, p.motherLastName].join(' ')).toBe(completeName(v));
  });

  it('un grupo obligatorio exige primer nombre y apellido paterno', () => {
    const grupo = nameGroup(true);
    expect(grupo.invalid).toBe(true);
    grupo.patchValue({ name: 'Ana', lastName: 'Paz' });
    expect(grupo.valid).toBe(true);
  });
});
