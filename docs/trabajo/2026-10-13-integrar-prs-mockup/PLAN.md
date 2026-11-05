# Plan — Integrar la resolución de conflicto del PR #1089

- Fecha: 2026-10-13 · Repo: `mantra-core-health` · Rama de PR: `justin/mockup-corr-33-mis-organizaciones`
- Resultado observable: la evidencia Playwright de CORR-31 y CORR-33 conserva sus interacciones y queda integrable sobre `mockup`.
- Kill-test: falla typecheck, lint focalizado o el spec `playwright/corr-evidencia.spec.ts`.

## Alcance
- IN: integrar los cambios actuales de `mockup` en el PR #1089 y conservar las dos variantes de evidencia del spec.
- OUT: cambiar la aplicación, regenerar capturas, editar otros PR o silenciar fallos existentes.
- Ambigüedades: ninguna; el conflicto está en un solo spec y sus dos lados agregan acciones distintas.

## H1 — Resolver y validar el conflicto de integración
**CA:** Dado el PR #1089 y la punta actual de `mockup`, cuando se integran, entonces el spec conserva los campos y acciones de ambos carriles sin marcadores de conflicto.
**DoD:** `git diff --check`, typecheck, lint focalizado y Playwright focalizado pasan; el merge-tree termina sin conflictos.
**Estado:** HECHO

### H1.S1 — Combinar las variantes de `corr-evidencia.spec.ts`
**CA:** El tipo `Ruta` admite `destino`, `fixture` y `accion`, y el recorrido ejecuta ambas preparaciones.
**DoD:** revisar el diff y ejecutar el spec focalizado → verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Integrar ambos bloques del conflicto | No quedan marcadores y ambas ramas de fixture siguen disponibles | `git diff --check` → limpio; TypeScript y ESLint focalizados → salida 0 | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Las dependencias de CI remota siguen en cola | El merge no confirma el estado de los checks | Registrar estado exacto; no usar bypass |
