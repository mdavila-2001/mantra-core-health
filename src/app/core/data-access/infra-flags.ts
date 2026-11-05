import { InjectionToken } from '@angular/core';

/**
 * Banderas de integración de F5 que dependen de claves que la API **todavía no
 * acepta** (H6 de la revisión de `infra-f4f5-web`).
 *
 * La API valida con `forbidNonWhitelisted`: mandar `suggestedCareSpaceId` en la
 * orden, `collectionCareSpaceId` en la cola o `careSpaceId` en la plantilla de
 * agenda hace fallar con 400 **la operación entera** (la orden, la cola, el
 * alta de la agenda). Por eso nacen apagadas y la web no muestra ni manda esas
 * claves. Se encienden cuando A-F5b/A-F5d las declaren en sus DTO, en un solo
 * lugar, sin tocar las pantallas.
 */
export interface InfraIntegrationFlags {
  /** F5b: punto de toma en la orden (`suggestedCareSpaceId`) y en la cola (`collectionCareSpaceId`, `collectionPoint`). */
  readonly collectionPoints: boolean;
  /** F5d: consultorio de la plantilla de agenda (`careSpaceId`). */
  readonly consultingRoomTemplates: boolean;
}

export const INFRA_INTEGRATION_FLAGS = new InjectionToken<InfraIntegrationFlags>('INFRA_INTEGRATION_FLAGS', {
  providedIn: 'root',
  factory: () => ({ collectionPoints: false, consultingRoomTemplates: false }),
});
