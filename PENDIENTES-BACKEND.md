# Lo que el frontend espera del backend

**Actualizado:** 2026-08-01 · Contrastado contra la cola de Pablo (`TAREAS-PABLO.md`, P0–P6) y
verificado ejecutando sobre `mantra-core-health-redesa-api` en `dev` (`69526ce`).

Existe para no reconstruir de memoria qué falta. Lo resuelto queda anotado igual: saber que algo
dejó de ser un problema es tan útil como saber que lo sigue siendo.

---

## Resuelto — ya no bloquea

**El esquema de la base.** Era el bloqueo más grande del proyecto: `docker compose up` sobre
volúmenes vacíos dejaba Postgres corriendo **sin las 1 178 tablas del modelo**. El commit `41206d2`
versionó el DDL: `apply_all.sql` + 350 archivos SQL + 23 de NoSQL.

**`dev` volvió a compilar.** Tres commits habían entrado con archivos nuevos sin `git add`
—`register-organization.dto.ts`, `directory.concepts.ts` y el `.swcrc`—. Verificado hoy:
**`yarn typecheck` da 0 errores y `yarn build` genera el `dist/` completo.**

**El compose ya pasa `ORM_SCHEMA_SYNC`** a los contenedores con default `dry-run`. Antes la API
dockerizada arrancaba en `safe` y aplicaba DDL por su cuenta.

**Auto-registro de profesionales y de organización**, que el diseño del login ofrecía sin endpoint
detrás. Y el **tipo de tenant obligatorio con campos por tipo**, con la validación cruzada que
rechaza el bloque que no corresponde — justo lo que hace falta para un formulario condicional.

---

# Lo que falta, por tarea de su cola

## P2 · Catálogo de formas reales de error — **lo único que bloquea**

Sin entregar. Es lo que impide escribir el interceptor de errores del frontend (tarjeta 17), que
traduce las respuestas de la API a los nueve estados de UX del M34.

Su propia tarea ya enumera los nueve casos a capturar, así que no hace falta decidir nada: 400 por
campo no declarado, 400 por validación, 401 por contraseña incorrecta, 401 por token ausente, 403
por rol insuficiente, **403 del `VerifiedIdentityGuard`**, 404, 409 por email duplicado y 429 por
throttle.

El sexto es el que más importa, y su propia tarea lo marca en mayúsculas: **los dos 403 son estados
distintos para la persona**. Uno es un muro y el otro es una puerta —«verificá tu identidad», con
ruta al flujo de verificación—. Para distinguirlos hace falta saber **qué campo exacto** los separa
en el cuerpo de la respuesta.

No se puede adelantar sin inventar contratos, que es lo que el proyecto prohíbe. Es capturar, no
programar.

## P3 · Endpoint de lectura de value sets (tarjeta 6) — **no está el que se pidió**

La tarea pedía `GET /terminology/value-sets/:id/$expand`, autenticado sin rol admin y paginado por
cursor. Verificado hoy sobre el controlador: **`terminology/value-sets` sigue teniendo sólo un
`@Post()`**. Ese GET no existe.

Lo que sí llegó es otra cosa: **`GET /terminology/concepts`**, una búsqueda de conceptos que
devuelve `conceptId`, `code`, `display`, `definition`, `selectable` y `codeSystemVersionId`, con
`count` y `limit`.

Puede que alcance para llenar un `<select>`, pero **no es lo mismo** y hay dos diferencias que
importan: pagina por `limit`/`count` y no por cursor —el contrato del M30 pide cursor con desempate
determinista—, y no está claro cómo se acota a **un value set concreto**, que es lo que un campo de
formulario necesita.

**Con una línea de confirmación alcanza:** ¿el frontend debe usar `GET /terminology/concepts`, o
falta todavía el `$expand` por value set? Según la respuesta se escribe el cliente que hoy está
como carpeta con README (`core/data-access/terminology/`).

## P1 · Bootstrap del primer `SECURITY_ADMIN` (tarjeta 5) — funciona, pero no es lo que se pidió

**Lo entregado funciona**: `yarn postman:bootstrap` (`tools/postman/bootstrap-admin.mjs`) siembra el
primer administrador, es idempotente y reutiliza `IamUsersService.createUser`, así que la credencial
se hashea con argon2id igual que por API. Requiere `yarn build` antes, porque importa desde `dist/`.

Pero la tarea pedía otra forma, y las diferencias tienen consecuencias:

| Se pidió | Se entregó |
| --- | --- |
| `BootstrapAdminSeedService` en `src/common/seed/`, con `OnApplicationBootstrap` | Script suelto en `tools/postman/` |
| Activado por `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Verificado: **no están en `.env.example`** |
| Negarse en `NODE_ENV=production` salvo flag explícito | Sin verificar |

Un script explícito puede ser incluso mejor que un seed que corre solo en cada arranque —se sabe
cuándo pasa—, así que **no es un reclamo**: es que la tarjeta 5 no debería darse por cerrada sin
decidir si esta forma reemplaza a la pedida, y sin dejar las variables documentadas para el resto
del equipo.

**Y falta el handoff:** la tarea decía «al cerrar, generá un token provisional y pasáselo a Justin
por el canal — lo necesita para su interceptor (J3)». Ese token **nunca llegó**. J3 se terminó igual
—se verificó entero con `HttpTestingController`—, pero la pasada real contra el stack sigue
pendiente por eso.

## P4 · Propuesta de layout de repos (tarjeta 1) — se ejecutó en vez de proponerse

La tarea decía, textual: *«tu parte es preparar la propuesta»*, y su regla dura número 1 era **no
tocar los mounts del compose ni el layout de `database/`** porque era una decisión con Marcelo.

Lo que pasó es que el commit `41206d2` **versionó el DDL dentro del repo de la API**, que es
ejecutar la opción (b) de las tres que había que proponer.

El resultado es bueno y desbloqueó el proyecto entero, así que esto **no es un reproche**. Pero
conviene que quede dicho, porque la decisión era de Marcelo y ahora está tomada de hecho: si el
`SQL/` canónico del workspace cambia, hay que acordar cómo se sincroniza esa copia, que era
justamente el riesgo que la opción (b) tenía anotado.

## P5 · Revisión de los PRs del frontend — permanente, todavía sin arrancar

Pablo es el único par de ojos activo del frontend. Hay trabajo publicado esperando revisión.

## P6 · Orquestación del alta administrativa — opcional, no urgente

Sólo si su cola se vacía, y es **propuesta escrita**, no implementación.

---

## Además, fuera de su cola: recuperación de contraseña

No existe. Verificado sobre el módulo `iam` completo: **cero coincidencias** de `forgot`, `reset` o
`recover`; el controlador de autenticación expone nueve rutas y ninguna es de recuperación.

Importa porque **los diseños sí la tienen**: las tres variantes de login llevan «¿Olvidó su clave?»
y hay tres pantallas completas en la carpeta de diseño. Si se maqueta el login tal cual, queda un
enlace que no lleva a ningún lado.

No es decisión del frontend. Hay tres caminos: implementarla, sacar el enlace de la maqueta, o
dejarlo apuntando a un aviso del tipo «contactá a tu administrador».

---

## Una nota sobre los `git add`

Dicho con respeto y por una sola razón práctica: **tres commits** entraron a `dev` con archivos
nuevos sin agregar. Los tres se corrigieron rápido, pero mientras tanto `dev` no compilaba para
nadie.

Son archivos **nuevos**: si no se hace `git add` explícito quedan sin rastrear, y ni `git status` ni
el push avisan. La red que lo caza tarda veinte segundos y ya está en sus propias herramientas:

```bash
corepack yarn typecheck    # antes de abrir el PR
```
