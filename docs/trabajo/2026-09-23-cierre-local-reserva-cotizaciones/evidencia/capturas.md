# Capturas — Cotizaciones

Fecha: 2026-09-23. Entorno local autenticado contra la maqueta.

La prueba `playwright/cierre-local-reserva-cotizaciones.spec.ts` recorre los
seis estados y espera que el cajón de navegación termine de salir de la vista
antes de fotografiar los anchos móviles. Esa espera evita registrar como
defecto de producto la transición CSS transitoria de escritorio a móvil.

| Ancho | Claro | Oscuro | Revisión |
|---|---|---|---|
| 390 px | `cotizaciones-390-light.png` | `cotizaciones-390-dark.png` | Título, filtros, resultados y procedencia son visibles; el menú está cerrado. |
| 768 px | `cotizaciones-768-light.png` | `cotizaciones-768-dark.png` | No hay desborde lateral ni contenido oculto. |
| 1440 px | `cotizaciones-1440-light.png` | `cotizaciones-1440-dark.png` | La página conserva jerarquía, filtros y resultados legibles. |

La verificación de Directorio deja además
`directorio-especialidad-navegacion-unica.png`: tras cuatro activaciones de una
especialidad queda una sola lista de profesionales cargando, sin repetir la
navegación.

Resultado literal: `2 passed (12.2s)` al ejecutar:

```text
npx playwright test playwright/cierre-local-reserva-cotizaciones.spec.ts --workers=1 --reporter=list
```
