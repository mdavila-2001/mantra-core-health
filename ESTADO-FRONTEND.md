# Estado del frontend

Foto de la rama al **2026-08-01**. Sirve para orientarse antes de revisar el código y para saber
qué falta. Se actualiza cuando cambia el estado, no en cada commit.

---

## En una línea

**La aplicación se usa de punta a punta.** Se entra con una cuenta real, la sesión sobrevive a
recargar, se sale —y el cierre revoca de verdad del lado del servidor—, y todo lo que se ve viene de
la API: nada está simulado. **772 pruebas en verde sobre 65 archivos**, `yarn build` con SSR y
prerender en verde, y **21 pasos verificados en un navegador real** contra la API viva (el recorrido
está al final).

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
| J3 | 16 | Interceptor de autenticación con refresco único |
| — | 13 | `ControlValueAccessor` en `radio-group` y `switch` |
| **J4** | **17** | **Traducción de los errores de la API a los estados del M34** |
| **J8** | — | **`AuthService`, guards de ruta y sesión que sobrevive a la recarga** |
| **J9** | — | **Login, elección de organización y recuperación de contraseña** |
| **—** | **10** | **El armazón pasa a cajón en móvil** |
| **—** | — | **Panel de inicio: se fue el boilerplate de Angular** |

**J0** (tarjeta 3) también está hecha, pero no toca este repositorio: es `ORM_SCHEMA_SYNC=off` en el
`.env` local de la API.

---

## Lo que se cerró en esta sesión

### La pantalla de inicio era la de Angular

Hasta hoy, `/` mostraba el logo de Angular, «Congratulations! Your app is running 🎉» y seis enlaces
a `angular.dev`. Era, literalmente, la primera pantalla de la aplicación. Y `/auth` era
`<p>auth works!</p>`.

Ahora las rutas son tres áreas y la diferencia entre ellas es qué guard las cubre:

```text
/auth/login          pública    ingresar
/auth/organizacion   pública    elegir organización, si el token trae más de una
/auth/recuperar      pública    pedir el enlace de restablecimiento
/auth/restablecer    pública    consumir el enlace del correo
/design-system       abierta    la vitrina, a propósito sin sesión
/panel               con sesión el panel, dentro del armazón
```

### J4 · La tarjeta 17 no estaba bloqueada

Figuraba «bloqueada por el backend, esperando el catálogo de formas reales de error». **El catálogo
existe desde hace tiempo**: `src/common/errors/error-codes.ts` en el repo de la API declara un enum
de **doce códigos estables**, y `AllExceptionsFilter` garantiza que *toda* respuesta de error salga
con la misma envoltura. El comentario del propio enum lo declara contrato:

> «Son parte del contrato de la API: el cliente puede ramificar sobre `error.code` sin parsear
> mensajes, que están pensados para humanos y pueden cambiar de redacción o idioma.»

Se verificó además contra la API viva, no sólo leyendo el código:

```text
POST /iam/auth/login  {}                    -> 400 VALIDATION_FAILED + details.violations[]
POST /iam/auth/login  {credenciales malas}  -> 401 UNAUTHENTICATED
```

Así que `core/http/api-error.ts` ramifica sobre `code`, nunca sobre `message`. Los ocho de los nueve
casos que la tarjeta enumeraba están cubiertos y probados.

**Y el noveno se cerró mientras esto se escribía.** Los dos 403 salían con el mismo
`code: 'FORBIDDEN'` y sólo los separaba el texto del mensaje, así que acá vivía una heurística sobre
frases, aislada en una constante con nombre propio para poder borrarla el día que llegara un código
estable. Ese día fue el mismo: `VerifiedIdentityGuard` ahora emite
`IDENTITY_VERIFICATION_REQUIRED` y un `details.reason` con el subcaso. **La heurística se borró.**

El `reason` se conserva aunque hoy los tres subcasos lleven casi al mismo lugar, porque uno no es
igual a los otros dos: `no-person-linked` es una cuenta sin persona asociada, y ahí el trámite de
verificación **no se ofrece** — mandar a alguien a verificar una identidad que todavía no está
vinculada es un callejón con cartel de salida.

### J8 · Sesión que sobrevive a la recarga

`AuthService` envuelve a `SessionStore` **sin cambiarlo**, tal como su comentario anticipaba.

El access token **no se guarda**: vive minutos y guardarlo sólo agranda la ventana en la que un XSS
se lo lleva. El refresh token sí, porque sin él «recargar la página» sería «volver a escribir la
contraseña», y eso enseña a no recargar nunca.

De ahí sale la regla que gobierna los guards:

> Nadie puede preguntar «¿hay sesión?» antes de que la restauración termine.

Al recargar hay un refresh token guardado y **una petición en camino** que lo cambia por un par
nuevo. Un guard que leyera el estado en el primer turno vería `null` y echaría al login a alguien
que sí tenía sesión: un cierre espontáneo en cada F5, y encima intermitente, porque dependería de si
la petición llegó a tiempo. Por eso los tres guards hacen `await auth.ensureRestored()` antes de
mirar nada, y esa promesa es una sola compartida.

**El cierre de sesión revoca del lado del servidor.** `POST /iam/auth/logout` existe desde hoy, así
que `logout()` lo llama: borrar sólo el almacenamiento local escondía la credencial pero dejaba el
refresh token robado sirviendo los 30 días que dura. La petición sale antes de limpiar —necesita el
token— pero el estado local se borra sin esperar la respuesta **y también si falla**: que la red se
caiga no puede dejar la sesión abierta en una máquina que alguien quiso abandonar. Verificado en el
navegador: tras cerrar sesión, reusar el refresh token contra la API devuelve 401.

**El nombre y las organizaciones ya no son uuid.** El token trae `name` y `tenantNames`, así que el
encabezado dice «Administrador Postman» en vez de «Usuario dc0c455f», y la elección de organización
—que era la única pantalla del sistema donde había que decidir entre identificadores— muestra
nombres. Si un id no está en el mapa se cae al identificador acortado: una entrada fea es mejor que
una en blanco.

Dos cosas que se arreglaron de paso:

- **`TokenRefreshService` no persistía la rotación.** `POST /iam/auth/token/refresh` rota el par
  completo; sin reescribir lo guardado quedaba un token muerto en `localStorage` y la recarga
  siguiente terminaba en el login.
- **La ruta de login estaba en dos lugares** con valores distintos (`/auth` en el interceptor). Hoy
  siguen siendo dos constantes —el interceptor no debe depender de la capa de guards— pero hay una
  prueba que falla si se separan.

### J9 · Login

**El identificador se elige, no se adivina.** La API acepta correo **o** documento, y
`LoginCredentials` es una unión discriminada porque mandar los dos es un 400. Se podría inferir cuál
es cuál mirando si el texto tiene arroba, y sería un error: un documento mal tipeado con arroba se
mandaría como correo, la API diría «credenciales inválidas» y la persona no tendría cómo entender
por qué. Dos radios cuestan un clic y eliminan la clase entera de problema.

**Los mensajes de error son los de la API.** La pantalla no redacta ninguno propio: un «usuario o
contraseña incorrectos» escrito acá se desincroniza del backend en cuanto cambie una regla.

**El `?volverA=` se valida.** Sólo rutas internas que empiecen con una barra —y `//` se rechaza,
porque el navegador lo lee como URL con el protocolo actual—. Sin eso, un enlace con
`?volverA=https://sitio-ajeno.example` convierte el login en un redirector abierto: se lo manda por
correo, la persona entra con sus credenciales de verdad y termina en una copia del login que le pide
volver a escribirlas.

### J9 · Recuperación de contraseña

Los diseños siempre tuvieron «¿Olvidó su clave?» y hasta hoy no había endpoint detrás. **Ahora sí lo
hay** —lo agregó Pablo mientras esto se escribía— así que las dos pantallas existen y el enlace
apunta a algo real.

La pantalla de solicitud **no interpreta el resultado**. El backend responde 202 y el mismo mensaje
siempre, exista o no la cuenta, porque un «no encontramos esa dirección» convertiría un formulario
público en un oráculo de qué personas tienen cuenta en una plataforma de salud. La pantalla muestra
ese mensaje y deja de preguntar; hay una prueba que verifica que el texto renderizado no contenga
«no existe», «no encontramos» ni «no está registrado».

El contenedor de la API ya se reconstruyó, así que las dos rutas están vivas: pedir el enlace
devuelve 202 y esconde el formulario, verificado en el navegador contra la API real.

### Tarjeta 10 · El armazón en móvil

`Shell` recibe `drawerMode` como entrada —su documentación lo dice: «lo decide quien monta el shell,
que es quien conoce el ancho real»— y **nadie se lo estaba pasando**. En un teléfono el nav se
quedaba como columna fija de 260 px que empujaba el contenido fuera de la pantalla.

El CSS ya tenía todo resuelto (`@media (min-width: 780px)` en `shell.css` y `side-nav.css`); lo que
faltaba era el booleano, porque de él depende algo que una hoja de estilos no puede hacer: **mostrar
u ocultar el botón de menú del encabezado**, que es un nodo del árbol y no un estilo.
`core/layout/breakpoints.ts` lo resuelve, y una prueba fija el 780 para que no se separe del CSS.

De paso: el panel de avisos de desarrollo se corría al borde superior izquierdo en móvil, que es
exactamente donde quedó el botón de menú. Lo tapaba, y con eso la aplicación se quedaba sin forma de
abrir la navegación.

### El panel de inicio

Dos tarjetas, y las dos dicen algo cierto y verificable en el momento:

1. **La sesión** —identificador, roles, organización activa— tal como el token la declara. Sin
   ninguna petición: la API no expone `/me` y no hace falta.
2. **Una lectura real** de `GET /public/directory`, que cruza el proxy, el interceptor y la
   traducción de errores, y se pinta con `app-view-state-host`. Es la prueba de punta a punta de que
   el frontend habla con el backend, y se eligió esa ruta porque es la única `@Public()` que
   devuelve una proyección: no transporta ningún dato clínico.

---

## Dos decisiones de arquitectura que conviene conocer antes de tocar rutas

**Lo que tiene sesión no se puede prerenderizar.** La sesión vive en el navegador y el servidor no la
ve: la API entrega el refresh token en el cuerpo del login, no como cookie. Prerenderizar una
pantalla con sesión produce HTML de «no autenticado» que al hidratar se reemplaza por el real —un
parpadeo en el mejor caso, y un `<main>` vacío servido como contenido en el peor—. Por eso el área
con sesión va en `RenderMode.Client` y sólo el login y la vitrina se prerenderizan, que es
justamente donde el SSR paga.

**Ninguna pantalla se importa directamente.** Todas van diferidas. La vitrina sola pesa unos 900 kB
porque instancia el sistema de diseño entero, y nunca se descarga si nadie la abre.

---

## Lo que falta

**Nada bloqueado por el backend.** Los cuatro huecos que este documento anotaba —los dos 403
indistinguibles, la falta de ruta de cierre de sesión, el token sin nombre y los tenants sin nombre
legible— se cerraron esa misma madrugada y están verificados contra la API viva. El detalle, con la
forma exacta de cada respuesta, en `PENDIENTES-BACKEND.md`.

Con eso llegó también el `$expand` de lectura, así que **`data-access/terminology/` ya tiene
cliente**: `readExpansion` para una página y `readAllOptions` para la lista entera de un desplegable.
Paginado por cursor, comprobado de punta a punta a través del proxy.

**Sin dueño** desde que Ender e Itzan no se incorporan: tarjetas 11 (`vitest.config.ts` y umbrales de
coverage), 14 (escalar al diseñador la divergencia de variantes de botón), 22 (pantalla de
verificación de identidad — la ruta ya está reservada en `IDENTITY_VERIFICATION_ROUTE`) y 23 (altas
administrativas). Las tarjetas 10 y 13 ya se hicieron.

**Lo próximo natural** es la tarjeta 22: el 403 «puerta» ya ofrece «Verificar mi identidad» y hoy ese
enlace apunta a una ruta que todavía no existe.

---

## Cómo levantar todo y qué mirar

```bash
# Almacenes. Nunca el servicio `api` del compose: arranca con DDL propio.
docker compose up -d postgres mongodb redis opensearch minio

corepack yarn start          # API, en su repo, puerto 3000
corepack yarn start          # frontend, acá, puerto 4200
```

`yarn` puede no estar en el `PATH`; con **`corepack yarn <script>`** funciona igual.

**Cuenta de demostración.** Desde que la API tiene el seed de arranque, se siembra sola: alcanza con
levantarla con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` definidas. `yarn
postman:bootstrap` sigue existiendo como disparador manual del mismo seed.

```text
admin@redesa.test / S3cret-passw0rd
```

Verificada contra la API viva: devuelve 200 con roles `SECURITY_ADMIN` y `SUPERADMIN` y un tenant.

### El recorrido que se verificó en un navegador real

No con mocks: con esa cuenta, contra la API de verdad, los 17 pasos en verde.

```text
sin sesión, /panel manda al login (y recuerda a dónde iba)
credenciales malas muestran el mensaje real de la API
la credencial real entra al panel
el encabezado muestra el nombre real del token, no el uuid
el panel muestra roles, identificador y organización del token
el directorio público se leyó de la API y se pintó con su estado del M34
el armazón trae navegación y enlace de salto
recargar NO cierra la sesión
con sesión abierta, /auth/login rebota al panel
la vitrina sigue funcionando (26 secciones)
cerrar sesión llama a POST /iam/auth/logout
el refresh token queda revocado en el servidor (reusarlo da 401)
cerrar sesión vuelve al login y borra el refresh token guardado
tras cerrar sesión, /panel vuelve a pedir credenciales
el login lleva a recuperar la contraseña
pedir el enlace funciona contra la API (202) y esconde el formulario
restablecer sin token explica y ofrece pedir otro, sin mostrar el formulario
restablecer con token muestra el formulario y NO expone el token
```

---

## Cosas a tener en cuenta

### El repo no fija el modo de instalación de Yarn

No hay `.yarnrc.yml`, así que Yarn 4 instala en **modo PnP**: no crea `node_modules`, crea
`.pnp.cjs`, `.pnp.loader.mjs` y `.yarn/unplugged/`. Funciona —build y pruebas pasan—, y esta rama
agregó esos patrones al `.gitignore` y sacó `install-state.gz` del índice.

Pero **la decisión de fondo sigue abierta y es del equipo**: el repo de la API sí tiene `.yarnrc.yml`
con `nodeLinker: node-modules`, así que hoy los dos repositorios instalan distinto. Conviene que sea
una decisión y no un accidente. Vite además avisa en cada corrida que PnP está desaconsejado.

### Si trabajás en Windows

Con `core.autocrlf=true` (el default de Git for Windows) conviene ponerlo en `input` en cada repo:
en el de la API el CRLF rompe los scripts `.sh` que corren dentro de los contenedores, y
`git status` sale limpio igual, así que no hay ninguna señal.
