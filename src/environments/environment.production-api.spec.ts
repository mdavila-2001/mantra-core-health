import { environment as productionApi } from './environment.production-api';
import { environment as produccion } from './environment';

/**
 * El modo `production-api` (H1.S1): el build real, con SSR encendido.
 *
 * Complementa a `environment.real-api.spec.ts`, que fija el contrato de
 * `real-api` (pensado para `ng serve`, sin SSR). Acá se fija que
 * `production-api` apaga el mock y **las cuatro** demostraciones — no sólo
 * dos, que es lo que hace `real-api` — porque contra la API real ninguna
 * demo puede fabricar datos que ningún backend respalda.
 */
describe('environment.production-api', () => {
  it('apaga el backend simulado', () => {
    expect(productionApi.mockBackend).toBe(false);
  });

  it('apaga las cuatro demostraciones', () => {
    expect(productionApi.demoPresets).toBe(false);
    expect(productionApi.paymentDemo).toBe(false);
    expect(productionApi.loyaltyDemo).toBe(false);
    expect(productionApi.campaignsDemo).toBe(false);
  });

  it('producción (la maqueta) sigue con el mock y las demos como estaban', () => {
    expect(produccion.mockBackend).toBe(true);
  });

  it('la raíz de la API y del triage se leen igual que en producción', () => {
    // No se compara `telemetry` completo: a diferencia de `environment.real-api.ts`
    // (que hereda `...environment.development` por spread), este archivo no puede
    // heredar de `environment.ts` — es el mismo path que `fileReplacements`
    // reemplaza por él, y hacerlo arma el ciclo que documenta el encabezado. Cada
    // uno resuelve `envFromProcess.telemetry` por su cuenta, así que sólo se fija
    // lo que tiene que ser igual pase lo que pase con el entorno del proceso.
    expect(productionApi.apiBaseUrl).toBe(produccion.apiBaseUrl);
    expect(productionApi.aiBaseUrl).toBe(produccion.aiBaseUrl);
  });
});
