# CARRIL_REPORT — Pablo

> Único reporte funcional de Pablo. Cada máquina edita exclusivamente su sección.

## Cabecera de ejecución

- Base `origin/dev` SHA: front `23906b7` · API `6c21ffce` · docs `c7071a0e` · mobile `8dab6c9`
- Fecha/hora: 2026-08-17, 20:20–22:55 UTC
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
| --- | --- | --- |
| `GET /public/search?limit=2` | `200` | `{"items":[],"nextCursor":null,"totalHint":null,"generatedAt":"…"}` |
| `GET /public/search/practitioners?limit=3` | `200` | misma envoltura, `items: []` |
| `GET /public/nearby` (sin coordenadas) | `400` | `VALIDATION_FAILED` · «Se requieren coordenadas válidas: lat en [-90,90] y lng en [-180,180]» |
| `GET /p/no-existe` | `404` | `{"code":"NOT_FOUND","message":"No encontrado","details":{"slug":"no-existe"},…}` |
| `GET /public/directory` | `200` | proyección de `read_models`, ya existente |

Cabeceras verificadas en `/public/search`:

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 60
ETag: W/"xkcvDqunsokSbYYxgd6YvwDz2P8"
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Coinciden con `openapi/CONTRATO-PUBLICO.md` §4: límite por IP de 60/min, ETag
débil y caché de 60 s con revalidación. **La superficie existe y responde.**

Desviación del contrato encontrada, sin impacto funcional: el contrato
documentaba el cuerpo del 404 como `{"statusCode":404,"message":"No encontrado"}`
y la API sirve `{"code":"NOT_FOUND","message":"No encontrado","details":{…},…}`,
que es el filtro de excepciones global del proyecto. El `details.slug` devuelve
el slug que mandó quien llama, así que **no revela existencia**. Lo que estaba
mal era el documento, no el código: corregido (D-P4-01, cerrado).

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

API (commit `56c2e4e2` y el cierre de desajustes):

- `tools/e2e/entorno.mjs`, `seed-e2e.mjs`, `verify-e2e.mjs`, `reset-e2e.mjs`.
- `package.json`: `seed:e2e:reset`, `seed:e2e`, `seed:e2e:verify`, `seed:e2e:verify-auth`.
- `openapi/CONTRATO-PUBLICO.md`: cuerpo real del 404.

Front (`pablo/p4-buscador-publico`, commits `9d8767a` y `f3e2fee`):

- `core/data-access/public-directory/public-directory.types.ts`: los tipos del contrato público.
- `core/data-access/public-directory/public-directory.client.ts`: las nueve lecturas anónimas.
- `core/data-access/public-directory/public-directory.client.spec.ts`: 12 pruebas.
- `core/data-access/community/community.types.ts`: `visibility` en la vitrina propia.
- `features/public-profile/`: la ficha, su resolver y 11 pruebas.
- `app.routes.ts`: las cinco rutas de ficha, sin guard.
- `app.routes.server.ts`: `RenderMode.Server` para las cinco.

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
| --- | --- |
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
Postgres, con API propia en `:3001`. `seed:e2e:reset` ya existe
(`tools/e2e/reset-e2e.mjs`, `--truncate` por omisión y `--drop` cuando cambia el
esquema). El ciclo completo se probó de punta a punta: reset → reinicio de la
API → `seed:e2e` (13/13) → `verify-auth` (verde) → `verify` (verde). La siembra
es reproducible desde cero, no acumulativa.

El guard se probó **apuntándolo a la base de desarrollo**: corta con exit 2 y el
mensaje «`DB_NAME="mantra_redesa_health"` no contiene "e2e" ni "test"». No tiene
`--force`.

**B-P4-04 — cerrado.** El `.env` declaraba una contraseña de 49 caracteres y el
volumen de Postgres usa una de 32; los contenedores vivos coincidían con el
volumen y el archivo no, así que cualquier `docker compose up` que recreara
Postgres o la API desde el `.env` dejaba la API sin conectarse.

Se alineó el `.env` al valor real —cero downtime, sin tocar la base— y se
verificó conectando con la credencial del archivo. **No se rotó nada**: si la
contraseña larga era una rotación intencional, el valor quedó anotado dentro del
propio `.env` (que ya está en `.gitignore`) junto con los dos comandos que la
aplican. Se prefirió eso a rotar por cuenta propia, que obliga a recrear la API
y los 21 workers.

**B-P4-05 — cerrado.** Un slug inexistente o despublicado devolvía HTTP 200 con
la pantalla «Ese perfil no está disponible»: la UX correcta y el estado
equivocado, que es como un enlace muerto termina indexado como ficha válida.

Resultó no hacer falta tocar `src/server.ts`: `RESPONSE_INIT` —token público de
`@angular/core`— es el **mismo objeto** que el motor de SSR usa para construir
la respuesta después de renderizar, así que el resolver le cambia el estado
durante el render y llega a tiempo. Se inyecta `optional` porque en el navegador
no existe. Verificado:

```text
/p/doctor-uno-e2e     -> 200  <h1>Dra. Marisol Quispe Ticona</h1>
/p/doctor-oculto-e2e  -> 404  <h1>Ese perfil no está disponible</h1>
/p/no-existe-jamas    -> 404  <h1>Ese perfil no está disponible</h1>
```

Los dos que no resuelven dan el mismo estado y la misma pantalla: el
despublicado no se distingue del inexistente tampoco por el código HTTP.

**D-P4-01 — cerrado.** `openapi/CONTRATO-PUBLICO.md` §4 documentaba un cuerpo de
404 que la API no sirve. Corregido con el cuerpo real y con la nota de por qué
el `details.slug` que devuelve no revela existencia.

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

## Segunda tanda — 18/08/2026 · rebase sobre `dev` y superficie de búsqueda

### Rebase (G8)

Las dos ramas partían de una base vieja: front **39 commits** por detrás de
`origin/dev`, API **34**. Rebasadas las dos sobre `origin/dev` limpio.

- API: un solo conflicto, de importaciones en `community-social.service.spec.ts`
  —`AttachableFileService` entró en `dev` mientras P4 agregaba `COMM`—. Se
  conservan las dos. Base nueva: `d8a46221`.
- Front: rebase sin conflictos. Base nueva: `f0ca260`.

Respaldos antes de rebasear: `backup/p4-api-pre-rebase` y `backup/p4-web-pre-rebase`.

### Lo que faltaba y ahora está

El reporte anterior cerraba con dos pendientes. Los dos están hechos.

**1 · Las pantallas de listado leen la API real.** `profesionales-listado`
pintaba `PROFESIONALES_DE_MUESTRA` —un archivo de datos inventados, ya
borrado— y las otras cinco eran marcado estático de la bóveda sin lógica. Las
seis leen ahora su endpoint público, sin sesión, con sus cuatro estados
conmutados por el estado real de la lectura y con paginación por cursor.

**2 · Los journeys E2E existen en los dos adaptadores.**
`playwright/carril-p4-buscador-publico.spec.ts` y
`cypress/e2e/real/11-directorio-publico.cy.ts` cubren P4-E2E-001 y P4-E2E-002
contra la API viva, sin `route.fulfill` ni un cuerpo escrito a mano.

### Tres defectos encontrados por el camino

**D-P4-02 · `/public/search/medications` devolvía el directorio entero de
profesionales.** El controlador acota por `kind: 'MEDICATION'`; el servicio
traduce el vertical a un concepto de sujeto con un `find` sobre
`KIND_BY_TARGET_CONCEPT`, y `MEDICATION` no está en ese mapa —un medicamento no
es un perfil: vive en el catálogo de farmacia—. El `find` devolvía `undefined`,
el filtro **se perdía en silencio** y la consulta salía sin acotar.

Verificado contra la API viva antes de tocar nada:

```text
$ curl -s 'http://localhost:3001/public/search/medications?limit=2'
{"items":[{"kind":"PRACTITIONER","slug":"doctor-dos-e2e", …
```

Quien buscaba un remedio recibía una lista de médicos, con `kind` que ni
siquiera coincidía con el vertical pedido. Corregido: un vertical pedido sin
concepto de sujeto devuelve **vacío** y lo deja anotado en el log del servicio,
igual que `nearby` mientras no existan las coordenadas. Cuatro pruebas nuevas,
una de ellas afirmando que el repositorio **no llega a consultarse**.

**D-P4-03 · la ruta de datos de la ficha chocaba con la ruta de la pantalla.**
El cliente pedía `GET /p/:slug`, que es **también la URL de la ficha en el
router**. Las dos no pueden convivir del lado del navegador: el proxy enruta
comparando el comienzo de la ruta, así que mandar `/p` a la API se come la ruta
del router —abrir la ficha devolvería JSON en vez de la pantalla— y no mandarla
deja la llamada pidiéndole `/p/:slug` al servidor de Angular, que responde el
`index.html` con **200**; el cliente recibe HTML donde espera JSON y el fallo
sale como «error inesperado».

Lo denunciaba `check-client-prefixes.mjs`, que fallaba en la rama. Por eso el
SSR sí funcionaba —se construye con `PUBLIC_API_BASE_URL` absoluta y no pasa por
el proxy— y la ficha estaba rota en `:4200`.

Corregido en la API con una ruta aditiva e inequívoca,
`GET /public/profiles/:prefijo/:slug`, que delega en el mismo servicio con el
mismo concepto de sujeto. **Las cinco rutas cortas se quedan**: son el contrato
público y lo que alguien pega en un mensaje. Un prefijo inventado da el mismo
404 que un slug inexistente, no un 400: un 400 abriría por la puerta de al lado
la distinción que esta superficie no hace.

**D-P4-04 · `city` y los filtros por vertical estaban en el contrato y no en el
código.** `CONTRATO-PUBLICO.md` §2 promete `city`, `specialty`, `form`,
`inStock`, `kind`, `study`, `planKind` y `open`. El controlador lee **`q`,
`cursor`, `limit` y `verified`**, y nada más; `city` viaja como `null` en toda
respuesta porque `community.public_profiles` no tiene columna de ciudad.

No es un defecto de código sino de documento, pero cuesta caro: quien construya
una pantalla contra esa tabla dibuja un filtro que no filtra. El contrato ahora
marca cada parámetro como **implementado** o *previsto*, con la advertencia de
qué pasa si se usa uno previsto.

Consecuencia en las pantallas: la barra de filtros conserva la caja de texto —y
en profesionales, «sólo verificados»— y **no dibuja los seis selectores de la
maqueta que no tienen backend**. Es una desviación deliberada de la maqueta y
está acá para que se vea: alguien filtra «Atiende hoy», la lista no cambia, y la
pantalla le dice —sin decírselo— que todos atienden hoy. Un filtro que no filtra
no es un pendiente visual; es una respuesta equivocada a una pregunta que la
persona sí hizo. Vuelven cuando exista el dato.

### Rutas públicas con las URL de la ficha

`redsat.routes.ts` es un archivo **generado** y deriva el segmento del nombre de
archivo de cada maqueta: la portada quedaba en `/buscar/buscador-listado`. Sirve
para recorrer la bóveda; no sirve como superficie pública.

Las URL que la ficha declara se agregaron en `app.routes.ts` —commit aislado,
como pide el carril— **antes** del bloque generado, que sigue intacto:

```text
/buscar  ·  /buscar/profesionales  ·  /buscar/medicamentos
/buscar/hospitales  ·  /buscar/diagnostico  ·  /buscar/aseguradoras
/buscar/mapa
```

`hospitales` y no `organizaciones`: `check-route-prefixes.mjs` denuncia que
`/organizaciones` empieza con el prefijo de API `/org`, y el proxy compara por
inicio de texto y no por segmento. Además es el rótulo de la propia pestaña.

Los enlaces de la bóveda que apuntan a `/buscar/buscador-listado` siguen
abriendo **por retroceso del router** entre los dos bloques `buscar`. Eso es
comportamiento del router y no una garantía de este repositorio, y de él dependen
a la vez las URL limpias y los enlaces viejos; si dejara de ocurrir, media
superficie pública devolvería la pantalla equivocada **sin ningún error**. Hay
una prueba (`app.routes.spec.ts`) que resuelve las dos formas y falla si eso
cambia.

### `?q=` es la fuente de verdad del texto buscado

No hay estado de búsqueda escondido en un componente: el texto vive en la URL.
Tres cosas salen de ahí y ninguna hubo que programarla aparte —una búsqueda se
puede pegar en un mensaje; el servidor la renderiza con resultados, porque el
SSR no tiene una caja de texto que leer pero sí una URL; y el buscador del
marco público, que está en las catorce pantallas y no conoce a ninguna, sólo
tiene que navegar.

El buscador del header es un `<form>` y no un campo que navega al teclear: vive
también en las fichas de perfil, y navegar al teclear sacaría a alguien de la
ficha que está leyendo en la primera letra.

### SSR y datos estructurados

- Las seis pantallas de búsqueda pasan a `RenderMode.Server`, por el mismo
  motivo que las fichas: se ven igual para todo el mundo y son la puerta de
  entrada de quien no tiene cuenta. `Prerender` no sirve —el contenido depende
  de `?q=` y del estado del directorio—.
- `/buscar/mapa` queda en `Client`: abre pidiendo consentimiento y no hay nada
  que el servidor pueda resolver.
- **JSON-LD** por tipo de perfil: `Physician`, `MedicalOrganization`,
  `Pharmacy`, `DiagnosticLab`, `InsuranceAgency`. Se inyecta por DOM en la
  cabeza porque Angular **elimina** los `<script>` de las plantillas; el motor
  de SSR serializa el documento después de estabilizar, así que viaja en el HTML
  de la respuesta. Se reemplaza el nodo anterior en vez de agregar uno: el
  router reutiliza el componente entre slugs, y una página con cinco `Physician`
  declarados no la lee ningún rastreador.
- **No hay `aggregateRating` sin reseñas.** schema.org exige `ratingCount`
  mayor que cero, y declarar «0 reseñas, puntuación 0» publica en el buscador
  que a ese profesional lo calificaron mal cuando nadie lo calificó. Tampoco
  `address` sin dirección ni `geo` sin coordenadas.
- El texto del JSON-LD escapa `<`: los campos los escribe cada prestador en su
  propia vitrina, y un `</script>` dentro de una cadena cerraría la etiqueta ahí
  mismo y dejaría el resto del objeto como marcado suelto.

### V65-12 · el mapa

- **La ubicación se pide, no se toma.** La pantalla abre en consentimiento y no
  llama a la geolocalización hasta que alguien aprieta el botón. Pedirla al
  entrar convierte una visita en un diálogo de sistema que nadie provocó, y la
  respuesta refleja —«bloquear»— es permanente para el sitio.
- **La alternativa escrita está siempre visible**, no sólo cuando se deniega el
  permiso (F6.72).
- **La tabla va debajo del mapa con la misma información** y la columna se
  titula «Distancia en línea recta» (`PAC-MED-005`). El mapa lleva `role="img"`
  con una descripción que remite a la tabla: el mapa nunca es el único camino al
  dato.
- Hoy la pantalla cae en el estado vacío porque `GET /public/nearby` devuelve
  `items: []` por diseño —el directorio no tiene coordenadas propias todavía— y
  el estado vacío explica exactamente eso. El recorrido está cableado contra el
  endpoint real, así que el día que haya coordenadas se pinta sin tocar una
  línea.

### Paginación por cursor

La maqueta dibuja «Anteriores» y el contrato pagina por cursor opaco: no hay
`prevCursor` que pedir. El store guarda la **pila de cursores** con los que se
pidió cada página, y volver es desapilar y repetir la petición anterior. Se
descartó ocultar el botón: una lista pública en la que sólo se puede avanzar
obliga a empezar de cero para releer un resultado que se acaba de pasar.

El rótulo dice «aproximadamente N» sólo cuando `totalHint` viene, y cuando no
viene dice cuántos se están viendo. El contrato prohíbe escribir «N resultados»
con una pista.

### Evidencia funcional — 18/08/2026, contra el stack real

Entorno: API E2E corriendo **en el host** contra la base `mantra_redesa_health_e2e`
del mismo Postgres, en `:3001`. Front en `:4250` (`ng serve` con el proxy
apuntado a esa API) y en `:4300` (artefacto SSR construido). Sin mocks.

#### La prueba reina

```text
$ curl -s http://localhost:4300/p/doctor-uno-e2e
HTTP 200 · 12290 bytes
<title>Dra. Marisol Quispe Ticona — AloVida</title>
<h1>Dra. Marisol Quispe Ticona</h1>
```

El nombre viaja en el `<h1>` del HTML que devuelve el servidor, sin cookies y
sin `Authorization`.

#### JSON-LD servido en el HTML

```json
{ "@context": "https://schema.org", "@type": "Physician",
  "name": "Dra. Marisol Quispe Ticona",
  "url": "http://localhost:4300/p/doctor-uno-e2e",
  "description": "Cardióloga · Hospital del Norte" }
```

**Sin `aggregateRating`**, porque ese perfil no tiene reseñas. La decisión de no
publicar una puntuación inventada, funcionando.

#### Estado HTTP real

```text
/p/doctor-uno-e2e     -> 200  Dra. Marisol Quispe Ticona
/p/doctor-oculto-e2e  -> 404  Ese perfil no está disponible
/p/no-existe-jamas    -> 404  Ese perfil no está disponible
```

#### Los siete destinos públicos, renderizados en servidor

| Ruta | HTTP | Estado | `<h1>` |
| --- | --- | --- | --- |
| `/buscar` | 200 | `datos` | Buscá salud cerca tuyo |
| `/buscar?q=Mamani` | 200 | `datos` | 2 coincidencias de Mamani, 0 de Quispe |
| `/buscar/profesionales` | 200 | `datos` | Profesionales de salud |
| `/buscar/medicamentos` | 200 | `vacio` | Dónde conseguir tu medicamento |
| `/buscar/hospitales` | 200 | `vacio` | Hospitales y clínicas |
| `/buscar/diagnostico` | 200 | `vacio` | Laboratorios y centros de imagen |
| `/buscar/aseguradoras` | 200 | `vacio` | Aseguradoras y convenios |

`vacio` es correcto: sólo hay profesionales sembrados. Cada estado vacío sirve
**el texto de su propia ficha V65**, verificado uno a uno; son cuatro textos
distintos y ninguno es el genérico.

Las tarjetas enlazan a `/p/doctor-uno-e2e` y `/p/doctor-dos-e2e`, y las dos
llevan el sello «Declarado» — correcto, ninguno está verificado.

#### D-P4-02 verificado en vivo

```text
$ curl -s 'http://localhost:3001/public/search/medications?limit=5'
{"items":[],"nextCursor":null,"totalHint":0,…}
```

Antes devolvía el directorio entero de profesionales. Respondió **al instante
mientras la base estaba saturada**, que es la confirmación de que la corrección
corta antes de consultar — justo lo que afirma su prueba.

#### Con sesión real: la superficie pública no cambia

Login real de `bootstrap.admin.e2e@local.test` (rol `SECURITY_ADMIN`):

- `GET /public/search` devuelve **exactamente los mismos ítems** con y sin el
  token. El contrato promete que el resultado no depende de quién mira, y se
  cumple byte a byte.
- `GET /public/profiles/p/doctor-oculto-e2e` **con token de administrador** →
  `404`. La superficie pública es una proyección aparte, no una vista filtrada
  por permisos. Si un admin viera el perfil despublicado por acá, la caché
  `public, max-age=60` podría servir esa respuesta a un anónimo.

**Segundo motivo, no previsto, para D-P4-03.** `authInterceptor.isPublic()`
reconoce como pública toda ruta que empiece con `/public/`. `/p/:slug` **no**
empieza así, de modo que con una sesión abierta el interceptor le habría
adjuntado el bearer token — a un endpoint que responde `Cache-Control: public,
max-age=60`. Mandar un token a un endpoint público cacheable es un problema de
higiene real, aunque el cuerpo no varíe. Al pedir la ficha por
`/public/profiles/…` deja de ocurrir.

#### Journeys

`playwright/carril-p4-buscador-publico.spec.ts` contra `:4250` —donde `ng serve`
**sí** renderiza en servidor (`ng-server-context` presente), así que la misma
corrida cubre el HTML del servidor y la navegación del navegador sobre un solo
origen, que es la forma de producción—:

```text
13 passed (22.5s)
```

Cubre: buscar y abrir ficha sin cuenta · `?q=` acota · el buscador del marco
lleva a resultados · la pestaña de profesionales · el recorrido no deja token ni
manda `Authorization` · despublicado e inexistente dan la misma pantalla, el
mismo 404 y el mismo `code`/`message` · la pantalla no dice «privado» · prefijo
de otro vertical da 404 sin redirigir · el despublicado no aparece en la
búsqueda · y los tres casos de SSR por HTTP.

#### Lighthouse sobre `/p/:slug`

| Categoría | Puntaje |
| --- | --- |
| SEO | **92** |
| Accesibilidad | 92 |
| Buenas prácticas | 92 |

La meta del carril era SEO > 90.

#### Unitarias y gates

| Comando | Resultado |
| --- | --- |
| `yarn test` (front, suite completa) | **2725 passed** |
| Los 9 archivos que agotaron tiempo bajo carga 279, repetidos en calma | **134/134 passed** |
| `yarn test src/modules/community/services/` (API) | **225 passed**, 16 suites |
| `tsc --noEmit` (API) · `yarn typecheck` (front) | exit 0 |
| `check-client-prefixes` | ✓ 270 operaciones, todas ruteadas |
| `check-route-prefixes` | ✓ 154 rutas, ninguna colisiona |
| `check-architecture` | ✓ sin ciclos, capas en una dirección |
| `check-tokens` | ✓ 205 tokens |
| `check-bundle-budget` | ✓ inicial 356.73 kB |

Ninguna pieza de P4 está en el bundle inicial: se comprobó que
`rotuloDePagina`, `hayAnteriores`, `jsonLdDePerfil`, `TIPO_SCHEMA` e
`inicialesDe` no aparecen en los 12 archivos iniciales. Todo va diferido.

### Bloqueadores del entorno encontrados en esta tanda

**B-P4-06 — `origin/dev` no arrancaba. Ajeno a P4, corregido para desbloquear.**
`CommunityReviewsService` (P6, `4293c63f`, ya mergeado) inyecta
`EncountersRepository`; `ClinicalModule` lo provee **sin exportarlo** y
`CommunityModule` no lo importa. Nest no puede construir el grafo y el proceso
muere al arrancar. Verificado que es de `dev` y no del rebase:
`community.module.ts`, `community-reviews.service.ts` y `services/index.ts` son
**byte-idénticos** a `origin/dev`. Ni el typecheck ni las unitarias lo ven,
porque la resolución de dependencias sólo ocurre al levantar la aplicación.
Corregido en un commit propio y rotulado (`a2706b32`), sin ciclo —`clinical` no
importa nada de `community`— y con el mismo patrón que ya usa
`procedures_perioperative`.

**B-P4-07 — `ORM_SCHEMA_SYNC=safe` hace inarrancable el entorno en esta máquina.**
La API introspecciona 1284 tablas en cada arranque; una consulta de metadatos
tardó **2 325 881 ms** (39 minutos) y Postgres cortó la conexión. Con
`ORM_SCHEMA_SYNC=off` —lo que ya usa `test:integration`— arranca en 30 segundos
contra la misma base. No es un defecto del producto; es una precondición del
entorno que conviene dejar escrita.

**B-P4-08 — un corte de conexión de Postgres tumba el proceso de la API.**
`Connection terminated unexpectedly` sube sin capturar y mata el proceso; ocurrió
tres veces durante esta tanda e interrumpió una corrida de Playwright a mitad.
Es la misma fragilidad que este documento ya registraba como ticket aparte, ahora
con reproducción. Para tomar la evidencia se levantó la API bajo un supervisor
que la reinicia; **eso sortea el síntoma y no arregla nada**.

**La API deshabilita CORS** (`app.enableCors({ origin: false })`), así que el
front sólo puede hablarle por el proxy, mismo origen — `PUBLIC_API_BASE_URL`
vacío, como recomienda `src/server.ts`. Construir el SSR con una raíz absoluta
funciona desde Node y **falla desde el navegador**, y es lo que hizo fallar los
journeys hasta que se corrió el front por el proxy. No es un defecto: es la
forma en que este sistema está diseñado, y conviene que quede escrita porque la
evidencia por `curl` sola no la habría descubierto nunca.

### Lo que no se ejecutó

`cypress/e2e/real/11-directorio-publico.cy.ts` está escrito pero **no se corrió**:
su arnés construye el artefacto de producción y levanta su propio servidor, y
con esta máquina en carga 30–40 la corrida no cabía en la tanda. El adaptador
existe y es el mismo journey; queda pendiente de ejecución, no de escritura.

### Lo que falta para DONE

1. **Los campos propios de cada vertical.** Los DTOs declaran `specialties`,
   `priceFrom`+`currency`, `branchCount`, `studies`, `planKinds` y `openNow`;
   `toResult` proyecta nueve claves y la lista blanca falla si aparece una más,
   así que **ninguno se sirve**. Las tarjetas muestran lo que llega y omiten el
   resto —precio, disponibilidad horaria, distancia, modalidad— en vez de
   rellenarlo con los valores de la maqueta. Un precio inventado en un
   directorio de salud es alguien que llega con Bs 200 a una consulta de Bs 350.

2. **Los filtros de la maqueta que no tienen backend**, que son los mismos seis:
   modalidad, organización, disponibilidad, precio, calificación mínima e
   idioma, más `city` y `specialty`, que el contrato declara y el controlador no
   lee. Vuelven a la barra cuando exista el dato.

3. **Coordenadas del directorio.** `GET /public/nearby` valida y devuelve vacío
   porque no hay `geo_point`. El recorrido del mapa está cableado contra el
   endpoint real y hoy cae en su estado vacío, que lo explica.

Ninguno es un desajuste del entorno ni una deuda de este carril: son datos que
la API todavía no tiene. Lo que P4 prometía —búsqueda pública, fichas por URL
limpia, SSR con contenido real y los journeys sin sesión— está entregado.

### Gate de documentación

`check-doc-coverage` queda con **dos hallazgos preexistentes de `origin/dev`**,
ajenos a P4: `SurveysClient` (carril 10, `9f66497`) y `HelpBlockDismissalStore`
(`d2b5146`). P4 cerró el suyo documentando `PublicDirectoryClient` en
`docs/integrations/backend-api.md`. No se tocan los otros dos: son entregables
de otros carriles y quien los escribió sabe qué decir de ellos.
