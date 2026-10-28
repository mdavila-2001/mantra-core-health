import { base16, cadenaCuf, fechaHoraParaCuf, generarCuf, modulo11 } from './cuf';

/**
 * El ejemplo oficial de «Generación del CUF» (siatinfo.impuestos.gob.bo,
 * leído el 2026-09-26). Si esta prueba se pone roja, el algoritmo dejó de ser
 * el del SIN.
 */
const EJEMPLO_OFICIAL = {
  campos: {
    nit: '123456789',
    fechaHora: '20190113163721231',
    sucursal: 0,
    modalidad: 1,
    tipoEmision: 1,
    tipoFactura: 1,
    tipoDocumentoSector: 1,
    numeroFactura: 1,
    puntoVenta: 0,
  },
  cadena53: '00001234567892019011316372123100001110100000000010000',
  conModulo11: '000012345678920190113163721231000011101000000000100001',
  enBase16: '8727F63A15F8976591FDDE5B387C5D015A29E06A1',
  codigoControl: 'A19E23EF34124CD',
  cuf: '8727F63A15F8976591FDDE5B387C5D015A29E06A1A19E23EF34124CD',
};

describe('CUF · algoritmo oficial del SIN', () => {
  it('arma la cadena de 53 dígitos con los anchos de la tabla', () => {
    const cadena = cadenaCuf(EJEMPLO_OFICIAL.campos);
    expect(cadena).toBe(EJEMPLO_OFICIAL.cadena53);
    expect(cadena).toHaveLength(53);
  });

  it('el autoverificador Módulo 11 del ejemplo es 1', () => {
    const cadena = EJEMPLO_OFICIAL.cadena53;
    expect(cadena + modulo11(cadena)).toBe(EJEMPLO_OFICIAL.conModulo11);
  });

  it('Base 16 convierte la cadena entera como un solo número', () => {
    expect(base16(EJEMPLO_OFICIAL.conModulo11)).toBe(EJEMPLO_OFICIAL.enBase16);
  });

  it('reproduce el CUF final del ejemplo oficial', () => {
    expect(generarCuf(EJEMPLO_OFICIAL.campos, EJEMPLO_OFICIAL.codigoControl)).toBe(EJEMPLO_OFICIAL.cuf);
  });

  it('Módulo 11 devuelve «1» cuando el resto es 10', () => {
    // 2·5 = 10 → resto 10 → «1».
    expect(modulo11('5')).toBe('1');
    // 2·1 = 2 → «2».
    expect(modulo11('1')).toBe('2');
  });

  it('rechaza un campo que no entra en su ancho', () => {
    expect(() => cadenaCuf({ ...EJEMPLO_OFICIAL.campos, sucursal: 10000 })).toThrow(/excede 4/);
    expect(() => cadenaCuf({ ...EJEMPLO_OFICIAL.campos, nit: '12345678901234' })).toThrow(/excede 13/);
  });

  it('rechaza un campo no numérico', () => {
    expect(() => cadenaCuf({ ...EJEMPLO_OFICIAL.campos, nit: 'ABC' })).toThrow(/numérico/);
  });

  it('toma la fecha del XML sin reinterpretar zona horaria', () => {
    expect(fechaHoraParaCuf('2021-10-06T16:03:48.675')).toBe('20211006160348675');
    expect(() => fechaHoraParaCuf('2021-10-06T16:03:48Z')).toThrow(/formato/);
  });
});
