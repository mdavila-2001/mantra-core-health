# Evidencia — selector de altas por audiencia

La pantalla de «Crear cuenta» ofrece sólo paciente y médico; la ruta de «Registrá tu organización» ofrece aseguradora, laboratorio, imagenología y farmacia. Revisé las capturas claras a 375 y 1440 px y confirmé que la grilla conserva todos los destinos y no corta el contenido.

## Capturas posteriores

| Ancho | Personas | Organizaciones |
|---:|---|---|
| 375 px | [PNG](personal-375-light.png) | [PNG](organization-375-light.png) |
| 1440 px | [PNG](personal-1440-light.png) | [PNG](organization-1440-light.png) |

No se incluye comparación «antes»: esta separación de altas no corresponde a uno de los carriles 31–40 ni tiene una línea base visual formal asociada.

## Verificación

- `corepack yarn typecheck` — PASS.
- ESLint dirigido a los archivos TypeScript/Playwright cambiados — PASS.
- `corepack yarn test --watch=false --include='**/register-account-type.spec.ts'` — 8/8 PASS.
- `E2E_BASE_URL=http://localhost:4300 corepack yarn pw playwright/altas-sin-cobertura.spec.ts --workers=1 --grep='dónde se elige'` — 2/2 PASS.
- `E2E_BASE_URL=http://localhost:4300 corepack yarn pw playwright/registro-farmacia.spec.ts --workers=1 --grep='la tarjeta|primer paso|pantalla se ve completa'` — 3/3 PASS, incluye 375/768/1440 y modo oscuro.
