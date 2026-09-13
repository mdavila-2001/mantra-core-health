import { environment as produccion } from './environment';
import { environment as desarrollo } from './environment.development';
import { environment as apiReal } from './environment.real-api';

/**
 * El modo `real-api` (B-24): apaga el backend simulado y no toca nada más.
 *
 * El cableado en `angular.json` y `package.json` lo verifica
 * `scripts/check-real-api-config.mjs`; acá se fija el valor de cada entorno.
 */
describe('environment.real-api', () => {
  it('apaga el backend simulado', () => {
    expect(apiReal.mockBackend).toBe(false);
  });

  it('desarrollo sigue con la maqueta encendida', () => {
    expect(desarrollo.mockBackend).toBe(true);
  });

  it('producción sigue con la maqueta encendida', () => {
    expect(produccion.mockBackend).toBe(true);
  });

  it('fuera de mockBackend es idéntico a desarrollo', () => {
    expect({ ...apiReal, mockBackend: desarrollo.mockBackend }).toEqual(desarrollo);
  });
});
