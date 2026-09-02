import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';

import { formatMoney, hasPriceRange, priceText, toMedicationCard } from './medication-card.mapper';

function medicamento(extra: Partial<TarjetaDeMedicamento> = {}): TarjetaDeMedicamento {
  return {
    conceptId: 'concept-losartan',
    atcCode: 'C09CA01',
    genericName: 'Losartán',
    therapeuticGroup: 'Cardiovascular',
    brands: ['Cozaar', 'Losacor'],
    presentations: ['50 mg comprimidos'],
    requiresPrescription: true,
    priceFrom: '18.50',
    priceTo: '29.74',
    currency: 'BOB',
    pharmacyCount: 4,
    nearestKm: 1.24,
    ...extra,
  };
}

describe('formatMoney', () => {
  it('reformatea el texto del backend, no lo convierte a número', () => {
    expect(formatMoney('18.50', 'BOB')).toBe('Bs 18,50');
  });

  it('con otra moneda usa su código: no se inventa un símbolo', () => {
    expect(formatMoney('10.00', 'USD')).toBe('USD 10,00');
  });
});

describe('priceText', () => {
  it('dice «desde» sólo cuando las farmacias no coinciden', () => {
    expect(hasPriceRange(medicamento())).toBe(true);
    expect(priceText(medicamento())).toBe('desde Bs 18,50');
  });

  it('con un único precio no insinúa que en algún lado sale más caro', () => {
    const unico = medicamento({ priceFrom: '18.50', priceTo: '18.50' });
    expect(hasPriceRange(unico)).toBe(false);
    expect(priceText(unico)).toBe('Bs 18,50');
  });
});

describe('toMedicationCard', () => {
  it('no enlaza a ninguna ficha: un medicamento no tiene perfil público', () => {
    expect(toMedicationCard(medicamento()).card.link).toBeNull();
  });

  it('degrada a las iniciales, nunca a una foto de archivo (AC-06-3)', () => {
    const { card } = toMedicationCard(medicamento());

    expect(card.portada).toBeNull();
    expect(card.logo).toBeNull();
    expect(card.iniciales).not.toBe('');
  });

  it('muestra los tres datos del vertical: precio, farmacias y receta (AC-06-4)', () => {
    const { card } = toMedicationCard(medicamento());
    const claves = card.atributos.map((atributo) => atributo.clave);

    expect(claves).toContain('precio');
    expect(claves).toContain('farmacias');
    expect(card.sellos.map((sello) => sello.texto)).toContain('Con receta');
  });

  it('sin origen no hay distancia: el campo no viene y no se dibuja (AC-06-19)', () => {
    const { card, details } = toMedicationCard(medicamento({ nearestKm: null }));

    expect(card.atributos.map((atributo) => atributo.clave)).not.toContain('distancia');
    expect(details.map((fila) => fila.label)).not.toContain('La más cercana');
  });

  it('con origen rotula la distancia como recta, nunca como trayecto (AC-06-15)', () => {
    const { card, details } = toMedicationCard(medicamento());

    const distancia = card.atributos.find((atributo) => atributo.clave === 'distancia');
    expect(distancia?.texto).toBe('a 1,2 km');
    expect(details.find((fila) => fila.label === 'La más cercana')?.value).toBe(
      '1,2 km en línea recta',
    );
  });

  it('sin marcas ni presentaciones esas filas no existen', () => {
    const { card, details } = toMedicationCard(medicamento({ brands: [], presentations: [] }));

    expect(card.titular).toBeNull();
    const rotulos = details.map((fila) => fila.label);
    expect(rotulos).not.toContain('Marcas publicadas');
    expect(rotulos).not.toContain('Presentaciones');
  });

  it('de venta libre lo dice, y no deja el renglón en blanco', () => {
    const { details } = toMedicationCard(medicamento({ requiresPrescription: false }));

    expect(details.find((fila) => fila.label === 'Venta')?.value).toBe('Venta libre');
  });
});
