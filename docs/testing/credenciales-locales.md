# Credenciales del entorno local

Qué cuentas existen en `mantra_redesa_health` después de sembrar, cuáles sirven
para entrar y cuáles no. Verificado contra la base el **2026-08-10**.

> **Solo desarrollo local.** Todo lo de acá apunta a `localhost` y a una base que
> se reconstruye con `python salud-db/rebuild_stack.py --yes`. Estos valores ya
> viven en el repositorio —`.env.example` de la API, `tools/postman/`, la suite
> de Cypress— y no abren nada fuera de esta máquina. No los reutilices en ningún
> entorno que no sea el tuyo.

## Lo primero, porque sorprende

De las **25 filas** de `iam.authentication_credentials`, **solo 9 pueden
autenticar**. Las otras 16 son datos de vitrina que *parecen* credenciales y no
lo son. El detalle está abajo, en «Las que no sirven».

## La cuenta que vas a usar

| Campo | Valor |
| --- | --- |
| Correo | `admin@redesa.test` |
| Contraseña | `S3cret-passw0rd` |
| Rol global | `SUPERADMIN` |
| Tenant | `1befcfea-44c0-563a-81cd-337ec6acc840` |
| Nombre | Administrador de arranque |

Es la única cuenta **estable y reproducible**: las demás se generan por corrida.
Con ella entrás a todo — `SUPERADMIN` es comodín en el `RolesGuard` del backend
y es el único rol que puede declarar `X-Tenant-Id` de cualquier tenant.

### No viene con la base: hay que sembrarla

`BootstrapAdminSeedService` es **opt-in**. Sin `BOOTSTRAP_ADMIN_EMAIL` y
`BOOTSTRAP_ADMIN_PASSWORD` en el entorno no hace nada, así que en una base recién
levantada la cuenta **no existe** y el login responde `401`. Ese `401` se lee
como «escribiste mal la contraseña» cuando en realidad no hay ninguna cuenta que
contrastar.

Se siembra con el comando del propio backend, que es idempotente y reutiliza el
mismo servicio que el arranque:

```bash
cd mantra-core-health-api
yarn build && yarn postman:bootstrap
```

> `yarn build` reescribe el `dist/` que `yarn start:dev` esté usando y le tira el
> proceso abajo con `MODULE_NOT_FOUND`. Sembrá primero, levantá la API después.

La alternativa permanente es descomentar las dos variables en el `.env` de la
API (están en su `.env.example`, líneas 180-181): con eso el seed corre en cada
arranque.

## Las cuentas que crea la suite de extremo a extremo

`yarn recorrido:real` **da de alta actores de verdad** contra la API viva, uno de
cada tipo por corrida. Todas con la misma contraseña, `S3cret-passw0rd`:

| Actor | Identificador | Entra con | Estado inicial |
| --- | --- | --- | --- |
| Paciente | `CI-E2E-<sufijo>` | **documento**, no correo | Identidad sin verificar |
| Médico | `medico-<sufijo>@example.test` | correo | Licencia `PENDING` |
| Owner de organización | `owner-<sufijo>@example.test` | correo | Tenant propio y vacío |

El sufijo sale del identificador de la corrida, así que **cada ejecución crea
tres cuentas nuevas** y la base las acumula. Es el costo documentado de esa
suite, el mismo que pagan los smokes del backend, y lo que evita el `409` de «ese
documento ya está registrado» entre corridas.

Para saber cuáles hay ahora mismo:

```sql
select c.external_subject, u.display_name, c.created_at
from iam.authentication_credentials c
join iam.users u on u.id = c.user_id
where c.secret_hash like '$argon2%'
order by c.created_at desc;
```

El paciente es el único que entra **con documento**: la pantalla de ingreso
resuelve correo o documento por la ausencia de la arroba, y ese camino no lo
recorre ninguna otra prueba.

## Las que no sirven, y por qué

Las 16 filas cuyo `external_subject` se parece a `IAM-AUTHENTICATI-000001 (caso
08)` **no son credenciales**: son datos de vitrina de `salud-db/gen_seeds.py`.

Su `secret_hash` es un SHA-256 del **nombre de la columna**, no de ninguna
contraseña — `gen_seeds.py:617` rellena así cualquier columna que tenga `hash` en
el nombre:

```python
if "hash" in col:
    return hashlib.sha256(f"{table}|{col}|{seed}".encode()).hexdigest()
```

O sea: no hay ningún texto que produzca ese hash, y aunque lo hubiera, la API
verifica con **argon2id** y ese valor no tiene el formato `$argon2id$v=…`. Son
filas para que las pantallas tengan qué mostrar y para que las FK cierren, no
cuentas.

Se distinguen de un vistazo por el prefijo del hash:

| Origen | `secret_hash` | ¿Entra? |
| --- | --- | --- |
| API (`IamUsersService.createUser`) | `$argon2id$v=19$m=…` | Sí |
| `gen_seeds.py` | 64 caracteres hexadecimales | No |

Los nombres que ves ahí —Ana Lucía Flores, Mateo Quiroga Ríos, Diego Salvatierra
Paz— son personas inventadas del paquete de seeds. Aparecen en listados y fichas,
pero **nadie puede iniciar sesión como ellas**.

## Dónde las lee cada herramienta

| Herramienta | Variables | Valor por defecto |
| --- | --- | --- |
| Seed de arranque de la API | `BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD` | ninguno (no siembra) |
| `yarn postman:bootstrap` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@redesa.test` / `S3cret-passw0rd` |
| `tools/alovida/exercise-front-flows.mjs` | `BOOTSTRAP_ADMIN_*` | los mismos |
| `yarn recorrido:real` (Cypress) | `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | los mismos |

Los cuatro coinciden a propósito. Si cambiás la contraseña del admin, cambiala en
el `.env` de la API y exportá `E2E_ADMIN_*` para la suite; el resto la toma de
ahí.

## Lo que no hace falta configurar

La suite **funcional** de Cypress (`yarn test:e2e`) no usa ninguna de estas
cuentas: su API está simulada por el arnés y acepta cualquier credencial — quien
decide si el login entra es el escenario, no la contraseña. Las variables
`E2E_TEST_USER_*` existen solo para apuntar la suite a un entorno de ensayo real.
