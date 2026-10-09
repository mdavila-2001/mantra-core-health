# Cambios y problemas corregidos · 11 de agosto de 2026

**Alcance:** el recorrido del médico (P1 del plan del miércoles) y **el cierre de todos los
pendientes abiertos** de `PENDIENTES-BACKEND.md`, en los dos repositorios.

**Estado:** no queda ningún pendiente abierto. Todo comprobado **contra la API viva** en
`localhost:3000` con la imagen reconstruida — no leyendo el código.

| | Antes | Ahora |
| --- | --- | --- |
| Pendientes abiertos | 6 (P6–P10, P13) | **0** |
| Pruebas del frontend | 1622 · **1 en rojo** | **1639 · todas en verde** |
| Pruebas de la API | 4507 | **4524** |
| Operaciones del contrato | 878 | **907** |

---

## 1 · Lo que se construyó

### 1.1 · El recorrido del médico — del turno a la historia y al encuentro

**El hueco real era el enlace, no la agenda.** La agenda ya funcionaba con rol `PRACTITIONER`, pero
el único enlace que ofrecía desde una cita era la ficha de filiación, que pide `SECURITY_ADMIN` — un
rol que quien atiende no tiene. Su agenda terminaba en un callejón.

- La cita ofrece **«Abrir expediente»** hacia `/clinico/:profileId` cuando la sesión es clínica, y
  sigue ofreciendo la ficha cuando es administrativa. Son dos destinos distintos, no dos formas de lo
  mismo.
- El **expediente registra encuentros** (`check-in` y `close`). De todo lo que se puede escribir en
  una historia clínica es lo único cuyo resultado esa misma pantalla vuelve a leer; diagnosticar o
  firmar una nota tienen endpoint pero ninguna lectura los muestra, y serían formularios que tragan
  el dato.
- **La agenda se abre en la del profesional que entró**, cruzando el claim `hpid` con el
  `resourceRefId` del recurso. El recurso de la URL sigue mandando, para que un enlace compartido
  abra lo que dice.

### 1.2 · Los siete pendientes

| | Qué faltaba | Cómo se cerró |
| --- | --- | --- |
| **P6** | El único alta de profesional era `@Public()` con 10 peticiones/min, y su propio DTO decía que «el profesional se da de alta él mismo» | `POST /iam/users/assisted-practitioner-registration` (`SECURITY_ADMIN`). Comparte transacción con el autorregistro —es la misma alta— y se **parametrizó** en vez de duplicarse. Cuenta PENDIENTE con token de activación, `reason` obligatorio (C-18), matrícula `PENDING` |
| **P7 · P8** | Los campos de catálogo no tenían catálogo ni forma de encontrarlo | **Ya estaban resueltos.** Ver §3 |
| **P9** | `reverse` exige un `eventId` que sólo vivía en la respuesta del POST: al cerrar la pantalla, una fusión dejaba de tener vuelta atrás | `GET /profiles/patients/merge-events`. El filtro por paciente busca en **los dos lados** de la fusión |
| **P10** | `iam` y `directory` sin lecturas de colección | **Ya estaban resueltas** (PR #38) |
| **P11** | `BookingItemDto` no exponía `appointmentId`, así que un encuentro no podía decir de qué turno venía | Expuesto en **las dos** lecturas de reserva. Si sólo lo trajera una, el detalle contradiría a la fila que lo abrió |
| **P12** | La sesión no conocía su perfil profesional, así que la agenda caía en el primer recurso —el de otro— | Claim **`hpid`**, simétrico del `pid` de paciente. Firmado en login **y refresco**: un claim que no sobrevive a la renovación desaparece a los 15 minutos |
| **P13** | `clinical.appointments` tenía **0 filas** y nada la escribía: el vínculo de P11 iba a estar siempre vacío | La confirmación de una reserva crea su cita clínica y la enlaza |

**Sobre P13, la decisión de dominio:** la cita se crea **al confirmar**, no en el check-in. Una cita
*es* el turno visto desde lo clínico; el registro de que alguien llegó es el encuentro, que es otra
tabla. Crearla en el check-in la haría nacer *después* del encuentro que la referencia.

---

## 2 · Defectos encontrados y corregidos

Ninguno de estos estaba en la lista de pendientes. Aparecieron trabajando.

### 2.1 · El sello del titular decía «Desconocido» sobre su propio trámite · **bug de producción**

`identity-verification.ts` llamaba a `toCaseStatusPresentation()` pero **no inyectaba
`CaseStatusCatalog`**. Sin esa inyección nadie llenaba el catálogo, así que el estado del caso se
mostraba como «Desconocido» en vez de «Aprobado». Todas las demás pantallas con sello sí lo
inyectaban; ésta —la que mira la persona sobre su propio trámite, el Acto 3 de la demo— era la única
que no.

Lo estaba reportando una prueba en rojo que llevaba tiempo así. **La prueba tenía razón.**

### 2.2 · La reserva confirmada violaba una clave foránea · **sólo visible ejecutando**

La primera confirmación contra la base real respondió `422
fk_appointment_bookings_appointment_id`: crear la entidad de la cita no basta, hay que `flush` antes
de que la reserva la referencie, porque `appointment_id` es una columna uuid plana y no una relación
gestionada. **Ninguna prueba con dobles lo veía** — es el patrón «FK planas: persistir el padre antes
de los hijos» que el resto del módulo ya respetaba.

### 2.3 · Un aviso que había dejado de ser cierto

La pantalla de fusión advertía que al salir la operación «deja de ser reversible». Era verdad cuando
se escribió y dejó de serlo con P9. Se corrigió: asustar con un límite que el sistema ya no tiene es
tan malo como callar uno que sí tiene.

### 2.4 · El contrato OpenAPI estaba desfasado y bloqueaba CI

La puerta de documentación exige que los artefactos generados estén versionados y al día. Estaban
desfasados por dos motivos acumulados: los endpoints nuevos de este trabajo, **y el PR #41 (nombres
en cuatro partes), que entró a `dev` sin regenerar el contrato**. Ese desfase se arrastraba a todo PR
posterior. Regenerado: 886 paths · 907 operaciones · 930 esquemas.

### 2.5 · `resourceRefType` dice dos cosas distintas

El DTO de agenda ejemplifica `health_practitioner_profiles` —el nombre real de la tabla— y los 15
recursos sembrados traen `practitioner_profiles`. Se aceptan **los dos**, dicho en el código, en el
frontend y en el backend: aceptar sólo el del contrato no encontraría nada contra los datos de hoy;
aceptar sólo el de los datos rompería el día que se corrijan los seeds. El fallo es benigno en ambos
sentidos. **Conviene unificar los seeds.**

---

## 3 · Dos pendientes que no lo eran, y por qué lo parecían

**P7, P8 y P10 ya estaban resueltos.** El sondeo que los dio por abiertos usó identificadores
equivocados:

| Se pidió | Es | Resultado engañoso |
| --- | --- | --- |
| `?code=ADMINISTRATIVE_GENDER` | `administrative-gender`, minúscula y con guion | lista vacía |
| `?target=profiles.person_profiles.…` | la tabla es `profiles.persons` | 404 |

Los dos se leyeron como «no existe». **Un 404 pedido con el identificador equivocado no prueba
nada**, y queda anotado porque volver a levantarlos costaría el mismo tiempo dos veces.

Lo que sí sigue pendiente de P7/P8 es **consumirlos**: el alta de paciente sigue sin los selectores
de género y sexo al nacer. No es un bloqueo de backend — es trabajo de front que ya tiene contra qué
construirse (IT3 del plan).

---

## 4 · Verificación

Todo contra la API viva, con la imagen de Docker reconstruida en cada tanda.

**El ciclo completo del recorrido, de punta a punta:**

1. Reservar un cupo real → `hold` → **confirmar (201)**
2. La reserva devuelve su `appointmentId` — la tabla que antes nadie escribía
3. Check-in de encuentro **atado a esa cita** (201)
4. El encuentro **se lee de vuelta** en el expediente, con su motivo
5. Cerrar el encuentro (200) · cerrarlo dos veces → **422 `PRECONDITION_FAILED`**, el código que la
   pantalla traduce a «recargá»

**En la base de datos**, donde antes había ceros:

```
citas clínicas: 1 · reservas enlazadas: 1 · encuentros atados a una cita: 1
```

**Los demás cierres:**

- **P6** → 201 con `activationToken`, su caducidad y `verificationStatus: PENDING`. Sin contraseña.
- **P9** → el listado devuelve eventos con el `id` que `reverse` exige.
- **P12** → `hpid` igual al perfil que devolvió el registro, ausente en la cuenta de bootstrap, y
  **sobrevive al refresco**. El cruce sobre los 15 recursos reales elige el del profesional y no el
  primero de la lista.
- Los conceptos del encuentro resuelven a texto: **ningún uuid llega a pantalla**.

**Cadenas completas:** frontend `lint` · `typecheck` · `test` (1639) · `build`. API `typecheck` ·
`lint --max-warnings=0` · `test` (4524) · `docs:openapi:lint` (0 errores) · `docs:coverage` ·
`docs:links` (651 enlaces, 0 rotos).

---

## 5 · Los cabos sueltos, cerrados

Los tres que habían quedado anotados como «por decidir» se cerraron.

### 5.1 · Los selectores de catálogo ya existen · **IT3**

`SystemContextClient` sobre `GET /system-context/dynamic-enums?target=…`, y
`app-concept-select` como molécula reutilizable. El alta de paciente **ya ofrece género
administrativo y sexo al nacer**, poblados desde el catálogo.

Tres decisiones que las pruebas fijan:

- **Se memoiza por target, y es parte del contrato**: los uuid son UUIDv5 deterministas y la
  respuesta trae `cacheToken`. Dos selectores en una pantalla no pueden costar dos viajes.
- **Un fallo no se memoiza.** Un corte de red no puede dejar un campo marcado como «sin opciones»
  por el resto de la sesión.
- **Sin catálogo el campo se deshabilita y lo dice** — no se cae a texto libre: un `*_concept_id`
  tecleado a mano es un dato inválido, o peor, un uuid de otro conjunto que el backend acepta.

Las etiquetas del catálogo vienen en inglés técnico («Administrative gender female»), así que se
traducen por **código** (`GENDER_FEMALE`), que es la identidad semántica estable — el mismo criterio
que `case-status.ts` ya usaba para los estados de un trámite.

### 5.2 · `resourceRefType`: un solo nombre, normalizado al escribir

Se comparó el contrato con los datos y **eran dos nombres para la misma tabla**. Ahora la API
normaliza al crear el recurso: lo que entra queda canónico y ningún consumidor nuevo hereda la
ambigüedad. Las 15 filas de la base de desarrollo quedaron normalizadas; la tolerancia en lectura se
mantiene para lo anterior.

### 5.3 · El tipo de organización **no** se migró, y es la decisión correcta

Se comparó `directory.tenants.tenant_type_concept_id` con la lista de `CreateTenantDto`: **los diez
códigos coinciden en los dos sentidos**. Aun así se mantiene la lista literal, porque no es un
parche: alimenta `TERRITORIAL_TENANT_TYPES`, la regla que decide si país y jurisdicción son
obligatorios. Con `TenantTypeCode` el compilador garantiza que las dos hablan de lo mismo; con
códigos traídos de la red, un valor nuevo entraría al desplegable y saldría de la regla **en
silencio**. Además el endpoint recibe el código, no el concept id: la lectura no ahorraría nada.

Se documentó la comparación en vez de hacer el cambio.

### 5.4 · Datos de prueba

El recurso de comprobación se borró. Las dos cuentas **no**: 131 claves foráneas apuntan a
`iam.users` y la auditoría es append-only — el sistema está diseñado para que una cuenta no se borre
nunca, y forzarlo habría roto justo lo que esa auditoría protege. Quedaron **bloqueadas, sin
membresía y renombradas `[PRUEBA] …`**, que es el camino que el modelo sí contempla.

---

## 6 · Lo que sigue abierto, y no depende de este trabajo

- **País y jurisdicción del alta de organización** no tienen binding en `dynamic-enums` (404,
  comprobado): hasta que lo tengan, su buscador no se puede acotar al value set.
- **`delegated_access` y `auth_providers`** siguen sin lecturas de colección. No bloquean la demo.
- **La ventana por defecto de la agenda** sigue en 7 días, que ya incluye hoy y tiene preset «Hoy».
  No se cambió por rol: un default distinto por persona hace que la misma pantalla se comporte de dos
  maneras. Si se prefiere que arranque en «Hoy», es una línea.
