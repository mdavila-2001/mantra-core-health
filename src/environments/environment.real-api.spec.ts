import { environment as production } from './environment';
import { environment as development } from './environment.development';
import { environment as realApi } from './environment.real-api';
import { environment as productionApi } from './environment.production-api';
import { environment as e2eReal } from './environment.e2e-real';
import { environment as demo } from './environment.demo';

const simulatedFlags = [
  'mockBackend', 'demoPresets', 'paymentDemo', 'loyaltyDemo',
  'campaignsDemo', 'billingSiatDemo', 'designMockups',
] as const;

describe('execution environments', () => {
  for (const [name, environment] of Object.entries({ production, development, realApi, productionApi, e2eReal })) {
    it(`${name} does not fabricate data`, () => {
      for (const flag of simulatedFlags) expect(environment[flag], flag).toBe(false);
    });
  }

  it('demo explicitly enables every simulated capability', () => {
    for (const flag of simulatedFlags) expect(demo[flag], flag).toBe(true);
    expect(demo.refreshCookie).toBe(false);
  });

  it('real development aliases preserve connection and telemetry configuration', () => {
    expect(realApi).toEqual(development);
    expect(e2eReal).toEqual(development);
  });
});
