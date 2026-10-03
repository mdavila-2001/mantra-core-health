import { esCodigoDeAlergia } from './alergias';

describe('esCodigoDeAlergia', () => {
  it('reconoce los códigos CIE-10 de alergia', () => {
    for (const codigo of ['Z88', 'Z88.0', 'Z88.6', 'Z91.0', 'T78.0', 'T78.4', 'T88.6']) {
      expect(esCodigoDeAlergia(codigo)).toBe(true);
    }
  });

  it('no confunde vecinos del mismo capítulo ni otros diagnósticos', () => {
    for (const codigo of ['Z91.1', 'T78.5', 'T78.8', 'T88.7', 'J45', 'L20', 'E11', '', undefined]) {
      expect(esCodigoDeAlergia(codigo)).toBe(false);
    }
  });
});
