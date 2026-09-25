# Inventario — `grep -rn "nearby-places\|NearbyPlaces\|Lugares cercanos" src --include=*.ts --include=*.html`

41 líneas de salida. Clasificación, una fila por hit (o por grupo contiguo del mismo archivo):

| Archivo | Líneas | Decisión | Por qué |
|---|---|---|---|
| `app.routes.ts` | 96-97 | **Borrar y redirigir** | La entrada en `PANTALLAS_DIFERIDAS`; H6.S2.M1 la saca, H6.S2.M2 agrega `RUTAS_HEREDADAS` |
| `core/data-access/profiles/saved-places.ts` | 24 | Dejar | Comentario histórico, no funcional; fuera de mi alcance (no está en la ficha) |
| `core/navigation/navigation.map.ts` | 278-279 | **Borrar** | La sección del menú (H6.S1.M2) |
| `core/navigation/navigation.subgroups.ts` | 114-136 | **Borrar** | El subgrupo «Lugares cercanos» completo (H6.S1.M2) |
| `features/account/cotizaciones/*` (3) | — | Dejar | Importan `SearchOriginPicker`/`SearchOrigin` de `nearby-places/search-origin-picker/`, que **sigue** (no se mueve); Cotizaciones no se toca |
| `features/account/pharmacy-hub/pharmacy-shop/*` (2) | — | Dejar | Mismo motivo: `search-origin-picker` sigue; `pharmacy-hub` se borra recién en H7 (Ola 3) |
| `features/alovida/buscar/cercania-detalle/cercania-detalle.html` | 66 | Dejar | Texto sin relación: describe el orden por distancia de OTRA pantalla (directorio público), no nombra el componente ni la ruta |
| `features/component-stock/component-index.generated.ts` | varias | Regenerar | Gitignored; se regenera solo con `node scripts/generate-component-index.mjs` (H6.S2.M3) |
| `features/nearby-places/nearby-places.{ts,html,spec.ts}` | — | **Borrar** | La pantalla completa (H6.S2.M1) |
| `features/nearby-places/search-origin-picker/*.ts` | comentarios | Dejar | Comentarios que mencionan la ruta vieja como contexto histórico; el componente **sigue** en su lugar, no se mueve ni se renombra (fuera de alcance tocar comentarios ajenos a la microtarea) |
| `features/shell-layout/shell-layout.spec.ts` | 431 | **Corregir la lista** | `expect(enlaces).toContain('/nearby-places')` — se saca esa entrada de la lista cerrada (H6.S1.M3), nunca se debilita el test |

**Conteo:** 41 hits del grep → 12 filas de este inventario (varias agrupan líneas contiguas del mismo
archivo/motivo). Acciones reales: 5 "borrar/corregir/redirigir", 1 "regenerar" (automático), 6 "dejar"
con motivo explícito cada una.
