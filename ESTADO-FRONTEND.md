# Estado del frontend

Foto de la rama al **2026-07-31**. Sirve para orientarse antes de revisar el código y para
saber qué falta. Se actualiza cuando cambia el estado, no en cada commit.

---

## Lo primero: `dev` no compilaba

El commit `ca3a245` dejó el sistema de avisos a medias. Las plantillas y los estilos de `toast`,
`toast-container` y `toast-dev-panel` estaban completos, pero **todo su TypeScript estaba vacío**
(`interface Toast {}`, `class ToastService {}`, las tres clases sin miembros), y `app.html` usaba
tres cosas que `app.ts` no declaraba.

Como Angular revisa los tipos de **todos** los componentes del proyecto, `yarn build` fallaba con
16 errores y `yarn test` ni siquiera llegaba a correr. Cualquiera que clonara `dev` se encontraba
el repositorio sin compilar.

Se completó lo que las plantillas ya definían, sin agregar comportamiento que no estuviera
implícito en ellas.

> **Decisión que conviene que confirme el diseñador:** los avisos de error quedan fijos hasta que
> se los cierra; el resto se cierra solo (5 s, 7 s las advertencias). Un error que se borra
> mientras la persona lee es un error que nadie leyó. Se cambia en un solo lugar,
> `TOAST_DEFAULT_DURATION_MS`.

---

## Lo que entra en esta rama

| Tarea | Tarjeta | Qué es |
|---|---|---|
| — | *(nueva)* | Reparación de la compilación de `dev` |
| J1 | 15 | `environments/`, `proxy.conf.json` y `provideHttpClient(withFetch())` |
| J2 | 18 | `ViewState<T>` con los 9 estados de UX del M34 |
| J5 | 19 | Capa `data-access/`: clientes de `iam`, `profiles`, `identity` y `files` |
| J6 | 9 | Nomenclatura: las 11 clases sin sufijo `Component` |
| J7 | 12 | `ControlValueAccessor` en `input`, `checkbox` y `select` |

**J0** (tarjeta 3) también está hecha, pero no toca este repositorio: es `ORM_SCHEMA_SYNC=off` en
el `.env` local de la API.

La suite pasó de **162 a 222 pruebas**, todas en verde sobre 25 archivos, y `yarn build` con SSR y
prerender en verde.

### J1 · Conexión HTTP

`proxy.conf.json` declara **seis contextos explícitos** (`iam`, `public`, `terminology`,
`profiles`, `identity`, `common`), verificados uno por uno contra los `@Controller` reales de la
API. **No hay comodín a propósito**: la API expone unos 85 prefijos de primer nivel y un catch-all
se comería las rutas del propio Angular.

El tipo del entorno vive aparte, en `environment.types.ts`, porque `fileReplacements` sustituye
`environment.ts` entero al compilar: si el tipo viviera ahí, el archivo de desarrollo no podría
importarlo sin quedar atado al que va a ser reemplazado.

**Verificado contra la API viva**, no sólo compilando:

```
GET localhost:4200/public/directory  -> 200 · application/json · payload real de la API
GET localhost:4200/                  -> 200 · HTML de Angular
GET localhost:4200/design-system     -> 200 · HTML de Angular
GET localhost:4200/auth              -> 200 · HTML de Angular
```

O sea: la llamada cruza el proxy sin CORS y las rutas propias de Angular no se las come el proxy.

### J2 · `ViewState<T>`

Los nueve estados salen **literales del modelo canónico**
(`SALUD/Arquitectura/angular-architecture-map.md` §3.18). Las tres reglas que el modelo marca como
no cosméticas están expresadas **en el tipo**, no sólo en comentarios:

- **S1 ≠ S2** — `canRequestSensitiveData` devuelve `false` sólo para S1.
- **S5 ≠ S6** — `NotFoundViewState` no tiene ningún campo de datos, así que no hay por dónde
  filtrar que el recurso existe.
- **S7** — `asOf` es obligatorio: olvidar la antigüedad **no compila**.

La sección 05 de `/design-system` muestra los diez estados renderizados.

### J5 · `data-access/`

Un cliente por módulo, espejando sus `@Controller`. Los contratos se leyeron de los DTOs reales,
uno por uno. Como el backend valida con `forbidNonWhitelisted`, cada petición arma su cuerpo
explícitamente: un campo de más devuelve 400.

El login usa una **unión discriminada** por `email` o `nationalId` en vez de dos campos
opcionales. El backend exige uno u otro y nunca los dos; con dos opcionales, mandar ambos
compilaría y fallaría recién contra el servidor.

`data-access/terminology/` queda **con README y sin cliente**: se verificó contra la API y el
`GET /terminology/value-sets/:id/$expand` **no existe todavía** (es P3). Lo que hay es un `POST`
estilo FHIR en otra ruta y con otro contrato.

### J6 · Nomenclatura

**Lo que no se tocó, a propósito: los selectores.** `button[app-button]`, `app-badge` y el resto
son la API HTML del design system y están en el spec del diseñador. Por eso siguen apareciendo
referencias a `app-button` en las plantillas: son el selector, no el archivo.

El diff del refactor es simétrico —**120 inserciones y 120 borrados**— más los cuatro renombres
que git detecta al 94-100 % de similitud, que es exactamente lo que se ve en un renombrado uno a
uno.

### J7 · ControlValueAccessor

Los tres átomos se enchufan a un `FormGroup` **sin perder** el uso suelto con `[(value)]`. La
fontanería vive una sola vez en `form-control/value-accessor.ts`, compuesta y no heredada.

Dos decisiones que no son obvias al leer el código:

- `disabled` es un `input()` de solo lectura, así que `setDisabledState` no puede escribirlo. Se
  agregó `isDisabled`, un `computed` que combina la plantilla y el formulario: queda deshabilitado
  si **cualquiera** de las dos lo pide.
- `writeValue` escribe la señal y **no** avisa al formulario. Devolverle el valor que él mismo
  acaba de mandar es la receta del bucle infinito.

La sección 06 de `/design-system` tiene el `FormGroup` enlazando los tres átomos.

---

## Lo que falta

**Se puede hacer ya:** la cadena **J3 → J8 → J9** (interceptor de autenticación, `AuthService` con
guard de ruta, y la pantalla de login con selector de organización). Con eso se cierra la Fase 3 y
el Smoke v2.

**Bloqueada por el backend:** **J4** (tarjeta 17) necesita el catálogo de formas reales de error.
Sin eso habría que inventar los cuerpos de respuesta.

**Bloqueada por otra tarjeta:** **J10** (tarjeta 21) necesita, además de J7, la tarjeta 13 —
`ControlValueAccessor` parte 2, en `radio-group` y `switch`.

**Sin dueño** desde que Ender e Itzan no se incorporan: tarjetas 10 (breakpoints mobile-first), 11
(`vitest.config.ts` y umbrales de coverage), 13, 14 (escalar al diseñador la divergencia de
variantes de botón), 22 (pantalla de verificación de identidad) y 23 (altas administrativas).

---

## Cosas a tener en cuenta

### El repo no fija el modo de instalación de Yarn

No hay `.yarnrc.yml`, así que Yarn 4 instala en **modo PnP**: no crea `node_modules`, crea
`.pnp.cjs`, `.pnp.loader.mjs` y `.yarn/unplugged/`. Funciona —build y pruebas pasan— pero el
`.gitignore` no los contemplaba y aparecían **542 archivos sin seguimiento**, binarios incluidos,
listos para irse al repositorio por accidente. Además `.yarn/install-state.gz` estaba versionado
siendo un archivo generado.

Esta rama agrega esos patrones al `.gitignore` y saca `install-state.gz` del índice. Pero **la
decisión de fondo sigue abierta y es del equipo**: el repo de la API sí tiene `.yarnrc.yml` con
`nodeLinker: node-modules`, así que hoy los dos repositorios del proyecto instalan distinto.
Conviene que sea una decisión y no un accidente.

### Dos observaciones sobre el backend, fuera de este repo

Documentadas aparte, para revisar en grupo:

1. **El `docker-compose.yml` no le pasa `ORM_SCHEMA_SYNC` a los contenedores.** El ancla
   `x-app-env` enumera explícitamente cada variable y esa no está, así que la API y los 20 workers
   arrancan con el default del código —`safe`— y aplican DDL aditivo por su cuenta. La tarjeta 3
   protege a quien corre la API en el host, no al stack dockerizado.
2. **`docker compose up` sobre volúmenes vacíos no construye el esquema.** `postgres-init` muere
   con `apply_all.sql: No such file or directory` y `mongo-init` con un `ENOENT`; la base queda
   con 28 tablas, todas del catálogo interno de TimescaleDB. Es la tarjeta 1, ahora con evidencia.

### Entorno de desarrollo

`yarn` puede no estar en el `PATH`; con **`corepack yarn <script>`** funciona igual. Para levantar
todo: los almacenes con `docker compose up -d postgres mongodb redis opensearch minio` —**nunca el
servicio `api`**, por el punto 1 de arriba—, la API con `corepack yarn start` en su repo, y el
frontend con `corepack yarn start`.

Y si trabajás en Windows con `core.autocrlf=true` (el default de Git for Windows), conviene
ponerlo en `input` en cada repo: en el de la API, el CRLF rompe los scripts `.sh` que corren
dentro de los contenedores, y `git status` sale limpio igual, así que no hay ninguna señal.
