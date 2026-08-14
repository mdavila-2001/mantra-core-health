# Carril 15 · Feed profesional tipo LinkedIn

**Punto del reclamo:** 12d (mensaje del 2026-08-14: "se tiene que añadir un feed como LinkedIn
de las principales publicaciones"). **Repos:** backend + frontend, aunque el backend
probablemente ya alcanza — ver más abajo. **Rama sugerida:** `carril-15/feed-profesional`.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar. **Leé también
`PENDIENTES-RED-SOCIAL.md`: este carril vive adentro de ese plan, no en paralelo a él.**

## Buena noticia: el backend del feed ya está construido

- `GET /community/feed?profileId=&cursor=&limit=` existe y funciona —
  `redesa-api/src/modules/community/controllers/community-timeline.controller.ts:32-42`
  (`CommunityTimelineController.getFeed`), paginado por cursor, con tope de 50 por página.
- El fan-out que lo alimenta también está cerrado: `src/worker-community.ts` +
  `src/worker/jobs/community/feed-fanout.job.ts` corren en `dev` (H3 de
  `PENDIENTES-RED-SOCIAL.md`, cerrado el 13/08).
- Lo que falta es exactamente **H5 · cero frontend**: `grep -rl community src/app/` no
  encuentra ninguna pantalla de feed — solo el muro por-perfil que ya construyó otro trabajo
  (`public-profile-preview.ts`, `medical-articles.ts`, ambos con `CommunityClient` real).

Este carril, entonces, es sobre todo **frontend**: la pantalla de feed que hoy no existe, sobre
un backend que ya responde.

## Backend (`mantra-core-health-redesa-api`)

Verificación antes que construcción:

1. Confirmá que `getFeed()` devuelve lo necesario para una tarjeta de post estilo LinkedIn
   (autor, contenido, reacciones, comentarios agregados, marca de tiempo) — `FeedPageDto`, en
   `src/modules/community/dto/`.
2. Si el cliente pidió "las **principales** publicaciones" (no solo cronológico), confirmá si
   `getFeed` soporta algún criterio de relevancia/ranking o si es estrictamente cronológico. Si
   hace falta ordenar por relevancia y no existe, es la única extensión de backend de este
   carril:

```
src/modules/community/services/community-timeline-read.service.ts   (extender el ranking, no reescribir el endpoint)
```

**Archivos existentes que tocás:** como mucho, ese service. Nada más del backend.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/features/feed/feed.ts              + .html + .css + .spec.ts
src/app/features/feed/post-card/post-card.ts + .html + .css + .spec.ts
```

`post-card` como componente separado porque lo van a reusar tanto el feed como, más adelante, el
muro por-perfil que ya existe en `medical-articles.ts` — no lo dupliques ahí, pero tampoco lo
edites en este carril: solo dejalo listo para que ese archivo lo adopte después.

**Archivos existentes que tocás — compartido con el Carril 16, coordinen el orden:**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/data-access/community/community.client.ts` | método `getFeed()` — solo el método nuevo, no tocás `upsertOwnProfile`/los métodos de posts existentes |
| `src/app/core/data-access/community/community.types.ts` | tipo `FeedPage`/`FeedPost`, espejo de `FeedPageDto` |

**Archivos compartidos con los carriles del bloque original (siguiendo el protocolo del
README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/navigation/navigation.map.ts` | una fila nueva, grupo **General** (junto a Panel y Tutoriales) — sin roles, cualquier sesión con perfil profesional puede tener feed |
| `src/app/app.routes.ts` | ruta de la sección nueva |

**Lo que NO tocás:** `public-profile-preview.ts`, `medical-articles.ts` (son de la vitrina
pública propia, no del feed — no los mezcles), ni ninguna pantalla de los otros carriles.

## Definición de hecho

- Al entrar al feed se ve una lista paginada de publicaciones reales (no simuladas) con autor,
  contenido, reacciones y comentarios.
- Reaccionar/comentar desde el feed funciona contra los endpoints reales que
  `CommunityClient` ya expone (no los reescribas, solo consumilos).
- CRUD completo del lado del feed en lo que le corresponde: crear post sigue viviendo donde ya
  vive (perfil), pero leer, reaccionar, comentar y (si el usuario es el autor) borrar, funcionan
  desde la tarjeta del feed.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend si tocaste algo ahí.
