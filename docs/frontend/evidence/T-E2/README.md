# T-E2 · Elegir farmacia — evidencia de navegador

- **Fecha:** 2026-09-16 · rama `ender/far-mock-t-e2-elegir-farmacia` · base `db6e170e`.
- **Entorno:** `ng serve --port 4232` (configuración de desarrollo, `mockBackend: true`), Chrome headless
  vía `@playwright/test`, paciente del mock `paciente@alovida.mock`.
- **Script:** `capturar-evidencia.mjs` (se corre a mano; la aplicación no lo importa).
- **Resultado:** `resultado.json` → **25/25 comprobaciones**, 0 errores de página, 0 escrituras HTTP
  desde la pantalla.

## Qué es cada captura

| Prefijo                                             | Qué muestra                                      | Origen de las sedes             |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------- |
| `flujo-real-deriva-del-mock`                        | La pantalla tal como la deja el backend simulado | mock sin tocar                  |
| `fixture-evidencia-sin-seguro` (×5 viewports)       | Lista y mapa, orden del backend                  | **inyectadas**                  |
| `fixture-evidencia-con-seguro` (×5 viewports)       | Cobertura de lo aprobado, desglose, pines        | **inyectadas**                  |
| `fixture-evidencia-orden-mas-cerca` / `-mas-barato` | El orden cambia el listado                       | **inyectadas**                  |
| `fixture-evidencia-con-seguro-vacio`                | Ningún renglón aprobado incluido                 | **inyectadas**                  |
| `fixture-evidencia-con-seguro-error`                | Error recuperable con la variante encendida      | **inyectadas** (error simulado) |

## Por qué hay sedes inyectadas

El backend simulado lee `productIds` (`core/mock/handlers/pharmacy.handlers.ts`) y el cliente real
manda `products` (`core/data-access/pharmacy/pharmacy.client.ts`). Con el mock, todas las sedes llegan
«completas», sin productos ni precios. Esa diferencia **ya existía y no es de T-E2**, y el handler
queda fuera de su alcance. El script reemplaza la lectura de disponibilidad **sólo en la instancia
del componente de esa pestaña del navegador**, con sedes rotuladas «(evidencia)» y armadas con los
`productId` reales de la receta del mock.

**Las capturas `fixture-evidencia` no son integración ni `FUNCIONA_E2E`.** Sirven para ver la
pantalla, no para dar por probado el contrato.

## Ruido ajeno visible en las capturas de página completa

La barra lateral y la cabecera fijas se repiten por el `fullPage`. El aviso «Se liberó un horario» y
las etiquetas «Datos de prueba / Ver componentes» son del shell del mock, no de T-E2.

## Decisión de Ender sobre esta evidencia (2026-09-16)

`INJECTED_BROWSER_EVIDENCE = ACCEPTED_AS_VISUAL_EVIDENCE`: vale para la presentación y el
comportamiento visual de T-E2, **no** para `INTEGRATED = YES` ni para `FUNCIONA_E2E = YES`. La
diferencia `products` / `productIds` sigue abierta como deuda que ya existía; T-E2 no la corrige.

## DEUDA-T-E2-02 · `ACCEPTED_NON_BLOCKING`

En 390×844, «Receta completa primero» queda cortado («Receta com…»). `SegmentedControl` usa
`white-space: nowrap` en `shared/components/molecules/segmented-control/segmented-control.css`,
fuera del alcance de esta tarea. No bloquea: el control sigue siendo utilizable y el nombre
accesible está completo. No se modifica el componente compartido ni se acorta el texto.
