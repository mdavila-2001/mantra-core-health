# CARRIL_REPORT — Pablo

> Único reporte funcional de Pablo. Cada máquina edita exclusivamente su sección.

## Cabecera de ejecución

- Base `origin/dev` SHA: front `23906b7` · API `6c21ffce` · docs `c7071a0e` · mobile `8dab6c9`
- Fecha/hora: 2026-08-17, 20:20–21:15 UTC
- Ambiente: **stack de desarrollo local**, no un stack E2E aislado (ver bloqueo B-P4-03)
- Seed catalog version: `2026-08-17-pablo-v1` — **no ejecutado todavía** (ver bloqueo B-P4-02)
- `seed:e2e:verify-auth`: no ejecutado — el comando no existe en el repo
- API health: `GET /health` → `200 {"status":"ok"}`
- Front health: contenedor `mantra-core-health-dev` up (4200), SSR no ejercitado todavía
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

**No comprobado todavía.** `app.routes.server.ts` declara `**` → `RenderMode.Client`,
así que hoy `/buscar` y una eventual `/p/:slug` devolverían el cascarón y no el
contenido. Es trabajo pendiente de este carril, no un bloqueo externo.

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

Ninguna todavía. **No se creó ningún perfil a mano por Postman ni por SQL**, que
es lo que el contrato de seeds prohíbe explícitamente: el perfil publicado tiene
que salir de un seeder reproducible desde cero. Ver bloqueo B-P4-02.

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

Verificado por lectura del código, **no** por prueba ejecutada todavía:
`CommunityPublicService` arma la proyección campo por campo, sin *spread* de la
entidad, y `PUBLIC_RESULT_KEYS` / `PUBLIC_PROFILE_KEYS` declaran la lista blanca
que su spec compara contra la salida real. El tipo del cliente nuevo es el
espejo de esa lista.

Falta la prueba anónima de ausencia de campos prohibidos contra datos reales
(P4-E2E-002), que no se puede ejecutar sin un perfil publicado.

### Defectos/bloqueos

**B-P4-01 — cerrado.** Ninguna ruta escribía `visibility_concept_id`. Corregido
en `404de2f1`.

**B-P4-02 — abierto, es el bloqueo del carril.** No existe `seed:e2e` ni ninguno
de los comandos que el contrato exige (`seed:e2e:reset`, `:verify`,
`:verify-auth`). El repo tiene `tools/redesa/seed-dev-data.mjs`, que siembra por
la API real pero es acumulativo y no crea perfiles públicos publicados. Sin
`doctor-uno-e2e` y `doctor-dos-e2e` publicados y autenticables, ni P4-E2E-001 ni
P4-E2E-002 pueden ejecutarse. Es el siguiente trabajo del carril.

**B-P4-03 — abierto, de entorno.** No hay stack E2E aislado: la única base es la
de desarrollo, `mantra_redesa_health`, cuyo nombre no contiene `e2e` ni `test`,
así que el guard de ambiente que el contrato de seeds exige **rechazaría**
correctamente sembrar ahí. Sembrar sobre la base de desarrollo compartida
tampoco es aceptable. Hace falta decidir entre una base E2E separada en el mismo
Postgres o un `COMPOSE_PROJECT_NAME` propio.

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
- Front `9d8767a` — `feat(p4-public): cliente del directorio público anónimo`

Sin PR todavía: el carril no pasa G2, G4 ni G5.
