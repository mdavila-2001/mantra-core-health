# Avance de frontend · 2026-08-04 — J2 (armazón interior) y J3 (altas administrativas)

**Autor:** Justin · **Tareas:** J2 y J3 del `PLAN-EQUIPO-CIERRE.md` · **Rama:**
`justin/j2-j3-armazon-interior-y-altas`

Verificado ejecutando, no leyendo: 1 112 pruebas unitarias, 84 de Selenium, build SSR, y las dos
altas ejercitadas con `curl` contra la API viva en `localhost:3000` con la cuenta del bootstrap.

---

## Resumen en cinco líneas

1. El área con sesión tiene **navegación real**, y menú y rutas ya no pueden desincronizarse.
2. Las secciones que todavía no existen **se pueden recorrer** y dicen de qué son.
3. Están las altas de **usuario** y de **paciente asistido**, contra los endpoints reales.
4. El alta de **médico no se construyó**: no hay endpoint de administrador. Va como pedido al
   backend, no como invento del frontend.
5. Se encontró y corrigió un fallo que llevaba semanas: **ningún mensaje de validación por campo
   llegaba nunca a la pantalla**.

---

## J2 · El armazón interior

### Lo que ya estaba y no hacía falta escribir

La tarea decía «se diseña, no se convierte», y eso hizo pensar en construir desde cero. Al abrir
el repositorio resultó lo contrario: `shared/components/organisms/` ya tenía `shell`, `side-nav`,
`header`, `page-header`, `view-state-host` y la molécula `breadcrumb`, todos con su
comportamiento resuelto —cajón en móvil, salto al contenido, anuncio de ruta, colapso del
breadcrumb—.

**J2 no era construir piezas: era cablearlas sin duplicar la verdad.**

### El problema real que había

`ShellLayout` declaraba el menú a mano y `app.routes.ts` declaraba las rutas a mano. Dos listas,
escritas en dos archivos, que describen la misma cosa. Su propia prueba lo delataba:

```ts
// «un ítem que lleva a una ruta vacía es peor que no tenerlo»
expect(rutas).toEqual(['/panel', '/identidad/verificar', '/design-system']);
```

Esa prueba fija el síntoma, pero no puede evitar la causa: cualquiera puede agregar un ítem de
menú y olvidarse de la ruta, y la prueba sólo lo atrapa si además se acuerda de actualizarla.

### La decisión: un registro único

`core/navigation/navigation.map.ts` declara las secciones **una sola vez**, como datos puros. De
ese array salen las cuatro cosas a la vez:

```text
                          ┌── rutas hijas del armazón   (app.routes.ts)
APP_SECTIONS  ────────────┼── menú lateral por roles    (NavigationService.menu)
  (datos puros)           ├── título de cada pestaña    (titleOf)
                          └── ruta de navegación        (NavigationService.breadcrumbs)
```

El defecto de «un ítem sin ruta» pasó de *vigilado por una prueba* a **estructuralmente
imposible**: son el mismo array, o existen las dos cosas o no existe ninguna.

`core/navigation/` no importa ningún componente a propósito —son datos—, así que `core/` no
depende de `features/`. Quién dibuja cada sección lo decide `app.routes.ts`, que es donde los
componentes ya vivían.

### De dónde salen las secciones y los roles

No los inventé. Salen del vault, que además creció justo esta semana:

| Qué | De dónde |
| --- | --- |
| Dominios funcionales y «autoservicio aparte» | `SALUD/Vistas/👥 Actores y navegación.md` |
| Módulo que respalda cada sección y su fase | `SALUD/Vistas/🗺️ Orden de trabajo.md` |
| Roles de cada sección | Los `@Roles(...)` reales que ese mismo documento tabula |

Tres reglas del vault quedaron codificadas:

- **Primer nivel = dominio funcional**, segundo = vista. De ahí los grupos `General`, `Atención`,
  `Administración`, `Facturación` y `Mi cuenta`.
- **El menú se arma con los roles del token.** «Descubrir la interfaz a base de `403` es mal
  diseño y mala seguridad.» Ojo: esto es cortesía, **no** seguridad — quien escriba la URL llega
  igual y se topa con el guard y con el `403` de la API, que es la única autoridad.
- **Autoservicio aparte.** `Mi cuenta` va último y separado: mezclar «mis datos» con «los datos
  que administro» es como alguien termina editando el registro equivocado.

Un caso donde fui deliberadamente estricto: el documento de actores ubica a `SCHEDULER` en M32
(flujos), no en M41 (agenda). Aunque el nombre invite, **quedó afuera de Agenda**. Si es un error
del documento, se corrige ahí y acá se sigue.

### Las secciones que todavía no existen

Ocho de las diez nacen `planificada` y aterrizan en
`features/section-placeholder/`, que muestra el estado **S3** del M34 —vacío con próxima
acción— diciendo de qué es la sección y qué módulo del modelo la respalda.

Esto no es relleno: es lo que permite **recorrer el armazón entero hoy**, y le da a cada quien un
lugar declarado donde montar su pantalla. Encender una sección es agregar una línea en
`app.routes.ts`; el menú no se toca.

> **Por qué casi todas nacen planificadas.** El `🗺️ Orden de trabajo.md` marca **674 de las 693
> vistas** como «Listado pendiente»: se pueden diseñar, pero no implementar hasta que el backend
> exponga el `GET` de colección. El armazón se recorre entero igual, y cada pantalla se enciende
> cuando su listado exista.

### Detalles que valen

- **`/identidad/verificar` no se renombró.** Es lo que publica `IDENTITY_VERIFICATION_ROUTE` como
  destino del `403` `IDENTITY_VERIFICATION_REQUIRED`. Cambiarla rompería esa puerta sin que nada
  avise, así que hay una prueba que ata el registro al traductor de errores.
- **El breadcrumb tiene tres escalones** —panel, dominio, sección— y el dominio va **sin enlace**:
  es un rótulo de agrupación, no una pantalla.
- **Las pantallas hijas resuelven a su sección padre** por coincidencia más larga, así que cuando
  exista `/administracion/usuarios/nuevo` el menú va a seguir marcado y el breadcrumb, completo.
- **La vitrina quedó fuera del registro.** No es una sección del producto: no tiene módulo que la
  respalde ni ficha de vista. La agrega el armazón aparte, y al final.

---

## J3 · Altas administrativas

### El plan describía un problema que el backend ya había resuelto

J3 pedía las altas «compuestas: perfil → cuenta → vínculo, decisión D3: orden fijo, idempotencia
por intento, estado *perfil sin cuenta* visible y reanudable».

Al leer la API, eso **ya no corresponde**:

- `POST /iam/users/assisted-registration` crea persona, perfil y cuenta **en una sola
  transacción**.
- Es una invariante del modelo, no una casualidad: **regla 11 de la v4.0.7, registro CTI
  atómico** — padre e hija en la misma transacción, y jamás exigir el id de un padre ya
  registrado.

Encadenar tres llamadas desde el frontend habría **reintroducido justo el estado intermedio que
el modelo prohíbe**. Lo que sí puede duplicarse es el doble envío —el segundo click de un
trackpad lento—, y de eso ya se ocupa `app-form-actions`, que además de deshabilitar el botón
ignora el segundo click.

**Conviene actualizar la decisión D3 del plan con esto.**

### Lo que se entregó

**`features/admin/user-registration/`** — `POST /iam/users` (UC-01-01), `SECURITY_ADMIN`.
Nombre, correo, teléfono opcional, contraseña inicial y rol (`USER` / `SECURITY_ADMIN`, grupo de
radios porque son dos opciones). Es **la única alta que fija una contraseña desde afuera**, así
que la pantalla lo dice en voz alta al terminar: entregala por un canal seguro y pedí que la
cambien.

**`features/admin/assisted-registration/`** — `POST /iam/users/assisted-registration`
(C-18 / CAN-IDENT). Nombre, correo y **motivo obligatorio**. Nadie fija la contraseña de otro: la
API devuelve un token de activación de un solo uso y la clave la elige el titular al activar.

La pantalla existe en buena medida para resolver bien ese momento: el token va **primero**, con
el aviso pegado —se muestra una vez, sirve una vez, no es una contraseña—, en cifras tabulares
para poder dictarlo por teléfono, con botón de copiar y su caducidad en `DD/MM/AAAA HH:mm`. Si el
portapapeles no está disponible, el token sigue visible y seleccionable: copiar es comodidad,
verlo es el requisito.

El motivo no es burocracia: queda en la trazabilidad C-18 y es lo que justifica que alguien haya
creado una cuenta a nombre de otra persona.

### Dos campos que dejé afuera a propósito

`AssistedRegistrationDto` acepta `legalRepresentationId` y `legalRepresentativeUserId`, ambos
uuid de referencia. Las convenciones de UI del vault exigen para eso **un buscador con
autocompletado**, y hoy no hay endpoint de búsqueda que lo alimente. Pedir un uuid a mano sería
peor que no ofrecer el campo, así que quedan fuera hasta que exista el listado — la misma deuda
«Listado pendiente» de siempre. Está anotado en el JSDoc del componente.

---

## Lo que apareció verificando

### 1. Los mensajes de validación por campo nunca llegaban a la pantalla

**El hallazgo más importante de la sesión, y no es de J2 ni de J3: afecta a todos los formularios
de la aplicación.**

`core/http/error-to-view-state.ts` leía la lista de violaciones en `details.messages`. El backend
la manda en **`details.violations`** — `all-exceptions.filter.ts:357` la arma con
`{ violations: obj.message }`.

Resultado: **todo `400` de validación se veía como el genérico «Error de validación»**, sin decir
qué campo estaba mal, en toda la aplicación, desde siempre.

Comprobado contra la API viva:

```text
POST /iam/users/assisted-registration  {sin reason}
→ 400 {"code":"VALIDATION_FAILED","message":"Error de validación",
       "details":{"violations":["reason must be shorter than or equal to 500 characters",
                                "reason must be longer than or equal to 1 characters",
                                "reason must be a string"]}}
```

**Por qué no lo atrapó ninguna prueba:** la que cubría ese camino fabricaba su propio cuerpo con
la clave equivocada, así que verificaba que el código hiciera lo que hacía, no lo que la API
manda. Es el mismo patrón del `$expand` de terminología que encontró Pablo: unitaria en verde
sobre un contrato inventado.

**Lo más incómodo:** este mismo repositorio ya lo tenía escrito. `PENDIENTES-BACKEND.md`, del
2026-08-01, línea 50:

```text
POST /iam/auth/login  {}  -> 400 VALIDATION_FAILED + details.violations[]
```

Estaba observado y anotado; simplemente nunca se cableó.

Corregido leyendo `violations` con `messages` de reserva, y con una prueba nueva cuyo cuerpo está
**copiado literal de la respuesta real**, no inventado. De yapa, ahora los mensajes se anclan al
campo (`ViewStateIssue.field`), que era la razón de ser de esa lista.

### 2. El presupuesto de bundle estaba agotado

La línea base era **579,63 kB con el aviso en 580 kB**: 370 bytes de aire. Cualquier tarea de
esta semana lo cruzaba. Lo medí construyendo `HEAD` limpio antes de atribuirme el aviso — y sí,
mi trabajo lo cruzó (584,47 kB).

Subido a **620 kB** por decisión explícita. El techo de *error* sigue en 1 MB, sin tocar. Con J2 y
J3 completos el bundle inicial quedó en **586,63 kB**, y las dos altas viven en fragmentos
diferidos (7,2 y 8,1 kB): sólo las descarga quien es `SECURITY_ADMIN` y entra.

### 3. Cosas menores, anotadas y no arregladas

- **`dashboard.css` usa tokens que no existen.** `var(--space-5, 1.25rem)`, `var(--font-size-lg,
  …)`: la escala real es `--sp-*` y `--fs-*`. Vive de los valores de reserva, así que se ve bien
  y el chequeo de deriva TS↔CSS no lo detecta, porque no son tokens corridos sino inventados.
  Puede encajar en E1 de Ender.
- **El arnés de Selenium invoca `yarn` directo** (`spawnSync('yarn', ['build'])`). En una máquina
  con `corepack` pero sin `yarn` en el PATH —la mía— la construcción falla con «código
  desconocido» y ninguna prueba llega a correr. Se sortea con `E2E_SKIP_BUILD=true` sobre un
  artefacto recién construido. **A Ender e Itzan les va a pasar lo mismo al incorporarse.**

---

## La tarjeta: falta el endpoint de administrador para dar de alta a un profesional

El detalle completo quedó en `PENDIENTES-BACKEND.md`. En resumen:

**Lo único que existe es `POST /iam/auth/register-practitioner`, que es `@Public()`.** Su propio
DTO dice, textual:

> «El profesional se da de alta **él mismo**, sin que un administrador lo cree».

No construí la pantalla encima de ese endpoint, y no fue una objeción de estilo:

1. **El modelo lo declara al revés.** Construir una pantalla de administrador sobre él sería
   contradecir el contrato en el mismo archivo que lo define.
2. **El límite de peticiones es de superficie pública** — `@Throttle({ limit: 10, ttl: 60_000 })`,
   pensado para frenar automatización, no para que una organización cargue su plantel.
3. **La contraseña la teclearía el administrador.** El alta de paciente ya resolvió esto bien, con
   token de activación; el alta de profesional por administrador debería seguir ese camino.

Aplica la regla del plan: «Si algo requiere columna/tabla/concepto que el modelo no declara: NO lo
inventes — tarjeta a Marcelo».

**Cuando el endpoint exista, el trabajo del frontend es chico:** los tipos ya están
(`PractitionerRegistration` + `AssistedRegistrationResult`),
`features/admin/assisted-registration/` es el molde exacto, y pasar la sección de `planificada` a
`disponible` es una línea.

---

## Verificación

| Qué | Resultado |
| --- | --- |
| `yarn typecheck` | exit 0 |
| `yarn lint` | exit 0 |
| `yarn test --watch=false` | **1 112 en verde**, 99 archivos (antes 1 050) |
| Selenium — humo | 9 en verde |
| Selenium — navegación · autenticación · formularios | 42 en verde |
| Selenium — responsive · regresión | 33 en verde |
| `yarn build` (SSR) | exit 0, **sin aviso de presupuesto**, 586,63 kB / 620 |

Contra la API viva, con `admin@redesa.test` (roles `SECURITY_ADMIN`, `SUPERADMIN`):

```text
POST /iam/users                          → 201  {id, displayName, status(uuid), createdAt}
POST /iam/users  (mismo correo)          → 409  CONFLICT · "El email ya tiene una credencial…"
POST /iam/users/assisted-registration    → 201  {userId, activationToken(64), expiresAt, PENDING_ACTIVATION}
POST …/assisted-registration (sin reason)→ 400  VALIDATION_FAILED · details.violations[3]
POST …/assisted-registration (+password) → 400  "property password should not exist"
```

Ese último confirma `forbidNonWhitelisted` y valida la decisión de no mandar nunca una contraseña
por ese camino. El `status` del alta de usuario **es un uuid de concepto**, no una etiqueta: el
cliente lo mapea a `statusConceptId` y la pantalla no lo muestra crudo, como mandan las
convenciones.

---

## Qué queda para quien siga

- **J2 y J3 no bloquean a nadie.** Las secciones de Itzan (F-01) y de Ender ya tienen su lugar
  declarado en el registro.
- **El alta de médico** espera el endpoint. Ver `PENDIENTES-BACKEND.md`.
- **La decisión D3 del plan** conviene actualizarla: la orquestación con reanudación no aplica.
- **`dashboard.css`** y **el arnés de Selenium** están anotados arriba; ninguno bloquea.
