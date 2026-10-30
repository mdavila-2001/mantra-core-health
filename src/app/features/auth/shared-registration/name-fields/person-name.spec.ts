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

describe('nameGroup(obligatorio, viajaEnPartes)', () => {
  it('por omisión no cambia lo de las demás altas: «   » sigue pasando required', () => {
    const grupo = nameGroup(true);
    grupo.patchValue({ name: '   ', lastName: '   ' });

    expect(grupo.valid).toBe(true);
    grupo.patchValue({ name: 'a'.repeat(100), middleName: 'b'.repeat(100), thirdName: 'c'.repeat(100) });
    expect(grupo.hasError('nombresAdicionalesLargos')).toBe(false);
  });

  it('si el nombre viaja en partes, «   » en el primer nombre o en el apellido es un dato que falta', () => {
    const grupo = nameGroup(true, true);
    grupo.patchValue({ name: '   ', lastName: 'Paz' });
    expect(grupo.controls.name.hasError('required')).toBe(true);

    grupo.patchValue({ name: 'Ana', lastName: ' \t ' });
    expect(grupo.controls.lastName.hasError('required')).toBe(true);
    expect(grupo.invalid).toBe(true);
  });

  it('el segundo nombre plegado no puede pasar de 100: 60 + 1 + 59 no, 49 + 1 + 50 sí', () => {
    const grupo = nameGroup(true, true);
    grupo.patchValue({ name: 'Ana', lastName: 'Paz', middleName: 'a'.repeat(60), thirdName: 'b'.repeat(59) });
    expect(grupo.hasError('nombresAdicionalesLargos')).toBe(true);
    expect(grupo.controls.middleName.valid).toBe(true);
    expect(grupo.controls.thirdName.valid).toBe(true);

    grupo.patchValue({ middleName: 'a'.repeat(49), thirdName: 'b'.repeat(50) });
    expect(grupo.valid).toBe(true);
    expect(nameParts(grupo.getRawValue() as NameValue).middleName).toHaveLength(100);
  });
});
