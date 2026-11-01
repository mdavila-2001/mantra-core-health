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
  billingSimulatedApi: true,
  designMockups: false,
  reportingMockEnabled: envFromProcess.reportingMockEnabled ?? false,
  mockBackend: false,
  telemetry: {
    enabled: envFromProcess.telemetry?.enabled ?? false,
    serviceName: envFromProcess.telemetry?.serviceName ?? 'mantra-angular-web',
    namespace: envFromProcess.telemetry?.namespace ?? 'mantra',
    environment: envFromProcess.telemetry?.environment ?? 'production',
    tracesEndpoint: envFromProcess.telemetry?.tracesEndpoint ?? '/otel/v1/traces',
    sampleRatio: envFromProcess.telemetry?.sampleRatio ?? 0.1,
  },

  /**
   * Captura de interacciones **apagada** salvo que el despliegue la encienda
   * con `PUBLIC_UX_ANALYTICS_ENABLED=true` y el id del esquema registrado en la
   * API (`PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID`). Sin esquema la API rechazaría
   * cada lote, así que sin él tampoco se enciende.
   */
  uxAnalytics: {
    enabled: envFromProcess.uxAnalytics?.enabled ?? false,
    eventSchemaDefinitionId: envFromProcess.uxAnalytics?.eventSchemaDefinitionId ?? '',
    sampleRatio: envFromProcess.uxAnalytics?.sampleRatio ?? 1,
  },
};
