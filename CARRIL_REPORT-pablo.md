# CARRIL_REPORT — Pablo

> Único reporte funcional de Pablo. Cada máquina edita exclusivamente su sección.

## Cabecera de ejecución

- Base `origin/dev` SHA: front `23906b7` · API `6c21ffce` · docs `c7071a0e` · mobile `8dab6c9`
- Fecha/hora: 2026-08-17, 20:20–21:15 UTC
- Ambiente: base E2E aislada `mantra_redesa_health_e2e` + API E2E propia en `:3001`
- Seed catalog version: `2026-08-17-pablo-v1` — **ejecutado, 13 llamadas correctas**
- `seed:e2e:verify-auth`: **verde**, 38 comprobaciones
- API health: dev `:3000` → `200`; E2E `:3001` → `200`
- Front health: SSR construido y servido en `:4300` contra la API E2E
- Workers health: 21 workers up; `identity_assurance` **unhealthy** (preexistente, ajeno a P4)

---

## P4 — Buscador público

Máquina: **Mac M5**. Rama propietaria: `pablo/p4-buscador-publico` (front y API).
Estado: **IMPLEMENTING**. No es DONE y no se declara DONE.

### Relevamiento API anónima real

Todo con `curl` **sin cabecera `Authorization`**, contra la API del stack local
(`http://localhost:3000`).

| Ruta | Status | Observado |
|---|---|---|
| `GET /public/search?limit=2` | `200` | `{"items":[],"nextCursor":null,"totalHint":null,"generatedAt":"…"}` |
| `GET /public/search/practitioners?limit=3` | `200` | misma envoltura, `items: []` |
| `GET /public/nearby` (sin coordenadas) | `400` | `VALIDATION_FAILED` · «Se requieren coordenadas válidas: lat en [-90,90] y lng en [-180,180]» |
| `GET /p/no-existe` | `404` | `{"code":"NOT_FOUND","message":"No encontrado","details":{"slug":"no-existe"},…}` |
| `GET /public/directory` | `200` | proyección de `read_models`, ya existente |

Cabeceras verificadas en `/public/search`:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 60
ETag: W/"xkcvDqunsokSbYYxgd6YvwDz2P8"
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Coinciden con `openapi/CONTRATO-PUBLICO.md` §4: límite por IP de 60/min, ETag
débil y caché de 60 s con revalidación. **La superficie existe y responde.**

Desviación del contrato encontrada, sin impacto funcional: el contrato documenta
el cuerpo del 404 como `{"statusCode":404,"message":"No encontrado"}` y la API
sirve `{"code":"NOT_FOUND","message":"No encontrado","details":{…},…}`, que es el
filtro de excepciones global del proyecto. El `details.slug` devuelve el slug que
mandó quien llama, así que **no revela existencia**; lo que hay que corregir es
el documento, no el código. Registrado como D-P4-01.

### Hueco de API cerrado en este carril

**El directorio público estaba vacío por construcción, y no por falta de datos.**

`GET /public/search` filtra por `public_profiles.visibility_concept_id =
PROFILE_VISIBILITY_PUBLIC`, y en la base había **70 perfiles con la columna en
`NULL`** —que el contrato lee explícitamente como *no publicado*—, así que la
consulta no podía devolver nada:

```sql
select visibility_concept_id, count(*) from community.public_profiles group by 1;
-- NULL | 70
```

La causa no era el dato sino la ausencia de una escritura: la columna existía en
el esquema y `PROFILE_VISIBILITY_CONCEPT_BY_CODE` mapeaba sus dos valores, pero
**ninguna ruta del producto la escribía**. Ni el bootstrap de
`POST /community/public-profiles`, ni el `PUT /community/profiles/me` del
titular. El mapa estaba exportado y sin un solo uso en todo `src/`.

Corrección (commit `404de2f1`): `visibility: 'PUBLIC' | 'PRIVATE'` opcional en
`UpsertOwnPublicProfileDto`, escrito en el alta y en la edición, y devuelto
resuelto en `OwnPublicProfileDto`. Omitirlo conserva lo que haya y en el alta
deja la columna nula: publicarse en un directorio anónimo que atraviesa todos
los tenants es opt-in explícito, y un `PUT` idempotente que no menciona el campo
no puede significar «publicame».

**No hubo cambio de esquema.** La columna ya existía.

### SSR comprobado por HTML

**Comprobado.** `curl` contra el servidor SSR real (`node dist/…/server.mjs` en
`:4300`, construido con `PUBLIC_API_BASE_URL=http://localhost:3001`):

```text
$ curl -s http://localhost:4300/p/doctor-uno-e2e
<title>Dra. Marisol Quispe Ticona — AloVida</title>
<meta property="og:title" content="Dra. Marisol Quispe Ticona">
<meta property="og:description" content="Cardióloga · Hospital del Norte">
<meta property="og:type" content="profile">
<meta property="og:updated_time" content="2026-08-17T22:13:00.252Z">
…
<h1>Dra. Marisol Quispe Ticona</h1>
```

El nombre está en el `<h1>` del HTML **que devuelve el servidor**, no en el DOM
hidratado: la respuesta pesa 11 987 bytes y el `<h1>` viaja adentro. Sin
cookies, sin `Authorization` y sin ningún enlace a login en la página.

Los `**` seguían mandando `/p/:slug` a `RenderMode.Client`. Ahora las cinco
rutas de ficha declaran `RenderMode.Server`.

**Un fallo silencioso encontrado y corregido en el camino.** La primera versión
pasaba la ficha resuelta como `input.required` ligado por el router. Eso exige
`withComponentInputBinding()` en `provideRouter`, que esta aplicación no tiene:
el servidor devolvía **200 con el cascarón vacío**, con los datos del perfil
presentes en el estado transferido y ausentes del HTML, y dos `NG0950` en un log
que nadie mira. Se detectó porque el `curl` de verificación buscaba el nombre en
el cuerpo y no lo encontró. Ahora se lee de `ActivatedRoute.data` —encender esa
opción del router cambiaría el comportamiento de las 141 pantallas, y esto es
una rama de carril que corre en paralelo con otras cuatro— y hay un spec de
componente que falla si alguien lo revierte.

### Cambios realizados

API (`pablo/p4-buscador-publico`, commit `404de2f1`):

- `community/dto/own-public-profile.dto.ts`: campo `visibility` en el `PUT` y en la respuesta.
- `community/services/community-social.service.ts`: escritura en alta y edición; resolución de la columna nula a `PRIVATE`.
- `community/repositories/public-profiles.repository.ts`: `visibilityConceptId` en el alta.
- `community/services/community-social.service.spec.ts`: cuatro pruebas nuevas.

Front (`pablo/p4-buscador-publico`, commit `9d8767a`):

- `core/data-access/public-directory/public-directory.types.ts`: los tipos del contrato público.
- `core/data-access/public-directory/public-directory.client.ts`: las nueve lecturas anónimas.
- `core/data-access/public-directory/public-directory.client.spec.ts`: 12 pruebas.
- `core/data-access/community/community.types.ts`: `visibility` en la vitrina propia.

### Seeds/precondiciones usadas

**Ningún perfil se creó a mano por Postman ni por SQL.** Todo sale de
`yarn seed:e2e` sobre una base recién creada y vacía.

Entorno: base `mantra_redesa_health_e2e` dentro del mismo Postgres del stack de
desarrollo, y una API E2E propia (`mantra-alovida-api:p4-e2e`) en `:3001` con
`ORM_SCHEMA_SYNC=safe`. La base de desarrollo no se tocó. Arrancó con 1284
tablas creadas desde cero y 0 perfiles públicos.

Actores sembrados por el camino real —alta asistida, activación con token de un
solo uso, **login real**, y la vitrina publicada por la propia titular con su
sesión—:

| Clave | Slug | Publicado |
| --- | --- | --- |
| `doctor.one` | `doctor-uno-e2e` | sí |
| `doctor.two` | `doctor-dos-e2e` | sí |
| `doctor.hidden` | `doctor-oculto-e2e` | **no**, a propósito |

`doctor.hidden` existe para que la prueba negativa tenga contra qué correr: sin
un perfil que exista y no sea público, «un slug despublicado da el mismo 404 que
uno inexistente» no se puede demostrar, sólo afirmar. Y no manda `visibility:
'PRIVATE'` sino que **omite el campo**, así que prueba además que omitirlo no
publica nada.

Pacientes, citas, encuentros, recetas, publicaciones y reseñas **no** se
siembran: son precondiciones de P1, P2, P3, P5 y P6, y sembrar una cita sin el
flujo que la produce es lo que el contrato prohíbe. El hueco está marcado en
`tools/e2e/seed-e2e.mjs`.

### Unit/API tests

| Comando | Resultado |
|---|---|
| `jest src/modules/community/services/community-social.service.spec.ts` | **22 passed** |
| `tsc -p tsconfig.json --noEmit` (API) | **exit 0** |
| `eslint` sobre los 4 archivos tocados (API) | **exit 0** |
| `yarn test --include="**/public-directory/*.spec.ts"` | **12 passed** |
| `yarn test` sobre los consumidores de la vitrina propia | **39 passed** |
| `yarn typecheck` (front: app + cypress + playwright) | **exit 0** |
| `eslint` sobre los archivos nuevos (front) | **exit 0** |

### Playwright

- P4-E2E-001: **no implementado**. Depende de un perfil publicado (B-P4-02).
- P4-E2E-002: **no implementado**.
- artifacts: —

### Cypress

No implementado.

### Privacidad/seguridad

Verificado **contra datos reales y sin token**, por `yarn seed:e2e:verify`:

- los dos perfiles publicados aparecen en `GET /public/search` anónimo;
- `doctor.hidden` **no** aparece;
- `/p/doctor-uno-e2e` y `/p/doctor-dos-e2e` resuelven sin sesión y sirven su nombre;
- ninguna de las dos fichas expone `tenantId`, `targetId`, `targetTypeConceptId`,
  `statusConceptId`, `visibilityConceptId`, `verificationStatusConceptId`,
  `avatarFileId`, `coverFileId`, `createdByUserId`, `updatedByUserId` ni `rowVersion`;
- `/p/doctor-oculto-e2e` da 404 **con el mismo mensaje** que
  `/p/no-existe-en-ninguna-parte-e2e`;
- `/f/doctor-uno-e2e` —prefijo de farmacia sobre un profesional— da 404 y no redirige.

En el front, la pantalla del estado vacío es idéntica para inexistente y
despublicado, y hay un spec que falla si alguien escribe «privado» en ella.

Esto cubre el contenido de P4-E2E-002. Lo que falta es empaquetarlo como journey
con su ID compartido y su adaptador Playwright/Cypress.

### Defectos/bloqueos

**B-P4-01 — cerrado.** Ninguna ruta escribía `visibility_concept_id`. Corregido
en `404de2f1`.

**B-P4-02 — cerrado.** No existía `seed:e2e` ni ninguno de los comandos del
contrato. Se agregó `tools/e2e/` con `seed:e2e`, `seed:e2e:verify` y
`seed:e2e:verify-auth` (commit `56c2e4e2`).

**B-P4-03 — cerrado.** Base E2E aislada `mantra_redesa_health_e2e` en el mismo
Postgres, con API propia en `:3001`. Falta pendiente menor: `seed:e2e:reset` no
existe todavía; hoy el reset se hace recreando la base a mano.

**B-P4-05 — abierto, SEO.** Un slug inexistente o despublicado devuelve HTTP
**200** con la pantalla «Ese perfil no está disponible». La UX es la correcta,
el estado no: un rastreador indexa esa página como válida. La versión de
`@angular/ssr` de este repo no expone ninguna forma soportada de fijar el estado
de la respuesta desde un componente, así que corregirlo exige tocar
`src/server.ts` —zona roja, compartida con las otras cuatro máquinas— para
consultar el slug antes de delegar en el motor de Angular. Se deja registrado en
vez de hacerlo al final de una jornada larga sobre un archivo compartido.

**B-P4-04 — abierto, del entorno local.** El `.env` en disco de la API tiene una
`POSTGRES_PASSWORD` distinta de la que el volumen de Postgres realmente usa
—derivó en algún momento posterior a la creación del stack—. Los contenedores
vivos coinciden entre sí, así que hoy funciona, pero **cualquier recreación del
contenedor de Postgres o de la API desde el `.env` deja la API sin poder
conectarse**. No se tocó el `.env`: corregirlo exige saber cuál de las dos
contraseñas es la buena.

**D-P4-01 — documental.** El cuerpo del 404 documentado en
`CONTRATO-PUBLICO.md` §4 no es el que sirve la API. Corregir el documento.

**Incidente de entorno provocado durante el relevamiento.** Una consulta con
`docker exec psql` dentro del contenedor de Postgres hizo que el postmaster
tratara al cliente como un backend caído y reiniciara el servidor; la API tomó
un `ECONNRESET` **no capturado** y quedó con un proceso zombi que ni siquiera
`docker restart` podía matar. Se recreó sólo el contenedor de la API, con la
credencial que el volumen realmente usa y sin tocar volúmenes; el stack quedó
sano. Las dos lecciones valen más que el incidente: consultar la base desde un
contenedor cliente aparte, nunca por `exec` en el servidor; y que un
`ECONNRESET` de la base tumbe el proceso de la API es una fragilidad real que
merece su propio ticket fuera de este carril.

### Commits/PR

- API `404de2f1` — `feat(p4-community): permitir declarar la visibilidad de la vitrina pública`
- API `56c2e4e2` — `feat(p4-e2e): entorno y seeds E2E reales para el directorio público`
- Front `9d8767a` — `feat(p4-public): cliente del directorio público anónimo`
- Front `63434e5` — `docs(p4): reporte del carril`
- Front `f3e2fee` — `feat(p4-public): ficha pública por slug con SSR real`

Sin PR todavía. Estado contra los gates:

| Gate | Estado |
| --- | --- |
| G0 higiene | verde |
| G1 build estático | verde (typecheck, lint y unit en los dos repos) |
| G2 datos reales | verde (`seed:e2e` + `verify-auth`) |
| G3 API real | verde (relevamiento anónimo + 38 comprobaciones) |
| G4 Playwright | **rojo — no implementado** |
| G5 Cypress | **rojo — no implementado** |
| G6 negativos | verde en contenido, falta empaquetarlo como journey |
| G7 evidencia | este documento |
| G8 rebase final | pendiente |

### Lo que falta para DONE

1. `P4-E2E-001` y `P4-E2E-002` en el catálogo poligonal compartido, con
   adaptador Playwright y adaptador Cypress.
2. Conectar las pantallas de listado del buscador (`/buscar/*`) al cliente real:
   hoy `profesionales-listado` sigue pintando `PROFESIONALES_DE_MUESTRA` y las
   otras cinco son marcado estático de la bóveda sin lógica.
3. `seed:e2e:reset`.
4. B-P4-05 (estado 404 en SSR) y B-P4-04 (deriva del `.env`).
