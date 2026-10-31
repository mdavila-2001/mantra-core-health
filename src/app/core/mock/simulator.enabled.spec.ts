import { describe, expect, it } from 'vitest';

import * as enchufe from '../simulator/simulator';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { MockBanner } from './mock-banner';
import { MOCK_USERS } from './mock-session';

/* Las pruebas compilan con la configuración `development`, que reemplaza el enchufe neutro por
   `simulator.enabled.ts` (`angular.json`, O3-4). Si ese reemplazo se pierde, la aplicación en
   desarrollo y en la demo se queda sin simulador sin que nada lo diga: esto lo dice. */
describe('enchufe del simulador en development', () => {
  it('registra el interceptor del backend simulado', () => {
    expect(enchufe.simulatorInterceptors).toEqual([mockBackendInterceptor]);
  });

  it('expone las cuentas de prueba del simulador', () => {
    expect(enchufe.MOCK_USERS).toBe(MOCK_USERS);
    expect(enchufe.MOCK_USERS.length).toBeGreaterThan(0);
  });

  it('emite tokens de prueba para una cuenta', () => {
    const cuenta = enchufe.MOCK_USERS[0];
    expect(cuenta).toBeDefined();
    if (cuenta === undefined) return;
    expect(enchufe.emitirAccessToken(cuenta).split('.')).toHaveLength(3);
    expect(enchufe.emitirRefreshToken(cuenta)).not.toBe('');
  });

  it('carga el cartel «Modo demo» en su propio fragmento', async () => {
    expect(enchufe.loadSimulatorBanner).not.toBeNull();
    await expect(enchufe.loadSimulatorBanner?.()).resolves.toBe(MockBanner);
  });

  it('genera valores para las entradas de un componente', () => {
    const generados = enchufe.generarEntradas([{ nombre: 'label', tipo: 'string', requerido: true }], 'semilla');
    expect(generados.valores['label']).toBeDefined();
  });
});
