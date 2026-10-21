# Reporte — Red social al estilo LinkedIn: eliminar el «Muro profesional» y cerrar el flujo completo

> **AVANCE: 47 / 89 — 52,8 %.** (68 microtareas del flujo social + 21 del rediseño H10, agregado el 21/10/2026 y todavía sin empezar). Gates de H9: ver §Evidencia (se completa al terminar la corrida).

- Fecha: 2026-10-21 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude-marcelo/hopeful-ride-7z2qps` en `mantra-core-health` (base `origin/mockup`) y en `mantra-core-health-api`.
- Peldaño de evidencia alcanzado:
  - Front, flujo social (H1, H3–H8): **VERIFIED contra el simulador** — specs dirigidos en verde y recorrido de navegador 109/109 + ficha 9/9 contra `ng serve` con el backend simulado, con persistencia y recarga. No es `REGRESSION_VERIFIED`: falta la corrida contra la API real y la firma de los revisores (§Pendiente).
  - API (`DELETE /community/reactions`): **TESTED** (jest 65/65, tsc y eslint en 0).
  - H2 (autor dentro del DTO): no empezado; lo cubre el respaldo del front (H2.S1.M4).
  - H10 (rediseño): solo planificado.

## Completado

Cada fila tiene el CA cumplido y el DoD con su salida en `evidencia/`.

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| H0.S1.M1–M2 | Rama reiniciada desde `origin/mockup`; gates base medidos | `git log`, `yarn typecheck`, spec de rutas | PASS · `evidencia/base-*.txt` (1 fallo previo en `app.routes.spec.ts`) |
| H1.S1.M1–M3 | `composer` y `report-post` movidos a `features/social/`; guardado como `BookmarkStore` | specs | PASS · `evidencia/h1-h2-stores-test.txt`, `h2-stores-test.txt` (44/44) |
| H1.S2.M1–M6, M8 | `/feed` ya no existe: `/feed` y `/feed?post=` llevan a `/posts` o a la publicación; `features/feed/*` borrado; los avisos sociales abren `/posts/:id?actor=`; «Mi actividad»; responder en línea; docs | specs del guard, del store de avisos y de comentarios | PASS · `evidencia/h1-guard.txt` |
| H2.S1.M4 | El feed personal muestra nombre y foto del autor sin N+1 (`ProfileSummaryStore` + `ColaAcotada`) | specs | PASS · `evidencia/h2-stores-test.txt` |
| H3 (6) | `/posts` en tres columnas (perfil · feed · sugerencias), Recientes/Siguiendo en la URL, stats reales en el perfil mini, Seguir en sugerencias, estados, tiempo relativo | specs + `playwright/red-social/h3-inicio.mjs` | PASS 27/27 · `evidencia/h9-navegador/recorrido/h3-inicio/` |
| H4 (6) | «Crear publicación» en modal con avatar, visibilidad, hasta 10 imágenes con texto alternativo, borrador protegido por confirmación, foco devuelto; la publicación con imagen persiste | specs + `h4-modal.mjs` | PASS 17/17 · `…/h4-modal/` |
| H5 (9) | Tarjeta LinkedIn: Seguir, cinco reacciones (clic, mantener, ↑, Esc), resumen por tipo, hilo con redactor y respuesta en línea, Compartir (copiar/nativo), Guardar, fila de cuatro acciones | specs (272/272 dirigidos) + `h5-tarjeta.mjs` | PASS 15/15 · `evidencia/h5-suite-dirigida.txt`, `…/h5-tarjeta/` |
| H6 (7) | `FollowStore` único; botón Seguir reusable (también en la ficha pública); **Mi red** `/network` (Siguiendo · Sugerencias, sin quienes ya sigue); **Guardados** `/saved` con quitar desde la tarjeta | specs + `h6-red-y-guardados.mjs` + `h6-ficha-seguir.mjs` | PASS 28/28 y 9/9 · `…/h6-red-y-guardados/`, `…/h6-ficha-seguir/` |
| H7 (3) | Los avisos sociales nombran a quien actuó («Valeria Rojas · Comentó: …») y abren la publicación | specs (79) + `h7-avisos.mjs` | PASS 6/6 |
| H8 (3) | Rail público con «Mi red social» solo con sesión (Mi red · Guardados · Mensajes · Notificaciones) y contadores sin leer en el nombre accesible y en la insignia | specs (50) + `h8-rail.mjs` | PASS 10/10 |
| API | `DELETE /community/reactions` (quitar la reacción propia), matriz de perfil ajeno | `npm test -- community-social.service.spec.ts` | PASS 65/65 · `evidencia/api-unreact-jest.txt` · commit `6face92a` |

Recorrido completo: `node playwright/red-social-linkedin.mjs http://127.0.0.1:4311 <salida>` → **109/109 en verde** (`evidencia/h9-navegador/recorrido/salida.txt`).

## A medias

### H1.S2.M7 — humo P3/P6 contra `/posts`
- Qué anda: `carril-p3-p6-humo.spec.ts`, `p3-muro-social.spec.ts`, `p6-moderacion-resenas.spec.ts` y `ui.contract.ts` apuntan al flujo nuevo (modal, «Siguiendo», menú «…» → Denunciar); `yarn typecheck` y eslint en 0.
- Qué no anda: no se corrieron.
- Qué falta exactamente: `yarn pw carril-p3-p6-humo p3-muro-social p6-moderacion-resenas` contra la API real con `worker-community` (el reparto del feed lo hace el worker).
- Dónde quedó: commit `1a768e06`; compila.

### H3.S2.M3 — vacío de «Siguiendo»
- Qué anda: dice por qué está vacío y ofrece «Ver recientes».
- Qué no anda: no pinta el descubrimiento debajo del aviso, como pedía el plan.
- Qué falta exactamente: renderizar `deRecientes` bajo el aviso cuando `modo = siguiendo` y la lista está vacía.
- Dónde quedó: `feed-publicaciones.html`; compila.

### H4.S1.M7 — prueba de mutación «publicar con imagen»
- Qué anda: spec del componente y recorrido `h4-modal.mjs` (publica → recarga → la tarjeta tiene `<img>`), 17/17.
- Qué no anda: no existe el spec Playwright `publicar-con-imagen` que corre con `yarn pw`.
- Qué falta exactamente: portar los pasos de `h4-modal.mjs` a `playwright/publicar-con-imagen.spec.ts` sin esperas fijas.
- Dónde quedó: `playwright/red-social/h4-modal.mjs`.

### H5.S2.M4 — desglose de reacciones en «Recientes»
- Qué anda: el resumen por tipo («👍 ❤️ 💡 24») en «Siguiendo» y en las vistas que leen la API de comunidad.
- Qué no anda: `GET /public/posts` solo trae el total, así que «Recientes» muestra el ícono genérico.
- Qué falta exactamente: microtarea aditiva de API (tallies en el DTO público) + mapeo en `public-directory.types.ts`.
- Dónde quedó: sin cambios en API.

### H5.S3.M2 — Compartir
- Qué anda: «Copiar enlace» y «Compartir…» (nativo del sistema).
- Qué no anda: «Enviar por chat» no se construyó.
- Qué falta exactamente: abrir `/messaging` con `createConversation` y el enlace precargado.
- Dónde quedó: `public-post-card`.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H0.S1.M3 | TODO | Capturas «antes» desde el worktree de `origin/mockup` (se hacen en H10.S0.M3) |
| H2.S1.M1–M3 | TODO | Decidir si se extiende el DTO de la API con `author` (hoy lo resuelve el front, una lectura por autor con caché) — Marcelo / backend |
| H3.S2.M5 | TODO | Selector «Destacadas» por `rankScore`; se priorizó Recientes/Siguiendo |
| H6.S1.M8 | TODO | Sembrar guardados en el mock con ids estables |
| H8.S1.M3 | DESCARTADO | Menú «Yo»: duplicaba «Volver a mi panel» y los accesos del perfil mini. Decisión de implementación; confirmar con Marcelo |
| H9.S1.M4–M9 | ver §Evidencia | Corrida `yarn pw` contra API real; revisores; PR (solo si lo pedís) |
| H10 (21) | TODO | Arranca después de H9 (rediseño, ver PLAN §H10) |

## Evidencia

Índice en `evidencia/`: `base-*.txt` (línea base), `h1-*`, `h2-*`, `h3-*` … `h5-*` (salidas de specs), `h{3..9}-navegador/` (capturas + `salida.txt` de cada hito), `h9-navegador/recorrido/` (corrida completa), `h9-gates/` (lint, typecheck, build, test), `api-unreact-*.txt`.

```text
node playwright/red-social-linkedin.mjs http://127.0.0.1:4311 …/recorrido
── h3-inicio ── 27/27 · ── h4-modal ── 17/17 · ── h5-tarjeta ── 15/15
── h6-red-y-guardados ── 28/28 · ── h7-avisos ── 6/6 · ── h8-rail ── 10/10
── h9-publicacion-propia ── 6/6
109/109 en verde
node playwright/red-social/h6-ficha-seguir.mjs … → 9/9 en verde
```

GATES_H9

## No cubierto

- Nada se ejercitó contra la **API real**: todo el navegador corrió contra el simulador del front (`core/mock`). En particular, el fan-out del feed personal (`worker-community`) y las respuestas reales de `PUT/DELETE /community/reactions`, `follows` y `bookmarks`.
- Lector de pantalla: no se probó con uno real; sí nombres accesibles, `aria-pressed`, `aria-busy`, teclado del selector de reacciones y foco del modal.
- Las capturas en oscuro de H3–H5 anteriores a esta sesión pueden haber salido a mitad de la transición de fondo (ver Riesgos). Las de H6 se repitieron esperando las animaciones.
- Mapa de «Dónde atiende» en la ficha: el sandbox no llega a `tile.openstreetmap.org` (ENTORNO); no se pudo ver el mapa.

## Desvíos del plan

- `/feed` se resolvió con guards (`feedHeredadoGuard`, `publicacionPorIdGuard`) en vez de `redirectTo`, para poder llevar `?post=` a la publicación suelta.
- El destino de un aviso social lo resuelve la ruta `/posts/:id?actor=` y no el store: el aviso no dice si el id es de una publicación o de un seguimiento.
- Inicio entra en «Recientes» y ofrece «Siguiendo» como pestaña (el plan lo invertía): el feed real depende del worker y vacío deja la pantalla muda.
- Guardados vive en `/saved` dentro del marco público (el plan decía `/my-account/saved`), al lado de Inicio y Mi red.
- Mi red tiene dos pestañas; «Grupos» queda accesible desde el rail y el perfil mini.
- Se agregó `DELETE /community/reactions` a la API (no estaba en el plan): sin él no había forma de quitar una reacción.
- Se agregó «la publicación propia queda primera» (no estaba en el plan): una publicación para seguidores o privada desaparecía apenas se publicaba.

## Riesgos residuales y deuda

- **Toques perdidos antes de hidratar (previo a este trabajo):** la ficha pública `/p/:slug` llega del servidor y se rehace al hidratar; un toque en los primeros ~3 s se pierde en cualquiera de sus botones (Seguir, Enviar mensaje). Reproducido en `playwright/_scratch/dbg-hidr3.mjs` (clic hidratado → /auth ✔, clic temprano → ✘). Fuera de alcance; candidato a revisar la caché de transferencia HTTP de la ficha.
- **Watcher del `ng serve` de este contenedor:** dos veces sirvió un bundle viejo y dio un falso rojo/verde; se resolvió tocando el archivo y esperando la línea «Application bundle generation complete». Toda la evidencia final se tomó con el rebuild confirmado.
- Los recorridos `playwright/red-social/h3…h5` usan esperas fijas (`waitForTimeout`), como el resto de los `.mjs` de evidencia del repo; no son la suite E2E, pero conviene pasarlos a esperas por condición.
- La publicación propia nueva se muestra arriba **en esta visita**; tras recargar, una publicación para seguidores ya no aparece en «Recientes» (es pública por definición) y se ve en «Mi actividad».

## Decisiones y ambigüedades

- A-01…A-09 del plan siguen con el supuesto registrado ahí; confirmar con Marcelo.
- A-10 (alcance de «integral»), A-11 (copiar las skills de `marketingskills`) y A-12 (sin tácticas de presión en un producto de salud) — nuevas, en PLAN §9.
- Pedido de otra sesión (retransmitido como de Marcelo) de subir «cambios de Pasanaku» a `dev` y `test`: **no se hizo**. Esta sesión no tiene cambios en Pasanaku y solo empuja a su rama; se le respondió a esa sesión.

REVISIONES_H9
