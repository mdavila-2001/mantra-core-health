import { fitsSex, withSpecialtiesForSex } from './sex-filter';
import { recommend, SYMPTOMS_ALL, type Sintoma } from './symptoms';

const sintoma = (id: string): Sintoma => {
  const s = SYMPTOMS_ALL.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no existe ${id}`);
  return s;
};

describe('sex-filter · una cuenta de varón no ve lo de mujer (P-04)', () => {
  it('el control ginecológico es sólo de mujer', () => {
    expect(fitsSex(sintoma('control-ginecologico'), 'MALE')).toBe(false);
    expect(fitsSex(sintoma('control-ginecologico'), 'FEMALE')).toBe(true);
  });

  it('sin sexo conocido no se esconde nada', () => {
    expect(fitsSex(sintoma('flujo-vaginal'), undefined)).toBe(true);
    expect(withSpecialtiesForSex(sintoma('bulto-en-la-mama'), undefined)).toBe(sintoma('bulto-en-la-mama'));
  });

  it.each(['bulto-en-la-mama', 'dolor-al-tener-relaciones', 'anticoncepcion', 'ardor-al-orinar', 'infeccion-de-transmision-sexual'])(
    'a un varón no se le recomienda Ginecología ni Obstetricia por «%s»',
    (id) => {
      const nombres = recommend([withSpecialtiesForSex(sintoma(id), 'MALE')]).map((r) => r.nombre);
      expect(nombres).not.toContain('Ginecología');
      expect(nombres).not.toContain('Obstetricia');
      expect(nombres.length).toBeGreaterThan(0);
    },
  );

  it('a una mujer se le sigue recomendando Ginecología', () => {
    const nombres = recommend([withSpecialtiesForSex(sintoma('bulto-en-la-mama'), 'FEMALE')]).map((r) => r.nombre);
    expect(nombres).toContain('Ginecología');
  });
});
