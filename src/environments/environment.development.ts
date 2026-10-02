import type { Environment } from './environment.types';
import { envFromProcess } from './env.generated';

/** API real. Las demostraciones se habilitan solo con la configuracion demo. */
export const environment: Environment = {
  apiBaseUrl: envFromProcess.apiBaseUrl ?? '',
  aiBaseUrl: envFromProcess.aiBaseUrl ?? '/ai',
  refreshCookie: envFromProcess.refreshCookie ?? false,
  demoPresets: false,
  paymentDemo: false,
  loyaltyDemo: false,
  campaignsDemo: false,
  billingSiatDemo: false,
  designMockups: false,
  mockBackend: false,
  telemetry: {
    enabled: envFromProcess.telemetry?.enabled ?? false,
    serviceName: envFromProcess.telemetry?.serviceName ?? 'mantra-angular-web',
    namespace: envFromProcess.telemetry?.namespace ?? 'mantra',
    environment: envFromProcess.telemetry?.environment ?? 'development',
    tracesEndpoint: envFromProcess.telemetry?.tracesEndpoint ?? '/otel/v1/traces',
    sampleRatio: envFromProcess.telemetry?.sampleRatio ?? 1,
  },
};
