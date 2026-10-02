import type { Environment } from './environment.types';
import { environment as developmentEnvironment } from './environment.development';

/** Alias de desarrollo contra la API real, sin datos fabricados. */
export const environment: Environment = {
  ...developmentEnvironment,
  demoPresets: false,
  paymentDemo: false,
  loyaltyDemo: false,
  campaignsDemo: false,
  billingSiatDemo: false,
  designMockups: false,
  mockBackend: false,
};
