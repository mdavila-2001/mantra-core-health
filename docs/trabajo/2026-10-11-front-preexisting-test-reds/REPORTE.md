# Reporte — Rojos preexistentes de pruebas del front

Fecha: 2026-10-11 · Handoff 2.6 · PRs front: pendientes de publicación.

## Causa y cambios

1. `src/styles.css` declara ocho `--heat-*` para cuatro niveles y dos temas; el catálogo TS no los enumeraba. Se agregaron tipos, constantes y `heatToken`, sin cambiar valores CSS. Se incorporaron las categorías omitidas al inventario documental; el total correcto, según `check-tokens`, es 220. El spec conserva la comparación bidireccional.
2. La fixture de fichas se compara con la API de un checkout vecino; en un worktree ese checkout estaba obsoleto (43 archivos). Se regeneró cada fixture desde una fuente explícita: API `dev` en `594e64e5` (368 formularios, 6.130 campos) y API PR #638, commit `6d7ce6c76a871d2a36e6b7a5ad0447e05eb5b27b` (370 formularios, 6.164 campos). CI ahora hace checkout de esa fuente y define `CLINICAL_FORMS_DIR` durante cobertura.
3. En API `test` los dos tamizajes OMS no declaraban `kind` y el generador los interpretaba como `BASE`; eso violaba el invariante de una ficha base por especialidad. API PR #638 declara ambos como `SPECIFIC`. El fixture del front `test` se genera desde ese commit. No se cambió ni se quitó ninguna aserción.
4. `check-css-tokens.mjs` encontró `--fs-body-sm`, nombre inexistente usado por una etiqueta. Se cambió por `--fs-caption`, token existente para texto de etiqueta.

## Evidencia por rama

Comando dirigido:

```sh
CLINICAL_FORMS_DIR=<fuente API fijada> corepack yarn test --watch=false \
  --include=src/app/core/tokens/design-tokens.types.spec.ts \
  --include=src/app/core/mock/fixtures/standard-sheets.spec.ts
```

| Base front | Fuente API | Resultado |
|---|---|---|
| `dev` | `dev` `594e64e5` | 2 archivos aprobados; 21/21 pruebas |
| `test` | PR API #638 `6d7ce6c` | 2 archivos aprobados; 21/21 pruebas |

Además, `corepack yarn typecheck` pasó en ambas ramas. Para `test` se generó antes el archivo local ignorado con `corepack yarn env:generate`, como ya hace CI. ESLint dirigido pasó en ambas. `corepack yarn lint` pasó en `test`; en `dev` informa dos fallos preexistentes en `playwright/mobile-parity/reference.spec.ts:48` (espacio irregular) y `src/app/features/shell-layout/shell-layout.html:387` (handler sin foco), archivos no modificados.

`node scripts/check-tokens.mjs` pasó (220 tokens); `node scripts/check-css-tokens.mjs` pasó tras corregir la etiqueta; `git diff --check` pasó en ambos worktrees. No se ejecutó la suite completa ni browser; las pruebas dirigidas reproducen ambos rojos y el handoff documenta otros rojos globales conocidos.

## Dependencia entre PRs

El PR front a `test` requiere API #638 para que exista la clasificación `SPECIFIC` en la rama fuente. El workflow fija el commit del PR API para que la comparación sea reproducible mientras ambos PR están abiertos. Una vez integrado API #638, el checkout puede volver a apuntar a `test`.

## PRs

- Front `dev`: pendiente de publicación.
- Front `test`: pendiente de publicación; depende de API #638.

No se mergeó ningún PR.
