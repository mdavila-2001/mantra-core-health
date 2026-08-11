# Lo que el frontend espera del backend

**Actualizado:** 2026-08-11 · Los pendientes hasta P6 se verificaron ejecutando contra la API viva
en `localhost:3000` —con la cuenta del bootstrap— y con 84 comprobaciones de punta a punta con
Selenium. **Los de P7 a P10 no**: se levantaron leyendo los controllers, los DTOs y los seeds, con
Docker apagado. Lo que se afirma de cada uno está verificado sobre el código y los datos sembrados,
no contra el servidor corriendo.

**P11, P12 y P13 sí**, y contra la imagen reconstruida: los dos primeros se cerraron y se
comprobaron en vivo; el tercero apareció justamente al comprobar el primero.

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

## Abierto · P7 · Los campos de catálogo no tienen catálogo

**Levantado el 2026-08-08 desde W1** (vistas de Fase 0) · **Para:** Marcelo (seeds y modelo) ·
**Bloquea:** casi todos los formularios de las 693 vistas, **y el frente móvil**.

Es el pendiente más caro que hay abierto. La regla del modelo es taxativa —todo `*_concept_id` es un
selector poblado desde terminología, nunca entrada libre— y hoy no hay con qué poblarlo.

Contado sobre `seedsGenerales/`:

| | |
| --- | --- |
| Value sets sembrados | **55** (42 con miembros, 208 miembros en total) |
| De qué son | los que agregaron los patches v4.0.2–v4.0.6: `Plan Feature Key`, `Api Key Scope`, `Feedback Status`… |
| De género, sexo, nacionalidad o idioma | **ninguno** |
| `administrative_gender_concept_id` de las personas sembradas | **uno solo** para todas, código `DEFAULT_ADMINISTRATIVE_GENDER` |
| Placeholders `DEFAULT_*` en total | **737** |

Ese concepto se describe a sí mismo como «Configuración de arranque para Terminology; debe revisarse
por tenant y jurisdicción». Es relleno, no un género.

**Es el mismo defecto que el `CLAUDE.md` ya documenta como bloqueador de móvil:**
`iam.devices.platform_concept_id` apunta a `DEFAULT_PLATFORM` porque «no hay conceptos iOS/Android
sembrados». No es un caso del módulo 05: es el patrón general de los 737.

### Qué haría falta

Sembrar los conjuntos de valores de los campos demográficos y clínicos básicos —género
administrativo, sexo al nacer, identidad de género, nacionalidad, idioma, grupo ABO, factor Rh,
estado de cobertura— con sus miembros reales. Es trabajo de `gen_seeds_v407.py` más las notas de
value set en el vault: el mismo procedimiento que el `CLAUDE.md` describe para cerrar el bloqueo de
`DEFAULT_PLATFORM`.

### Qué salió mutilado por esto, ya

El alta de paciente (V05-01·F) va **sin** género administrativo ni sexo al nacer, y las dos
operaciones de fusión van **sin** motivo. Los cuatro campos son opcionales en el contrato, así que
las pantallas funcionan — pero ninguna está completa, y la próxima persona que escriba un formulario
se va a topar con lo mismo.

---

## Abierto · P8 · No hay forma de saber a qué value set se liga cada campo

**Levantado el 2026-08-08 desde W1** · **Para:** Pablo (API) · **Depende de:** P7 · **Bloquea:** lo
mismo que P7.

Aun con los conjuntos sembrados, el frontend no puede encontrarlos:

1. El único `GET` es `…/terminology/value-sets/:id/$expand`, que **pide el uuid** del conjunto. No
   hay búsqueda por código ni por nombre.
2. Los uuid se derivan con `uuid5` en `gen_seeds_v407.py` a partir de `(nombre, patch, módulo)`. Son
   deterministas, pero reimplementar esa derivación en TypeScript acoplaría el frontend a las tripas
   del generador de seeds: se rompería en silencio el día que alguien toque `VS_OWNER`.
3. `…/terminology/concepts?q=` existe y no pide rol, pero busca texto libre sobre los 965 conceptos
   del catálogo. Usarlo como selector de «sexo al nacer» dejaría elegir cualquiera y rompería el
   vínculo que el modelo declara. Es peor que no ofrecer el campo.

### Qué haría falta

Cualquiera de estas dos, en orden de preferencia:

- `GET /terminology/value-sets?binding=profiles.person_profiles.administrative_gender_concept_id` —
  que la API diga a qué conjunto se liga cada columna.
- O un `GET /terminology/value-sets?code=…` que permita resolver el uuid desde un código estable.

**El orden con P7 importa: primero sembrar, después publicar el binding.** Al revés, el selector
mostraría una sola opción sin significado.

---

## Abierto · P9 · Una fusión de pacientes es irreversible en cuanto se cierra la pantalla

**Levantado el 2026-08-08 construyendo V05-01·A** · **Para:** Pablo (API) · **Bloquea:** que
«revertir una fusión» signifique lo que parece.

`POST /profiles/patients/merge/{eventId}/reverse` (UC-05-09) existe y funciona, pero exige el
identificador del evento — y **el backend no expone ningún listado de eventos de fusión**.
Verificado: no hay un solo `@Get` con `merge` en `ProfilesPatientsController`.

Ese identificador aparece **una sola vez**: en la respuesta del `POST` de fusión. En cuanto esa
respuesta se pierde de vista, unir dos historias clínicas deja de tener vuelta atrás desde la
aplicación.

### Qué se hizo mientras tanto

El «Deshacer» vive en la pantalla de resultado de la fusión y advierte con palabras que al salir se
pierde. Es lo único que el contrato permite. Pero quien se dé cuenta del error al día siguiente no
tiene camino de vuelta.

### Qué haría falta

Un `GET /profiles/patients/merge-events` —o el evento embebido en la ficha del paciente
resultante—. Es una lectura simple sobre `profiles.patient_merge_events`, tabla que ya existe.

---

## Abierto · P10 · `iam` y `directory` siguen sin ninguna lectura de colección

**Levantado el 2026-08-08 desde W1** · **Para:** Pablo (API) · **Bloquea:** 23 de las 37 vistas de
Fase 0 del reparto de Justin, y buena parte del de Itzan.

Los `GET` de colección de los PRs #31 y #33 desbloquearon `profiles`, `scheduling`, `clinical`,
`chart` y `terminology`. Siguen en cero: **`iam`**, **`directory`**, `delegated_access` y
`auth_providers`.

### Una corrección al plan de la semana

El `PLAN-SEMANA-WEB-Y-MOVIL.md` cuenta a **`common`** entre los módulos «con lectura» (1 `GET`).
Ese `GET` es `/common/files/:id/content` — **una descarga de archivo, no un listado**. Quien tome
`common` creyendo que puede cerrarlo completo se va a encontrar con eso.

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

## Abierto · P13 · Nada crea citas clínicas, así que el vínculo del turno queda siempre vacío

**Levantado el 2026-08-11 al verificar P11** · **Para:** Marcelo (modelo) y Pablo (API) ·
**Bloquea:** la trazabilidad turno ↔ encuentro **en la práctica**. No bloquea la demo.

P11 abrió la cañería y funciona, pero al probarla apareció que **no hay agua**:

| Comprobación | Resultado |
| --- | --- |
| Filas en `clinical.appointments` | **0** |
| Reservas con `appointment_id` no nulo | **0** |
| Código que escribe en `clinical.appointments` | **ninguno** — no hay repositorio ni servicio |
| Endpoint que cree una cita clínica | **ninguno** |

O sea: `scheduling.appointment_bookings.appointment_id` es una columna que nadie llena. El encuentro
va a quedar sin vincular no por un defecto del portal, sino porque la cita clínica que debería
respaldarlo no se crea en ningún momento.

### La decisión es de dominio, no de código

Y por eso no se resolvió de oficio: hay que definir **cuándo nace una cita clínica**, y son caminos
distintos con consecuencias distintas.

1. **Al confirmar la reserva** — `confirm` crea la cita clínica y la enlaza. Toda reserva confirmada
   queda trazable, pero se crea un registro clínico para turnos que quizá nunca se atiendan.
2. **Al hacer el check-in del encuentro** — la cita se crea recién cuando alguien llega. No ensucia
   con turnos no atendidos, pero entonces la cita nace *después* del encuentro y el vínculo se
   invierte.
3. **Como flujo propio** de `clinical`, independiente de la agenda.

Mientras no se decida, todo funciona: el encuentro se abre igual y el portal trata la ausencia como
lo normal que es.

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
