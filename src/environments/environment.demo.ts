import type { Environment } from './environment.types';
import { environment as developmentEnvironment } from './environment.development';

/** Datos sinteticos y servicios simulados. Activacion explicita con demo. */
export const environment: Environment = {
  ...developmentEnvironment,
  refreshCookie: false,
  demoPresets: true,
  paymentDemo: true,
  loyaltyDemo: true,
  campaignsDemo: true,
  billingSiatDemo: true,
  designMockups: true,
  mockBackend: true,
};
