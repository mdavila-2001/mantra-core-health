# Plan — Rojos preexistentes de pruebas del front

- Fecha: 2026-10-11 · Repo: `mantra-core-health` · Tarea 2.6 del handoff.
- Resultado observable: los specs dirigidos de tokens y fichas pasan en ramas base `dev` y `test`, manteniendo todos sus invariantes.
- Fuente backend: API `dev` (`594e64e5`, 368 formularios); para front `test`, commit `6d7ce6c76a871d2a36e6b7a5ad0447e05eb5b27b` de API PR #638 (370 formularios).
- Ambigüedades resueltas: `--heat-*` son tokens públicos del sistema (CSS de ambos temas y consumidores); la prueba de fichas compara contra los formularios del API de la misma base. El commit de API #638 corrige los `kind` ausentes en los dos tamizajes OMS.

## Alcance

- IN: tipado y documentación de tokens, token CSS mal escrito, fixture y prueba de fichas, generador, y checkout de catálogo API en CI.
- OUT: backend en este cambio, estilos visibles, pruebas de browser, debilitamiento de aserciones y simuladores.
- Dependencia: CI del front `test` usa el commit exacto de API PR #638 mientras siga abierto. Al integrar ese PR, conviene cambiar la referencia fija por la punta de `test`.

## Microtareas y aceptación

| ID | Trabajo | Criterio | Estado |
|---|---|---|---|
| H1.S1.M1 | Reproducir los tokens ausentes | Spec identifica los ocho `--heat-*` declarados por CSS | HECHO |
| H1.S1.M2 | Tipar la escala y mantener catálogo/documentación | Spec compara CSS ↔ TypeScript; total documentado 220 | HECHO |
| H1.S2.M1 | Fijar y comparar fuentes del API por base | `CLINICAL_FORMS_DIR` y commits anotados en CI/reporte | HECHO |
| H1.S2.M2 | Regenerar fixtures sin debilitar invariantes | 368 formularios `dev`, 370 formularios API #638 para `test`; ambos specs pasan | HECHO |

## Verificación y cierre

- `corepack yarn typecheck`: pasó en `dev` y `test`; en `test` primero se ejecutó `corepack yarn env:generate`, como en CI.
- ESLint dirigido de los archivos TypeScript/JS tocados: pasó en ambas bases.
- `corepack yarn lint`: `test` pasó; en `dev` quedan dos errores preexistentes ajenos al cambio, detallados en `REPORTE.md`.
- Specs dirigidos: 2 archivos, 21 pruebas aprobadas por base.
- `node scripts/check-tokens.mjs` (220 tokens), `node scripts/check-css-tokens.mjs` y `git diff --check`: pasaron, registrados en `REPORTE.md`.
- No se corrió la suite completa ni browser; no son necesarios para reproducir estos dos rojos y el entorno ya tiene rojos conocidos documentados.

**Estado: COMPLETO.**
