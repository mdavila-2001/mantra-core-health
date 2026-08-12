# Lo que el frontend espera del backend

**Actualizado:** 2026-08-12 · **Hay un pendiente abierto y es bloqueante: [P14](#abierto--p14--el-autorregistro-de-paciente-devuelve-500-la-base-no-tiene-las-columnas-del-nombre).**
P6 a P13 siguen cerrados y comprobados **contra la API viva** en `localhost:3000`, con la imagen
reconstruida — no leyendo el código.

| | Cómo se cerró |
| --- | --- |
| **P6** alta administrativa de profesional | construido · `POST /iam/users/assisted-practitioner-registration` |
| **P7 · P8** catálogos y sus bindings | **ya estaban resueltos**; el sondeo anterior usó identificadores equivocados |
| **P9** fusión reversible más tarde | construido · `GET /profiles/patients/merge-events` |
| **P10** colecciones de `iam`/`directory` | **ya estaban resueltas** (PR #38) |
| **P11** cita clínica en la reserva | construido · expuesta en las dos lecturas |
| **P12** perfil profesional de la sesión | construido · claim `hpid` |
| **P13** nada creaba citas clínicas | construido · las crea la confirmación de la reserva |

Dos de los siete no eran defectos sino **errores de comprobación míos**, y quedan anotados como tales:
un 404 pedido con el identificador equivocado no prueba que algo no exista.

Este archivo existe para no reconstruir de memoria qué falta. Lo resuelto queda anotado igual: saber
que algo dejó de ser un problema es tan útil como saber que lo sigue siendo.

---

## Abierto · P14 · El autorregistro de paciente devuelve 500: la base no tiene las columnas del nombre

**Levantado el 2026-08-12** contra la API viva, preparando el entorno del viernes.
**Bloquea el paso 1 del guion del consumidor**, que es la única puerta de entrada de quien
prueba el producto sin que nadie lo acompañe.

```
POST /iam/auth/register-patient
→ 500  {"code":"INTERNAL","message":"Error interno del servidor"}

Log de la API (reqId 527):
InvalidFieldNameException: column "name" of relation "persons" does not exist
```

**La causa es deriva de las cuatro capas.** El cambio del «nombre en cuatro partes» se hizo en
la API y en el frontend, pero **nunca llegó a `SQL/` ni a la base**:

| Capa | Qué dice |
| --- | --- |
| DTO / API | escribe `name`, `middleName`, `lastName`, `motherLastName` |
| Frontend | los pide en el formulario y los manda (PR #41) |
| **`SQL/05_profiles/02_tables.sql`** | **sólo declara `display_name`** |
| **Base viva** | `information_schema` confirma: en `profiles.persons` la única columna de nombre es `display_name` |

Comprobación directa contra la base:

```sql
select column_name from information_schema.columns
where table_schema='profiles' and table_name='persons'
  and column_name in ('name','middle_name','last_name','mother_last_name','display_name');
-- (1 row)  display_name
```

**Por qué no lo vio nadie hasta ahora** — y esto importa más que el defecto:

- Las **1 639 pruebas del frontend** pasan porque `HttpTestingController` finge la respuesta:
  ninguna toca la base.
- El **CI de la API está rojo por lint desde el 2026-08-11**, y con él **los 20 pasos siguientes
  del pipeline están saltados**, incluidas las pruebas que habrían tocado esto. Es exactamente lo
  que la tarea D2 del plan advierte: «hoy nadie sabe si la API pasa sus pruebas».
- **`seed:dev` no lo detecta**: crea pacientes por la vía administrativa, no por el autorregistro.
  Su corrida da 524/524 conformes y aun así este camino está roto.

**Qué haría falta** (no se hizo acá: toca el modelo y sus generadores, no el frontend): declarar
las columnas en el `.puml` de `profiles`, regenerar `SQL/` con `gen_ddl.py`, y materializarlas en
la base. La regla del proyecto es explícita — `SQL/` **no se edita a mano**, se regenera.

> **Nota de método:** el `smoke` **borra el administrador de arranque**, así que la secuencia de
> J2 no es de dos pasos sino de tres: `yarn smoke` → `yarn postman:bootstrap` → `yarn seed:dev`.
> Sin el del medio, `seed:dev` muere en su primera llamada con `401 UNAUTHENTICATED` y siembra cero.

---

## Resuelto · P6 · El alta de un profesional por un administrador ya existe

**Levantado el 2026-08-04 desde J3 · cerrado el 2026-08-11** · `POST /iam/users/assisted-practitioner-registration`, `@Roles('SECURITY_ADMIN')`.

Se construyó como se había pedido: **equivalente a `assisted-registration` pero para profesionales**. Comparte transacción e invariantes con el autorregistro —el registro CTI atómico de la regla 11— porque es la misma alta; se parametrizó en vez de duplicarse.

| | Autorregistro | Alta administrativa |
| --- | --- | --- |
| Autorización | `@Public()`, 10/min | `SECURITY_ADMIN` |
| Contraseña | la fija el titular | **no se manda**: token de activación de un solo uso |
| Estado de la cuenta | `ACTIVE` | `PENDING` con `mustChangePassword` |
| Trazabilidad | — | `reason` obligatorio (C-18) |
| Matrícula | `PENDING` | `PENDING` — registrar no habilita a ejercer |

Verificado en vivo: 201 con `activationToken`, su caducidad y `verificationStatus: PENDING`.

---

## Resuelto · P7 y P8 · Los campos de catálogo ya tienen catálogo, y se sabe cuál

**Levantados el 2026-08-08 · cerrados por el PR `#38`** · Se daban por abiertos y **no lo estaban**:
la comprobación del 2026-08-11 los encontró funcionando. Queda anotado el error de sondeo porque
volver a levantarlos costaría el mismo tiempo dos veces.

`DYNAMIC_ENUM_CATALOG` declara las enumeraciones bien conocidas —entre ellas `administrative-gender`
y `sex-at-birth`, que eran justo las que faltaban— y `DynamicEnumSeedService` las materializa con
uuid5 deterministas.

| Comprobación en vivo | Resultado |
| --- | --- |
| `GET /terminology/value-sets?code=administrative-gender` | 200, con su conjunto |
| `GET /system-context/dynamic-enums?target=profiles.persons.administrative_gender_concept_id` | 200, **4 opciones** con su `display` |
| `GET /system-context/dynamic-enums/bindings` | 200, **45 bindings** registrados |

> **Por qué parecían abiertos.** El primer sondeo usó `?code=ADMINISTRATIVE_GENDER` —el código real es
> `administrative-gender`, en minúscula y con guion— y `profiles.person_profiles.…` como target,
> cuando la tabla es `profiles.persons`. Los dos devolvieron vacío y 404, que se leyeron como
> «no existe». **Un 404 con el identificador equivocado no prueba nada**, y conviene recordarlo.

Lo que **sí** sigue pendiente es consumirlos: el alta de paciente sigue sin los selectores de género
y sexo al nacer. No es un bloqueo de backend — es trabajo de front que ya tiene contra qué
construirse (IT3 del plan).

---

## Resuelto · P9 · Una fusión ya no es irreversible al cerrar la pantalla

**Levantado el 2026-08-08 · cerrado el 2026-08-11** · `GET /profiles/patients/merge-events`, `SECURITY_ADMIN`.

`reverse` exige el `eventId` y ese identificador **sólo existía en la respuesta del POST que lo creaba**: al salir de la pantalla, unir dos historias clínicas dejaba de tener vuelta atrás. Quien se diera cuenta del error al día siguiente no tenía camino.

El filtro por paciente busca en **los dos lados** de la fusión: quien revisa un registro no sabe si el que mira sobrevivió o fue el absorbido.

Consumido de este lado: `ProfilesClient.listMergeEvents`. Y el aviso de la pantalla de fusión —que decía que al salir se perdía el camino de vuelta— dejó de decirlo, porque ya no es cierto.

---

## Resuelto · P10 · `iam` y `directory` ya tienen lecturas de colección

**Levantado el 2026-08-08 · cerrado por el PR `#38`** · Comprobado en vivo el 2026-08-11:
`GET /iam/users` → 200 y `GET /admin/tenants` → 200.

Siguen sin lectura de colección `delegated_access` y `auth_providers`, que el original nombraba
junto a estos dos. No bloquean el recorrido de la demo.

### Una corrección al plan de la semana, que sigue vigente

El `PLAN-SEMANA-WEB-Y-MOVIL.md` cuenta a **`common`** entre los módulos «con lectura» (1 `GET`).
Ese `GET` es `/common/files/:id/content` — **una descarga de archivo, no un listado**.

---

## Resuelto · P11 · El encuentro ya se puede vincular al turno que lo originó

**Levantado el 2026-08-10 desde P1 · cerrado el mismo día** · PR `mantra-core-health-api#42`.

El dato existía en la entidad y no salía por ninguna lectura: `BookingItemDto` no exponía
`appointmentId`, así que el portal no podía decirle al check-in de qué turno venía el encuentro.
Ahora lo exponen **las dos** lecturas de reserva —el listado y el detalle—, porque si sólo lo trajera
una, el detalle contradiría a la fila que lo abrió.

Consumido de este lado: la agenda lo lleva al expediente en `?cita=`, y el check-in lo manda como
`appointmentId`. Viaja `null` con normalidad y entonces el parámetro no se agrega.

> ⚠️ **Queda un pendiente distinto, y es de dominio — ver P13.** El vínculo está tendido de punta a
> punta, pero hoy no se llena nunca.

---

## Resuelto · P12 · La sesión ya sabe cuál es su perfil profesional

**Levantado el 2026-08-10 desde P1 · cerrado el mismo día** · PR `mantra-core-health-api#42`.

Se resolvió con el **claim `hpid`**, simétrico del `pid` de paciente que ya existía, y por la misma
cadena sobre la otra tabla de perfil. Es lo más barato: no agrega una petición a cada arranque de
sesión, y no había ninguna lectura que devolviera el dato —el controlador de profesionales sólo
expone `POST`—.

Como `pid`, **no es una credencial**: quién puede ver una agenda lo siguen decidiendo `roles` y el
tenant del request. Se omite en toda cuenta sin perfil profesional, y convive con `pid` cuando quien
atiende es además paciente de la casa.

Consumido de este lado: la agenda se abre en la del profesional que entró —cruzando `hpid` con el
`resourceRefId` del recurso— y lo dice en el campo, porque una agenda ajena y la propia se ven igual.
El recurso de la URL sigue mandando, para que un enlace compartido abra lo que dice.

### Un detalle que apareció al verificarlo

El `resourceRefType` **no coincide entre el contrato y los datos**: el DTO ejemplifica
`health_practitioner_profiles` —el nombre real de la tabla— y los 15 recursos sembrados traen
`practitioner_profiles`. El frontend acepta los dos y lo dice en el código. Conviene unificarlo del
lado de los seeds, pero no bloquea nada.

---

## Resuelto · P13 · La confirmación de una reserva ya crea su cita clínica

**Levantado el 2026-08-11 al verificar P11 · cerrado el mismo día.**

`clinical.appointments` tenía 0 filas y nada la escribía, así que el vínculo de P11 iba a estar siempre vacío. Ahora la confirmación de una reserva crea la cita y la enlaza.

**Al confirmar y no en el check-in**, de las tres opciones que se habían planteado: una cita *es* el turno visto desde lo clínico; el registro de que alguien llegó es el encuentro, que es otra tabla. Crearla en el check-in la haría nacer después del encuentro que la referencia.

El profesional de la cita sale del recurso, pero sólo si el recurso es de un profesional: copiar el id de una sala sería una clave foránea rota.

> **Un defecto que sólo apareció ejecutando:** la primera confirmación contra la base real dio `422 fk_appointment_bookings_appointment_id`. Crear la entidad no basta — hay que `flush` antes de referenciarla, porque `appointment_id` es una columna uuid plana. Ninguna prueba con dobles lo veía.

Verificado en la base: 1 cita clínica, 1 reserva enlazada, 1 encuentro atado, donde antes había 0.

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
