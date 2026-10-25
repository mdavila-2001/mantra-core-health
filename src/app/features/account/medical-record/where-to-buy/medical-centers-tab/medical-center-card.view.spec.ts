import type {
  MedicalCenterItem,
  MedicalCenterOffer,
} from '../../../../../core/data-access/medical-centers/medical-centers.types';
import {
  medicalCenterCard,
  SUGGESTED_BADGE,
  visibleMedicalCenters,
  WORKS_HERE_BADGE,
  type CardLabels,
} from './medical-center-card.view';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const LABELS: CardLabels = {
  procedures: new Map([
    ['11111111-1111-4111-8111-111111111111', 'Endoscopia digestiva alta'],
    ['22222222-2222-4222-8222-222222222222', 'Colonoscopia'],
  ]),
  currencies: new Map([['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'BOB']]),
};

const oferta = (cambios: Partial<MedicalCenterOffer> = {}): MedicalCenterOffer => ({
  procedureConceptId: '11111111-1111-4111-8111-111111111111',
  procedureDisplay: 'Endoscopia digestiva alta',
  price: 650,
  currencyConceptId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  referencePrice: 380,
  referenceUnit: 'UMA',
  overMargin: null,
  ...cambios,
});

const centro = (cambios: Partial<MedicalCenterItem> = {}): MedicalCenterItem => ({
  practiceId: 'p-1',
  practiceSiteId: 's-1',
  name: 'Clínica Norte',
  addressText: 'Av. Banzer',
  latitude: -17.7381,
  longitude: -63.1659,
  distanceKm: 2.44,
  complete: true,
  missingProcedureConceptIds: [],
  offers: [oferta()],
  totalPrice: 1550,
  ...cambios,
});

describe('medicalCenterCard', () => {
  it('muestra la referencia con su unidad, UMA o USD', () => {
    const tarjeta = medicalCenterCard(
      centro({
        offers: [
          oferta(),
          oferta({ procedureDisplay: 'Electrocardiograma', referencePrice: 25, referenceUnit: 'USD' }),
        ],
      }),
      LABELS,
    );

    expect(tarjeta.offers.map((o) => o.reference)).toEqual([
      'Referencia: 380,00 UMA',
      'Referencia: 25,00 USD',
    ]);
  });

  it('sin referencia dice «Sin referencia»', () => {
    const sinPrecio = medicalCenterCard(
      centro({ offers: [oferta({ referencePrice: null, referenceUnit: null })] }),
      LABELS,
    );
    const sinUnidad = medicalCenterCard(
      centro({ offers: [oferta({ referencePrice: 380, referenceUnit: null })] }),
      LABELS,
    );

    expect(sinPrecio.offers[0]?.reference).toBe('Sin referencia');
    expect(sinUnidad.offers[0]?.reference).toBe('Sin referencia');
  });

  it('el precio lleva su moneda; sin etiqueta de moneda, el número solo', () => {
    const con = medicalCenterCard(centro(), LABELS);
    const sin = medicalCenterCard(centro(), { ...LABELS, currencies: new Map() });

    expect(con.offers[0]?.price).toBe('650,00 Bs');
    expect(con.total).toBe('Total: 1.550,00 Bs');
    expect(sin.offers[0]?.price).toBe('650,00');
    expect(sin.total).toBe('Total: 1.550,00');
  });

  it('la distancia es «x km en línea recta», o nada si no hay', () => {
    expect(medicalCenterCard(centro(), LABELS).distance).toBe('2,4 km en línea recta');
    expect(medicalCenterCard(centro({ distanceKm: null }), LABELS).distance).toBeNull();
  });

  it('sin total de la API, no hay total', () => {
    expect(medicalCenterCard(centro({ totalPrice: null }), LABELS).total).toBeNull();
  });

  it('overMargin null no avisa; solo un true que calculó la API', () => {
    const nulo = medicalCenterCard(centro({ offers: [oferta({ overMargin: null })] }), LABELS);
    const falso = medicalCenterCard(centro({ offers: [oferta({ overMargin: false })] }), LABELS);
    const verdadero = medicalCenterCard(centro({ offers: [oferta({ overMargin: true })] }), LABELS);

    expect(nulo.offers[0]?.overMargin).toBe(false);
    expect(falso.offers[0]?.overMargin).toBe(false);
    expect(verdadero.offers[0]?.overMargin).toBe(true);
  });

  it('«Cómo llegar» abre OpenStreetMap solo con el destino', () => {
    const tarjeta = medicalCenterCard(centro({ latitude: -17.5, longitude: -63.25 }), LABELS);

    expect(tarjeta.directions).toBe('https://www.openstreetmap.org/directions?route=%3B-17.5%2C-63.25');
  });

  it('sin coordenadas, o en 0,0, no hay «Cómo llegar»', () => {
    expect(medicalCenterCard(centro({ latitude: null, longitude: null }), LABELS).directions).toBeNull();
    expect(medicalCenterCard(centro({ latitude: 0, longitude: 0 }), LABELS).directions).toBeNull();
    expect(medicalCenterCard(centro({ latitude: -17.5, longitude: null }), LABELS).directions).toBeNull();
  });

  it('los distintivos salen de los flags, con los textos de A-12', () => {
    const ninguno = medicalCenterCard(centro(), LABELS);
    const ambos = medicalCenterCard(
      centro({ practitionerWorksHere: true, suggestedByPractitioner: true }),
      LABELS,
    );

    expect([ninguno.worksHere, ninguno.suggested]).toEqual([false, false]);
    expect([ambos.worksHere, ambos.suggested]).toEqual([true, true]);
    expect(WORKS_HERE_BADGE).toBe('Su médico trabaja en este centro');
    expect(SUGGESTED_BADGE).toBe('Sugerido por su médico');
  });

  it('los distintivos no cambian nada más de la tarjeta', () => {
    const sin = medicalCenterCard(centro(), LABELS);
    const con = medicalCenterCard(
      centro({ practitionerWorksHere: true, suggestedByPractitioner: true }),
      LABELS,
    );

    expect({ ...con, worksHere: false, suggested: false }).toEqual(sin);
  });

  it('los faltantes salen por nombre y nunca por uuid', () => {
    const parcial = medicalCenterCard(
      centro({
        complete: false,
        missingProcedureConceptIds: [
          '22222222-2222-4222-8222-222222222222',
          '99999999-9999-4999-8999-999999999999',
        ],
        totalPrice: null,
      }),
      LABELS,
    );

    expect(parcial.missing).toEqual(['Colonoscopia', 'otro procedimiento']);
    expect(parcial.missing.join(' ')).not.toMatch(UUID);
  });
});

describe('visibleMedicalCenters', () => {
  const items = [
    centro({ practiceSiteId: 'a', complete: true }),
    centro({ practiceSiteId: 'b', complete: false }),
    centro({ practiceSiteId: 'c', complete: true }),
    centro({ practiceSiteId: 'd', complete: false }),
  ];

  it('por defecto solo los completos, en el mismo orden relativo', () => {
    expect(visibleMedicalCenters(items, false).map((i) => i.practiceSiteId)).toEqual(['a', 'c']);
  });

  it('con los parciales, la lista recibida idéntica', () => {
    expect(visibleMedicalCenters(items, true)).toBe(items);
  });

  it('no reordena: ni siquiera un sugerido sube', () => {
    const sugerido = [items[0]!, { ...items[2]!, suggestedByPractitioner: true }];

    expect(visibleMedicalCenters(sugerido, false).map((i) => i.practiceSiteId)).toEqual(['a', 'c']);
  });
});
