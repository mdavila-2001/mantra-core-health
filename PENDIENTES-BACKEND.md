# Lo que el frontend espera del backend

**Actualizado:** 2026-08-04 · Verificado ejecutando contra la API viva en `localhost:3000` —con la
cuenta del bootstrap— y con 84 comprobaciones de punta a punta con Selenium, del navegador al proxy
y del proxy a la API.

Existe para no reconstruir de memoria qué falta. Lo resuelto queda anotado igual: saber que algo dejó
de ser un problema es tan útil como saber que lo sigue siendo.

---

## Abierto · P6 · Falta el endpoint de administrador para dar de alta a un profesional

**Levantado el 2026-08-04 desde J3** (altas administrativas, tarjeta 23) · **Para:** Marcelo
(modelo) y Pablo (API) · **Bloquea:** el tercer formulario de J3, y nada más.

J3 pedía tres altas para `SECURITY_ADMIN`: usuario, paciente y médico. Las dos primeras están
construidas y verificadas. **La tercera no tiene endpoint contra el cual construirse.**

| Alta | Endpoint | Autorización | Estado |
| --- | --- | --- | --- |
| Usuario | `POST /iam/users` | `@Roles('SECURITY_ADMIN')` | ✅ construida |
| Paciente (asistida) | `POST /iam/users/assisted-registration` | `@Roles('CLINICIAN','SECURITY_ADMIN')` | ✅ construida |
| **Profesional** | `POST /iam/auth/register-practitioner` | **`@Public()`** | ❌ no es de administrador |

### Por qué no se construyó sobre el endpoint público

No es una objeción de estilo: el propio modelo lo declara al revés.

1. **El DTO lo dice textual.** `register-practitioner.dto.ts`: «El profesional se da de alta **él
   mismo**, sin que un administrador lo cree». Construir una pantalla de administrador encima sería
   contradecir el contrato en el mismo archivo que lo define.
2. **El límite de peticiones es de superficie pública.** `@Throttle({ limit: 10, ttl: 60_000 })`,
   pensado para frenar automatización contra un formulario abierto — no para que una organización
   cargue su plantel.
3. **La contraseña la teclearía el administrador.** El alta asistida de paciente ya resolvió esto
   bien: devuelve un token de activación de un solo uso y la clave la elige el titular. El alta de
   profesional por administrador debería seguir ese camino, no el del autorregistro.

### Qué haría falta

Un endpoint autenticado, equivalente a `assisted-registration` pero para profesionales:

```text
POST /iam/users/assisted-practitioner-registration      (nombre a definir)
@Roles('SECURITY_ADMIN')
```

- **Cuerpo:** el de `RegisterPractitionerDto` **menos `password`**, más `reason` — la misma
  trazabilidad C-18 que ya exige el alta asistida de paciente.
- **Respuesta:** la de `RegisterPractitionerResponseDto` más `activationToken` y su caducidad, como
  en `AssistedRegistrationResponseDto`.
- **Invariante a respetar:** registro CTI atómico (regla 11 de la v4.0.7) — cuenta, persona, perfil
  profesional y licencia en la misma transacción, como ya hace el autorregistro.
- La licencia debe seguir naciendo `PENDING`: registrarse no habilita a ejercer, y eso no cambia
  porque lo cargue un administrador.

### Qué queda listo de este lado

Cuando exista, el trabajo del frontend es chico: los tipos ya están (`PractitionerRegistration` +
`AssistedRegistrationResult`), `features/admin/assisted-registration/` es el molde exacto, y pasar
la sección de `planificada` a `disponible` en `core/navigation/navigation.map.ts` es una línea.

### Nota aparte: la orquestación de J3 no hacía falta

El plan preveía «compuestas: perfil → cuenta → vínculo … orden fijo, idempotencia por intento,
estado *perfil sin cuenta* visible y reanudable» (decisión D3). **El backend ya lo resuelve
atómicamente:** las dos altas construidas son una sola petición y el modelo prohíbe el estado
intermedio. Encadenar llamadas desde el frontend habría reintroducido exactamente el estado que el
modelo declara imposible. Lo que sí se implementó es la protección contra el **doble envío**, que
es el duplicado que sí puede ocurrir. Conviene actualizar D3 en el plan.

---

## Resuelto en esta sesión · las violaciones de validación no se leían

**No era del backend: era nuestro, y llevaba semanas.** Este archivo ya lo documentaba —ver la
línea del catálogo de errores, `400 VALIDATION_FAILED + details.violations[]`— pero
`core/http/error-to-view-state.ts` leía `details.messages`, una clave que la API no emite.

Consecuencia: **ningún mensaje de validación por campo llegó nunca a una pantalla**. Todo `400` se
veía como el genérico «Error de validación», en toda la aplicación. La prueba que cubría ese camino
no lo detectaba porque fabricaba su propio cuerpo con la clave equivocada.

Corregido leyendo `violations` (con `messages` de reserva) y con una prueba cuyo cuerpo está copiado
literal de la respuesta real de `POST /iam/users/assisted-registration` sin `reason`.

---

## Resuelto — ya no bloquea

**El esquema de la base.** Era el bloqueo más grande del proyecto. El commit `41206d2` versionó el
DDL: `apply_all.sql` + 350 archivos SQL + 23 de NoSQL.

**`dev` volvió a compilar.** Tres commits habían entrado con archivos nuevos sin `git add`.

**El compose ya pasa `ORM_SCHEMA_SYNC`** a los contenedores con default `dry-run`.

**Auto-registro de profesionales y de organización**, y el tipo de tenant obligatorio con validación
cruzada — justo lo que hace falta para un formulario condicional.

**El catálogo de errores (P2).** Ver abajo: estaba, y desbloqueó la tarjeta 17 entera menos un punto.

**La recuperación de contraseña.** Llegó, las dos pantallas están escritas y el flujo entero se
verificó contra la base real: pedir el enlace, leerlo, cambiar la clave, entrar con la nueva, y que
la vieja y el token usado dejen de servir.

**Los cuatro pedidos al backend.** Los 403 indistinguibles, la falta de logout, el token sin nombre
y los tenants sin nombre: los cuatro cerrados. Ver abajo.

---

## Lo que quedó resuelto en esta sesión, y cómo

### P2 · El catálogo de errores estaba entregado

Esta lista decía que era «lo único que bloquea» la tarjeta 17. **No lo era.**
`src/common/errors/error-codes.ts` declara un enum de **once códigos estables**, y
`AllExceptionsFilter` homogeneiza *toda* respuesta de error en la misma envoltura. El comentario del
enum lo dice con todas las letras:

> «Son parte del contrato de la API: el cliente puede ramificar sobre `error.code` sin parsear
> mensajes, que están pensados para humanos y pueden cambiar de redacción o idioma.»

Verificado también contra la API corriendo, no sólo leyendo:

```text
POST /iam/auth/login  {}                    -> 400 VALIDATION_FAILED + details.violations[]
POST /iam/auth/login  {credenciales malas}  -> 401 UNAUTHENTICATED
```

La tarjeta 17 está hecha (`core/http/api-error.ts`), con ocho de sus nueve casos cubiertos y
probados contra esos cuerpos reales.

**Una nota de forma que ya se cerró:** `correlationId` estaba declarado `string` en
`ErrorResponseBody` y salía **como número** (`"correlationId": 9451`), porque `pino-http` numera las
peticiones y un cast silenciaba la contradicción. Arreglado en el filtro (PR #25 de la API): ahora
se normaliza a texto ahí, que es donde vive el contrato publicado. De paso quedaron cubiertos el
`x-request-id` repetido —que Express entrega como array— y los `NaN`.

El cliente sigue aceptando el número igual: es una respuesta ajena, y un despliegue viejo detrás de
un proxy no debería costarnos el identificador con el que soporte encuentra el log.

### La recuperación de contraseña llegó

`POST /iam/auth/forgot-password` y `POST /iam/auth/reset-password`, ambos públicos. El enlace
«¿Olvidaste tu contraseña?» del login ya apunta a pantallas reales.

**Está bien resuelto y conviene que quede dicho por qué:** `forgot-password` responde 202 y el mismo
mensaje siempre, exista o no la cuenta. Eso es lo correcto —un «no encontramos ese correo»
convertiría un formulario público en un oráculo de qué personas tienen cuenta en una plataforma de
salud— y el frontend lo respeta: la pantalla muestra ese mensaje y no deduce nada del resultado.

**Ya está vivo.** El contenedor se reconstruyó y las dos rutas responden. Verificado desde el
navegador, a través del proxy: pedir el enlace devuelve 202 y la pantalla esconde el formulario.

---

## Lo que estaba abierto, y cómo quedó

### Los cuatro puntos abiertos se cerraron esta madrugada

Los cuatro estaban bien planteados y los cuatro eran del backend. Están hechos y verificados contra
la API viva, no sólo compilando.

**1. Los dos 403 ya se distinguen por un campo estable.** Era «lo único que bloquea», y con razón:
para la persona son estados opuestos —rol insuficiente es un muro sin salida, identidad sin
verificar es una puerta— y separarlos comparando el texto del mensaje ataba la interfaz a una
redacción que el propio catálogo declara cambiable.

`VerifiedIdentityGuard` ahora lanza `IDENTITY_VERIFICATION_REQUIRED`, un código nuevo del enum, y
además trae `details.reason` para los tres subcasos (`identity-not-verified`, `no-person-linked`,
`no-authenticated-user`). `RolesGuard` sigue con `FORBIDDEN`. Comprobado en la misma corrida, con
un paciente real:

```text
GET  /profiles/patients/me/summary  -> 403 IDENTITY_VERIFICATION_REQUIRED (identity-not-verified)
POST /terminology/value-sets        -> 403 FORBIDDEN
```

**Se puede borrar `FORBIDDEN_IDENTITY_HINTS`** de `core/http/api-error.ts`: era justamente la
constante aislada que esperaba este código.

**2. `POST /iam/auth/logout` existe.** Revoca la sesión del `sid` del token **y su refresh token**,
que era lo que de verdad sobrevivía al cierre. Es idempotente —cerrar algo ya cerrado devuelve
`{revoked: false}` y no falla— y comprueba que la sesión sea de quien la cierra, para que un token
válido no pueda cerrar la sesión de otro nombrando su `sid`. Verificado: tras el logout, reusar el
refresh token devuelve 401.

**3. El token ya trae nombre.** Claim `name`, poblado en el login **y en el refresco** —si sólo lo
pusiera el login, la interfaz perdería el nombre en la primera rotación—. Va en el token y no en un
`/me`: es un campo más de algo que ya se recibe, así que no reintroduce la petición por request que
la ausencia de `/me` evitaba.

**4. Los tenants ya se pueden mostrar por su nombre.** Claim `tenantNames`, un mapa `id -> nombre`.
`tenants` sigue siendo la lista de uuid, porque es lo que valida el interceptor de tenant: esto es
sólo para poder pintarlos. Prefiere el nombre comercial sobre el legal, con el código como último
recurso para que la lista nunca tenga una entrada en blanco.

Ambos claims **se omiten si están vacíos**: viajan en la cabecera de cada petición y un claim vacío
ocupa lugar sin decir nada.

```text
name:        "Administrador Postman"
tenantNames: { "1befcfea-…": "Mantra Core Default Tenant" }
```

### P3 · El `$expand` de value sets — hecho y verificado

Autenticado, **sin exigir rol de administración**, paginado por cursor. El cliente
(`core/data-access/terminology/`) está escrito y probado. Comprobado de punta a punta a través del
proxy: 25 opciones en 3 páginas, sin duplicados ni saltos, cursor corrupto → 400, sin token → 401.

**Un detalle que costó un 404 y conviene no repetir:** el `$` de la ruta va **literal**, no como
`%24`. Express enruta sobre el path sin decodificar, así que `%24expand` no casa con `:id/$expand`.

De paso apareció un fallo de fondo que nadie había visto: **ninguna expansión podía devolver un solo
miembro**. `importConcepts` creaba los conceptos sin estado y la expansión sólo selecciona los
activos, así que todo el camino documentado terminaba en `includedMembers: 0` **sin ningún error**.
Corregido en los dos extremos; ahora importar 25 y publicar da 25.

### P1 · El bootstrap del primer `SECURITY_ADMIN` — hecho y verificado

`BootstrapAdminSeedService` en `src/common/seed/`, corriendo desde el `OnApplicationBootstrap` del
orquestador de seeds, con `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` y
`BOOTSTRAP_ADMIN_ALLOW_PRODUCTION` documentadas en `.env.example`. Se niega en
`NODE_ENV=production` salvo autorización explícita. Verificado en el arranque real: la línea
«Administrador de arranque disponible» sale en el log y el login con esa cuenta devuelve 200.

`yarn postman:bootstrap` pasó a ser un disparador manual del **mismo** servicio, no una segunda
implementación.

### Sigue abierto · P4 · La propuesta de layout de repos se ejecutó en vez de proponerse

El commit `41206d2` versionó el DDL dentro del repo de la API, que es ejecutar la opción (b) de las
tres que había que proponer. El resultado es bueno y desbloqueó el proyecto, así que **no es un
reproche**: es que la decisión era de Marcelo y ahora está tomada de hecho. Si el `SQL/` canónico del
workspace cambia, hay que acordar cómo se sincroniza esa copia — que era justamente el riesgo que la
opción (b) tenía anotado.

### Sigue abierto · P5 · Revisión de los PRs del frontend

Permanente. Pablo es el único par de ojos activo del frontend, y hay trabajo publicado esperando.

---

## Consumido por el frontend

Los cuatro cierres están en uso y verificados contra la API viva, no sólo compilando:

| Entregado | Dónde se usa |
| --- | --- |
| `IDENTITY_VERIFICATION_REQUIRED` + `details.reason` | `core/http/api-error.ts` — la heurística sobre texto **se borró** |
| `POST /iam/auth/logout` | `AuthService.logout()` — tras cerrar sesión, reusar el refresh token da 401 |
| Claim `name` | El encabezado dice «Administrador Postman», no el uuid |
| Claim `tenantNames` | La elección de organización muestra nombres, no identificadores |

**Un matiz sobre el `reason`:** los tres subcasos no llevan al mismo lugar. `identity-not-verified`
y `no-authenticated-user` ofrecen el trámite de verificación; **`no-person-linked` no**, porque
verificar la identidad de una persona que todavía no está vinculada a la cuenta no es algo que quien
mira pueda hacer. Ofrecérselo sería un callejón con cartel de salida.
