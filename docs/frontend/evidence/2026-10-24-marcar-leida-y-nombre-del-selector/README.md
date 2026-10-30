# Marcar leída un aviso sin destino · nombre del selector de vinculación

Evidencia de navegador del 24/10/2026. Corrida con Chromium contra la maqueta
(`corepack yarn start:demo`, médica `medica@alovida.mock`) en 1440 claro,
390 claro y 1440 oscuro. «Antes» es `dev` (20dbf5ff) con sólo el ajuste de la
maqueta; «después» es esta rama.

## Qué se midió

| | Antes | Después |
|---|---|---|
| El aviso sin destino «Solicitud de vinculación aprobada» está sin leer | sí | sí |
| Ofrece «Marcar como leída» (botón con nombre «Marcar como leída: …») | **no** | **sí** |
| Tras tocarlo, la fila deja de estar sin leer (`is-sin-leer`) | — | **sí**, sin navegar |
| El combobox de «Pedir una vinculación» tiene nombre accesible | **no** (`aria-label` nulo) | **sí**: «Organización a la que pide vincularse» |
| Scroll horizontal | no | no |
| Errores de consola | 0 | 0 |

Los números salen de [`antes-medicion.json`](antes-medicion.json) y
[`despues-medicion.json`](despues-medicion.json).

## Fotos

- Fila sin destino: [antes 1440](antes-fila-sin-destino-1440-claro.png) ·
  [después 1440](despues-fila-sin-destino-1440-claro.png) ·
  [después 390](despues-fila-sin-destino-390-claro.png) ·
  [después oscuro](despues-fila-sin-destino-1440-oscuro.png)
- Ya leída tras el botón: [1440](despues-fila-ya-leida-1440-claro.png) ·
  [390](despues-fila-ya-leida-390-claro.png) ·
  [oscuro](despues-fila-ya-leida-1440-oscuro.png)
- Bandeja completa: [antes](antes-bandeja-1440-claro.png) ·
  [después](despues-bandeja-1440-claro.png)
- Pedir una vinculación (sin cambio visual): [antes](antes-vinculaciones-1440-claro.png) ·
  [después](despues-vinculaciones-1440-claro.png)

## Límite

Es la maqueta: la llamada `POST /notifications/in-app/:id/read` la responde el
simulador. Contra la API real no se corrió (no hay backend en este entorno).
