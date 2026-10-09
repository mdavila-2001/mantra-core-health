import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';
import { forcedRealApi } from '../../core/mock/api-mode';

/**
 * Si la pantalla de facturación puede hablar con el motor fiscal SIMULADO.
 *
 * Tres condiciones, todas necesarias (FACT-SIAT-MOCK):
 * - `billingSiatDemo`: la demo está encendida en este despliegue;
 * - `mockBackend`: hay backend simulado que responda `/billing/simulated/*`;
 * - `!apiRealForzada()`: nadie desvió las peticiones a la API real desde el
 *   stock de componentes.
 *
 * Si cualquiera falla, la pantalla dice que la facturación no está conectada
 * y **no hace ninguna petición**. Es un token para que las pruebas fijen la
 * respuesta sin tocar el entorno.
 */
export const SIMULATED_AVAILABLE_INVOICING = new InjectionToken<() => boolean>('FACTURACION_SIMULADA_DISPONIBLE', {
  providedIn: 'root',
  factory: () => () => environment.billingSiatDemo && environment.mockBackend && !forcedRealApi(),
});
