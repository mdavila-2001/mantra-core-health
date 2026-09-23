# Plan ejecutado — reserva y cotizaciones del paciente

- Corte: `origin/mockup` en `b655e8449abd662d6b24156fd6e2b06aeb120cc1`.
- Rama: `justin/reserva-cotizaciones-2026-09-23`.
- Alcance realizado: clic único en tarjetas del directorio, guardia contra doble reserva y lógica pura de cotizaciones con precio trazable.
- Alcance pendiente por dependencia: ruta y entrada de navegación de Cotizaciones (Ender), fuente REST de cotizaciones multivertical y precios publicados para análisis/imagenología/servicios.

## Baseline

El primer `yarn test --watch=false` no compiló porque faltaba el artefacto generado `component-index.generated.ts`. Se generó con `node scripts/generate-component-index.mjs`; no entra en el commit. Después de ello, los specs focalizados y `yarn typecheck` pudieron ejecutarse.

## Decisiones

- La navegación única es opt-in para no alterar otros consumidores de `app-result-card`.
- Los slots siguen consultándose en paralelo por sede: el cliente no ofrece un filtro único por profesional.
- BOB y UMA no se convierten ni se ordenan entre sí; los precios no publicados quedan al final.
