import { tonoDeEstadoDeReclamo } from './insurance-status-tone';

describe('tono del estado de una solicitud de seguro', () => {
  it.each([
    ['APPROVED', 'success'],
    ['PAID', 'success'],
    ['PARTIAL', 'warning'],
    ['REJECTED', 'error'],
    ['IN_REVIEW', 'info'],
    ['SUBMITTED', 'info'],
    ['ALGO_NUEVO', 'info'],
  ])('el estado %s se ve con el tono %s', (codigo, tono) => {
    expect(tonoDeEstadoDeReclamo(codigo)).toBe(tono);
  });
});
