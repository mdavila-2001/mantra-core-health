# H5.S1.M1 — Veredicto de los 3 `iconOnly`

`git grep -n iconOnly -- src/app/shared/components/organisms/header src/app/features/shell-layout`:

```
src/app/features/shell-layout/shell-layout.html:249:        <app-back-link class="app-header__volver" fallback="/dashboard" label="Volver" iconOnly />
src/app/shared/components/organisms/header/header.html:10:    [iconOnly]="true"
src/app/shared/components/organisms/header/header.html:50:    [iconOnly]="true"
```

| # | Elemento | Veredicto | Aplicado |
|---|---|---|---|
| 1 | `app-back-link` (shell-layout.html:249) | **Ya cumplía.** `back-link.html:8-9` arma `aria-label` **y** `appTooltip` desde `label()` cuando `iconOnly()` — sin cambios. | — |
| 2 | Botón de menú/hamburguesa (header.html:1-19) | **Excepción — hamburguesa universal.** Ya tenía `aria-label`. No se agrega texto ni globo, coherente con el mismo botón del armazón real (`shell-layout.html`, que tampoco lo lleva). | Comentario documentando la excepción |
| 3 | Interruptor de tema de la galería (header.html:39-51) | **A medias → aplicado.** Tenía `[attr.aria-label]` dinámico, faltaba `appTooltip` (HALL-D7). | `appTooltip="Tema"` agregado |

**El cuarto caso real (no estaba en el grep porque no usa `iconOnly` como prop, sino la
directiva `[app-theme-toggle]` con markup de la bóveda):** el interruptor de tema del armazón real
(`shell-layout.html:362-374`). `aria-label` lo pone `AlovidaThemeToggleDirective`
(`core/alovida/alovida-theme-toggle.directive.ts:26`, dinámico según el tema — HALL-D7 lo había
verificado). Faltaba `appTooltip`: agregado.

**Verificación:** `npx ng test --include=src/app/shared/components/organisms/header/header.spec.ts
--include=src/app/features/shell-layout/shell-layout.spec.ts --watch=false` → 66/66 PASS.
`npx tsc -p tsconfig.app.json --noEmit` → exit 0.
