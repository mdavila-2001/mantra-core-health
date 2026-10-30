import {
  ANALYSIS_CATEGORIES,
  PROCEDURE_CATEGORY_CODES,
  categoriaDeAnalisis,
  tipoDeOrden,
  etiquetaDeCategoria,
} from './diagnostic-orders.types';

describe('diagnostic-orders.types', () => {
  describe('categoriaDeAnalisis', () => {
    it.each(['SRQ-PROCEDURE', 'SR_PROCEDURE', 'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE'])(
      '%s es una orden de procedimiento',
      (codigo) => {
        expect(categoriaDeAnalisis(codigo)).toBe('PROCEDURE');
      },
    );

    it('laboratorio e imagenología siguen igual', () => {
      expect(categoriaDeAnalisis('SRQ-LAB')).toBe('LAB');
      expect(categoriaDeAnalisis('SRQ-IMAGING')).toBe('IMAGING');
    });

    it('un código desconocido o ausente cae en Otros', () => {
      expect(categoriaDeAnalisis('SRQ-REFERRAL')).toBe('OTHER');
      expect(categoriaDeAnalisis('procedure')).toBe('OTHER');
      expect(categoriaDeAnalisis(undefined)).toBe('OTHER');
    });
  });

  it('PROCEDURE_CATEGORY_CODES contiene exactamente los tres códigos de A-8', () => {
    expect([...PROCEDURE_CATEGORY_CODES].sort()).toEqual(
      ['SRQ-PROCEDURE', 'SR_PROCEDURE', 'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE'].sort(),
    );
  });

  it('la categoría de procedimiento se rotula «Procedimientos»', () => {
    expect(etiquetaDeCategoria('PROCEDURE')).toBe('Procedimientos');
    expect(ANALYSIS_CATEGORIES).toContain('PROCEDURE');
  });

  describe('tipoDeOrden (P40)', () => {
    it('usa la category que sirve la API', () => {
      expect(tipoDeOrden('LAB', undefined)).toBe('LAB');
      expect(tipoDeOrden('IMAGING', 'CUALQUIERA')).toBe('IMAGING');
      expect(tipoDeOrden('OTHER', undefined)).toBe('OTHER');
    });

    it('un procedimiento conserva su pestaña aunque C2 lo llame OTHER', () => {
      expect(tipoDeOrden('OTHER', 'SR_PROCEDURE')).toBe('PROCEDURE');
    });

    it('sin category no deduce laboratorio del código: cae en OTHER', () => {
      expect(tipoDeOrden(undefined, 'SRQ-LAB')).toBe('OTHER');
      expect(tipoDeOrden(undefined, undefined)).toBe('OTHER');
    });
  });
});
