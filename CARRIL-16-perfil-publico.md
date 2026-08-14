# Carril 16 · Vista pública real del perfil del profesional

**Punto del reclamo:** 12e (mensaje del 2026-08-14: "falta la vista pública previa del perfil
del profesional de salud"). **Repos:** backend + frontend, los dos. **Rama sugerida:**
`carril-16/perfil-publico`. **Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar
cualquier archivo compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.
**Leé también `PENDIENTES-RED-SOCIAL.md` — este carril ejecuta una porción concreta y acotada de
su fase F4 + una esquirla de F6, no un plan aparte.**

## El malentendido que resuelve este carril

Ya existe una pantalla llamada "vista previa pública" —
`src/app/features/account/my-profile/public-profile-preview/public-profile-preview.ts`—, y es
real: llama a `CommunityClient.upsertOwnProfile()`, guarda slug y biografía, y muestra al
profesional cómo quedaría su vitrina. **Pero es una vista previa para el dueño de la sesión, no
la página pública de verdad.** Nadie sin sesión puede entrar a ver ese perfil hoy:

> **H2 de `PENDIENTES-RED-SOCIAL.md` — "Cero superficie pública" — sigue abierto.** Ningún
> controlador de `community` lleva `@Public()`. Verificado: `@Public()` solo aparece en
> `iam-auth`, `public-projections`, webhooks y tracking — en ningún controller de `community`.

Este carril cierra ese hueco específico — la ficha pública de **un** profesional — sin construir
el buscador entero (`/buscar`, mapa, geolocalización, las 12 pantallas de V65). Eso sigue siendo
F6 completo en `PENDIENTES-RED-SOCIAL.md`, y no es este carril.

## Backend (`mantra-core-health-redesa-api`)

Tareas de **F4** de `PENDIENTES-RED-SOCIAL.md` (los números son los de esa tabla, para que
quede trazable), acotadas al endpoint de perfil, no al de búsqueda:

| # | Tarea | Alcance acá |
|---|---|---|
| 42 | Marcar el endpoint de **perfil** con `@Public()` | Sí — es el corazón del carril |
| 43 | Rate limit por IP con Redis | Sí — sin esto, publicar el endpoint es publicar un scraper gratis |
| 44 | Proyección de solo-campos-públicos, hecha en el **servicio**, no en el controller, con prueba que falle si alguien agrega un campo al DTO sin pasar por ahí | Sí — es la diferencia entre "público" y "una fuga con URL" |
| 45 | Slug estable y único por perfil (`/p/marisol-quispe-ticona`) | Sí, si `public_profiles` ya tiene el slug — confirmalo antes de modelar nada nuevo |
| 46 | Cabeceras de caché y `ETag` | Opcional en esta ronda — no bloquea el cierre del carril |
| 47 | `robots.txt`/`sitemap.xml` | **No** — es del buscador completo (F6), no de un perfil individual |
| 48 | Respuestas que no revelan existencia (slug inexistente = slug despublicado) | Sí — barato y evita que alguien mapee qué perfiles existen probando slugs |

```
src/modules/community/controllers/community-public-profiles.controller.ts   (nuevo, o extender el existente si ya hay uno para perfiles — confirmalo primero)
src/modules/community/dto/public-profile-view.dto.ts                        (nuevo — la proyección de campos públicos)
```

**Archivos existentes que tocás:** dentro de `src/modules/community/`. Coordiná con quien esté
trabajando el resto de `PENDIENTES-RED-SOCIAL.md` en paralelo (revisá primero si hay una rama
activa sobre ese plan antes de arrancar, igual que advierte el Carril 5 sobre `profiles/`).

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/features/public-profile/public-profile.ts   + .html + .css + .spec.ts
```

Ruta pública, **fuera del área con sesión** — no cuelga de `navigation.map.ts` ni pasa por el
`authGuard`. Mirá cómo `/auth/**` queda prerenderizado (`RenderMode.Client` solo para el área
protegida, ver `COORDINACION-AGENTES.md`, "Dos decisiones que te afectan si tocás rutas") — esta
ruta nueva sigue el mismo criterio que `/auth/**`, no el del área autenticada.

**Archivos existentes que tocás — compartido con el Carril 15, coordinen el orden:**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/data-access/community/community.client.ts` | método `getPublicProfile(slug)` — sin `Authorization`, es la única llamada del cliente que no lleva token |
| `src/app/core/data-access/community/community.types.ts` | tipo `PublicProfileView`, espejo de la proyección pública del backend |

**Archivos compartidos con el bloque original (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/app.routes.ts` | la ruta pública `/p/:slug`, en el bloque de rutas prerenderizadas, no en el área protegida |

**Lo que NO tocás:** `public-profile-preview.ts` (sigue siendo la pantalla de edición/vista
previa del dueño, no la toques — tu pantalla es una nueva, separada, para visitantes sin
sesión), el resto de `community` fuera de lo que necesitás para esta lectura pública, y
cualquier cosa de V65/buscador completo (mapa, filtros, geolocalización) — eso es F6 entero,
fuera de este carril.

## Definición de hecho

- Un visitante sin sesión, en una ventana de incógnito, entra a `/p/<slug>` y ve el perfil
  público real de un profesional — no un mockup, no la vista previa autenticada.
- Un slug que no existe o que pertenece a un perfil despublicado responde igual (ninguno revela
  cuál de los dos casos es).
- Ningún campo privado (datos de contacto no publicados, información clínica) aparece en la
  respuesta — cubierto por una prueba que falle si se agrega un campo al DTO sin pasar por la
  proyección.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
