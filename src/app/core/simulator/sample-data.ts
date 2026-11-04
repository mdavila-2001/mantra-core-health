import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/* ============================================================================
    Si una pantalla puede completar con **datos de ejemplo** lo que la API
    todavía no publica.

    Existe porque varias pantallas de farmacia (bandeja del mostrador, ficha de
    la farmacia, confirmación del pedido, dónde comprar, promociones) dibujaban
    sus datos de ejemplo siempre, también en un despliegue contra la API real
    (`production-api`): quien entraba a TEST veía una cobertura de seguro, una
    factura o una carpeta legal que nadie había cargado.

    La regla es la misma que ya seguía la factura del paciente
    (`order-invoice.fixtures.ts`, D-FARMOCK-2):

      - **Con el backend simulado** (`mockBackend: true`, la rama `mockup`) los
        ejemplos se muestran y se rotulan, como hasta ahora.
      - **Con la API real** no se muestra nada que la API no haya devuelto: la
        sección se oculta o dice que el dato no está disponible.

    Es un token y no una lectura directa de `environment` para que las pruebas
    puedan recorrer las dos caras de la misma pantalla sin tocar el entorno.
    ========================================================================== */

export const SAMPLE_DATA_ENABLED = new InjectionToken<boolean>('SAMPLE_DATA_ENABLED', {
  providedIn: 'root',
  factory: () => environment.mockBackend,
});
