# CARRIL 14 — Administrador de aseguradora + brokers

**Fuente funcional:** `SPEC_FUNCIONAL_COMPLETA_5738_LINEAS.md`, líneas 1766–2578.
El duplicado exacto (3211–4023) **no** se implementó por segunda vez — C-003 del
registro de conflictos.

**Branches**

| Repo | Branch | HEAD |
| --- | --- | --- |
| `mantra-core-health-api` | `fix/alovida-c14-insurance_org_broker` | `e97197ec` |
| `mantra-core-health` | `fix/alovida-c14-insurance_org_broker` | `0947d7a` |

Base en ambos: `origin/dev` (`51895db8` en la API, `42599eb` en el frontend).

---

## Lo que se encontró antes de tocar nada

Tres hallazgos cambiaron el plan del carril, y conviene dejarlos escritos porque
explican por qué el resultado no es «23 secciones de spec implementadas de cero».

### 1. El esquema de `insurance` ya está completo y **no se puede ampliar a mano**

`src/orm/catalog/` se genera desde el modelo canónico (`yarn orm:catalog`) y las
entidades se obtienen por introspección de la base; el README de la carpeta lo
dice explícitamente: «no se editan a mano».

Las 29 tablas que el catálogo declara para el schema `insurance` están mapeadas
1:1 con entidades — se verificó comparando los `tableName` de
`entities/*.entity.ts` contra los índices de `orm/catalog/indexes/insurance.*`.
No falta ninguna, y **no se inventó ninguna**.

### 2. El módulo 26 tenía **sólo escrituras**

Los siete controladores del módulo exponían 23 endpoints y **ni un solo `GET`**.
Se daban de alta aseguradoras, productos, planes, beneficios, redes, brokers y
acuerdos, y no había forma de volver a leer nada. Ése era el bloqueo real: sin
lecturas, cualquier pantalla de aseguradora sólo podía existir inventándose los
datos, que es justo lo que el carril prohíbe.

### 3. Buena parte del alcance del carril ya vive en otros módulos

No se duplicó nada de esto:

| Sección de la spec | Dónde ya está |
| --- | --- |
| Organización aseguradora, sedes, personal, roles | `directory` (tenants/branches/memberships) + `authz` |
| Alta de la aseguradora | `directory` la materializa al aprovisionar un tenant `PAYER` (`TenantTypeProfileService.materializeProfile`) |
| Documentación legal | `document_store` |
| Red social, publicaciones, comentarios | `community` |
| Encuestas | `surveys` / `forms` |
| Contabilidad | `accounting` |
| Notificaciones | `messaging` |
| Auditoría | `audit` |

---

## Lo que se implementó

### Backend — `e97197ec`

La cara de lectura que faltaba, sobre el esquema existente.

| Endpoint | Qué devuelve |
| --- | --- |
| `GET /insurance-carriers` | Aseguradoras del tenant activo con recuento de productos, planes y redes |
| `GET /insurance-carriers/:id` | Catálogo producto → plan → beneficio y redes con su recuento de prestadores |
| `GET /insurance-brokers` | Corredores con su situación de vinculación vigente |
| `GET /insurance-brokers/:id` | Perfil con el **histórico completo** de vinculaciones |
| `GET /insurance-brokers/:id/clients` | Cartera comercial |

Archivos: `dto/read.dto.ts`, `repositories/read.repository.ts`,
`services/insurance-read.service.ts`, `controllers/insurance-read.controller.ts`,
más los cuatro barriles, el módulo y los README de índice.

### Frontend — `0947d7a`

- `core/data-access/insurance/` — cliente y tipos de vista.
- `features/insurance/insurance-catalog/` — sección «Aseguradora».
- `features/insurance/broker-directory/` — sección «Brokers».
- `features/insurance/broker-detail/` — ficha del corredor.
- Registro en `navigation.map.ts` y `app.routes.ts`.

---

## Decisiones que el carril exige justificar

### Mínimo privilegio: la cartera del broker no tiene por dónde filtrar historia clínica

La spec (líneas 2285–2288) prohíbe que el broker acceda al historial médico del
paciente. No se resolvió escondiéndolo en la interfaz: `GET
/insurance-brokers/:id/clients` sirve la relación comercial y una referencia al
`patient_profile_id`, y **no hay ningún join clínico en la consulta**. Una prueba
fija la forma exacta de la respuesta, de modo que agregar un campo clínico rompe
el test antes de llegar a producción.

### La vigencia de un acuerdo la decide el servidor

`independent` y `current` se derivan de los acuerdos vigentes **en la fecha de la
consulta**, no de un campo declarativo. Un acuerdo en estado activo cuyo
`effective_to` ya pasó **no** cuenta como vigente: es exactamente lo que la spec
prohíbe (líneas 1881, «evitar que un broker independiente se presente como
representante de una organización sin una vinculación vigente»).

La pantalla tampoco lo recalcula: si lo hiciera, dos clientes con relojes
distintos podrían discrepar sobre si alguien representa a una aseguradora.

### Aislamiento por tenant, y 404 en vez de 403

Las lecturas **no exigen rol global**, igual que las rutas de organización de
`directory`: quien administra una aseguradora no es un administrador de
plataforma. El alcance lo da `requireTenantId()`. Un identificador de otra
organización recibe el mismo 404 que uno inexistente, para que el código de error
no sirva para sondear qué existe.

En el menú, las dos secciones se declaran con `SECURITY_ADMIN` porque **hoy es el
único rol que significa «administra esta organización»** — la plataforma no tiene
un rol de aseguradora. Está comentado en `navigation.map.ts`: el día que exista
`INSURANCE_ADMIN`, esas dos líneas son el único cambio.

### Lo declarado y lo verificado se muestran separados

La spec lo pide para el perfil del broker (línea 2131). Se aplica también a la
aseguradora: `verification` viaja siempre y sin colapsar a booleano.

### Los importes no se convierten a número

`coverage_percent`, `copay_amount`, `deductible_amount` y `annual_limit_amount`
son `numeric` en la base. Viajan como texto y se pintan como texto: convertirlos
perdería los decimales que definen una cobertura.

---

## Pruebas

| Comando | Resultado |
| --- | --- |
| `yarn typecheck` (API) | OK |
| `yarn eslint "src/modules/insurance/**/*.ts"` (API) | 0 problemas |
| `yarn test src/modules/insurance` (API) | **23 pasan**, 2 suites |
| `yarn typecheck` (frontend) | OK |
| `yarn test --include="**/insurance/**/*.spec.ts"` (frontend) | **23 pasan**, 4 suites |
| `yarn test` (frontend, suite completa) | 2389 pasan, 2 fallan — **preexistentes** |

Los 23 del backend cubren: exigencia de tenant, aislamiento (404 para otra
organización), recuento de planes atravesando el producto, armado del catálogo,
las cuatro combinaciones de vigencia de un acuerdo, la forma exacta de la cartera
y el marcador «sin registrar» para un concepto ausente. Se añadió además una
prueba que falla si alguien le pone `@Roles` a una lectura sin decidirlo.

Los 23 del frontend cubren: normalización del transporte (vigencias como fecha
local y no instante UTC — el defecto que `maybeDateOnly` existe para evitar),
conservación de los importes como texto, la carga en dos pasos del catálogo, el
vacío explicado, el histórico con su marca de vigencia, la cancelación de la
segunda lectura cuando la primera falla, y que no se imprima ningún identificador
técnico ni dato clínico.

### Los 2 fallos preexistentes

`navigation.service.spec.ts` y `shell-layout.spec.ts` esperan un menú sin
`/laboratory-directory` para una sesión sin roles. **Fallan igual en `42599eb`
(origin/dev) sin ninguno de mis cambios** — verificado ejecutándolos sobre ese
commit en un worktree limpio. Vienen del carril de laboratorios ya integrado, que
encendió la sección sin roles y no actualizó las dos listas esperadas.

---

## Deuda y alcance no cubierto

Se declara en vez de fingirse:

1. **Escrituras del catálogo.** El alta de producto/plan/beneficio/red sigue
   siendo `SECURITY_ADMIN` por el backbone existente; no hay formulario. La
   sección lo dice («se dan de alta desde la administración del catálogo») en vez
   de ofrecer un botón que no hace nada.
2. **Las dos vistas públicas del diseñador** (`redsat/buscar/aseguradoras-listado`
   y `perfil-aseguradora-detalle`) siguen siendo marcado estático. Rehidratarlas
   exige un listado **entre organizaciones**, y el repositorio prohíbe
   explícitamente marcar `@TenantAgnostic()` cualquier operación que toque una
   tabla con `tenant_id`. El camino correcto es una proyección pública de
   `read_models` con `contains_phi = false`; no existe ninguna para aseguradoras
   y crearla es trabajo de datos, no de código. **No se inventó una puerta
   pública para tapar el hueco.**
3. **Secciones de la spec que caen en otros módulos** (términos y condiciones con
   aceptación trazable, repositorio legal, atenciones e incidentes del broker,
   calificaciones, encuestas, contabilidad de la aseguradora, notificaciones).
   Tienen tabla y módulo propios; su cara de lectura y su UI corresponden a los
   carriles de esos módulos. Implementarlas acá habría sido la segunda
   implementación que el carril prohíbe.

---

## Conflicto operativo encontrado

Durante el trabajo, **otra sesión cambió de rama las dos copias de trabajo
compartidas** (`c14 → c17` en la API, `c14 → c17 → c12` en el frontend). Consta
en el `git reflog` de ambos repos. Consecuencia: los dos commits de este carril
quedaron aplicados sobre la rama de esos otros carriles.

Se corrigió la parte segura —`fix/alovida-c14-insurance_org_broker` ya apunta a
los commits correctos en ambos repos, operación puramente aditiva— pero **sacar
el commit de C14 de las ramas `c17` y `c12` exige un `git reset` sobre ramas que
otra sesión tiene activas**, y esa decisión no se tomó unilateralmente.

Ambos repos conservan además trabajo sin commitear de otros carriles
(`pharma_lab`, `surveys`, `questionnaires`, `diagnostics`, `procedures`). **No se
tocó nada de eso**, y ninguno de los dos commits de C14 lo incluye.
