# Evidencia — reseñas en la ficha pública de médicos

## Veredicto

**VERIFIED FUNCTIONAL ONLY.** La pestaña «Reseñas» abre la lista desde una ficha pública real, presenta el promedio del perfil y muestra opiniones, respuestas y paginación. Las capturas de escritorio y móvil se revisaron. La suite global no se ejecutó en esta reanudación.

## Cambio verificado

El recorrido mostró una discrepancia entre la respuesta del handler simulado y el contrato que consume `PublicDirectoryClient.profileReviews()`: el mock devolvía `rating`/`text` y metadatos de paginación distintos a los que espera la pantalla. El handler ahora responde `overallRating`, `reviewText`, `reviewerDisplayName`, `responses`, `nextCursor`, `ratingAverage` y `ratingCount`. Las fichas oficiales del directorio, que todavía no tienen opiniones, responden con una lista vacía y promedio nulo.

## Evidencia visual

- [Ficha y reseñas, escritorio 1440 px](reviews-1440-claro.png)
- [Ficha y reseñas, móvil 375 px](reviews-375-claro.png)

El E2E recorre `/p/jorge-salazar`, selecciona «Reseñas», comprueba que la pestaña queda seleccionada, que aparece el panel «Opiniones» y que contiene una opinión; a 375 px comprueba que no haya scroll horizontal.

## Verificaciones

- `corepack yarn env:generate` — PASS; se usaron valores por defecto, `.env` no se modificó.
- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint playwright/public-profile-reviews.spec.ts src/app/core/mock/handlers/public.handlers.ts` — PASS.
- `corepack yarn pw playwright/public-profile-reviews.spec.ts --workers=1 --reporter=list` — PASS; 1 prueba, 1 worker.
- `corepack yarn test --watch=false --include src/app/features/public-profile/public-profile-card/public-profile-card.tabs.spec.ts` — PASS; 1 archivo, 7 pruebas. Repetido el 2026-10-15 después del ajuste del mock.
- `git diff --check` — PASS.

No se corrieron build, suite global ni route-health en esta pasada. No se cambió API real ni modelo; la respuesta ajustada pertenece al simulador del frontend.
