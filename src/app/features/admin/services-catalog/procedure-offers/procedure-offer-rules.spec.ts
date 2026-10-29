import {
  NOT_IN_SEARCH_LABEL,
  NO_PRICE_LABEL,
  NO_REFERENCE_LABEL,
  OVER_MARGIN_NOTICE,
  overMarginNotice,
  ownPriceText,
  referenceText,
  visibilityLabel,
} from './procedure-offer-rules';

describe('procedure-offer-rules', () => {
  describe('visibilityLabel', () => {
    it('con visibleInSearch en false dice «No aparece en búsquedas»', () => {
      expect(visibilityLabel({ visibleInSearch: false })).toBe(NOT_IN_SEARCH_LABEL);
      expect(NOT_IN_SEARCH_LABEL).toBe('No aparece en búsquedas');
    });

    it('con visibleInSearch en true no repite nada', () => {
      expect(visibilityLabel({ visibleInSearch: true })).toBeNull();
    });
  });

  describe('referenceText', () => {
    it('escribe la unidad al lado: UMA y USD', () => {
      expect(referenceText({ referencePrice: 20, referenceUnit: 'UMA' })).toBe('Referencia: 20 UMA');
      expect(referenceText({ referencePrice: 12.5, referenceUnit: 'USD' })).toBe('Referencia: 12.50 USD');
    });

    it('con precio o unidad nulos dice «Sin referencia»', () => {
      expect(referenceText({ referencePrice: null, referenceUnit: null })).toBe(NO_REFERENCE_LABEL);
      expect(referenceText({ referencePrice: 20, referenceUnit: null })).toBe(NO_REFERENCE_LABEL);
      expect(referenceText({ referencePrice: null, referenceUnit: 'UMA' })).toBe(NO_REFERENCE_LABEL);
    });
  });

  describe('ownPriceText', () => {
    it('muestra el precio con la moneda visible y, sin precio, lo dice', () => {
      expect(ownPriceText({ price: 350 })).toBe('350 Bs');
      expect(ownPriceText({ price: 99.9 })).toBe('99.90 Bs');
      expect(ownPriceText({ price: null })).toBe(NO_PRICE_LABEL);
    });
  });

  describe('overMarginNotice', () => {
    it('null y false no avisan; sólo true pinta el aviso', () => {
      expect(overMarginNotice({ overMargin: null })).toBeNull();
      expect(overMarginNotice({ overMargin: false })).toBeNull();
      expect(overMarginNotice({ overMargin: true })).toBe(OVER_MARGIN_NOTICE);
    });
  });
});
