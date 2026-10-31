# ADR-0019: «Mi equipo» es el duodécimo renglón del doctor, y el personal de apoyo se distingue por clase de cuenta y vínculo, no por un rol global

## Estado

**Aceptado** — 2026-10-30, a confirmar por el propietario en el PR (la mitad de esta decisión es de
producto: la lista cerrada del menú del doctor).
Extiende [ADR-0006](ADR-0006-sesion-en-memoria.md) (qué viaja en el token) y no reemplaza ninguna
decisión sobre la lista cerrada del menú del doctor: la cita y la prueba que la fija
(`navigation.service.spec.ts`, «el menú del médico son las opciones del cliente…»).

## Contexto

El diseño de «personal de apoyo» (secretaria, recepción, caja, call center…) agrega tres lados a
la aplicación: la organización que administra a su gente, la persona de apoyo que trabaja por
objetivos, y el doctor que acepta a cada persona una vez y decide si responde en su nombre.

Dos restricciones chocan con eso:

1. **El menú del doctor es una lista cerrada** (§4.H del plan de UX del 22/08/2026). Está fijada por
   una prueba que falla si alguien agrega la siguiente entrada. Antes de este cambio tenía once
   renglones (el último agregado, «Grupos médicos», el 25/10/2026, también «a confirmar por el
   propietario»).
2. **Ningún rol distingue al personal de apoyo.** El token de una persona de apoyo trae `USER`,
   igual que el de cualquier cuenta; el del hospital como cuenta también trae `USER`. Un rol
   global «SECRETARIA» no sirve: la misma persona puede ser secretaria en un hospital y no ser
   nada en otro, o ayudar en dos organizaciones con permisos distintos en cada una. Lo que
   hace a alguien «personal de apoyo» es **un vínculo con una organización**, con plantilla,
   permisos por objetivo y vigencia (`delegated_access.organization_user_assignments`).

## Fuerzas y restricciones

- «Ocultar un control no es seguridad» (`CLAUDE.md`): lo que el menú muestre es presentación; la
  API autoriza cada petición con `SupportAccessPolicy`. Pero un menú que ofrece puertas cerradas
  es ruido, y uno que no ofrece la puerta real deja la función invisible.
- El doctor es quien tiene que **aceptar a cada persona una vez**: si esa puerta no está a la vista,
  los permisos que la organización otorga sobre su agenda no rigen nunca (un permiso que nombra a
  un doctor no rige hasta que él acepta).
- `accountKind` (`PERSON` | `ORGANIZATION`) ya lo declara el token y ya separa, para la API, al
  hospital como cuenta de su personal. No es un permiso: la API no lo usa para autorizar.
- El registro de secciones está congelado por `scripts/check-max-lines.mjs`; lo nuevo no puede
  engordarlo.

## Opciones consideradas

1. **No agregar renglón al doctor**; ofrecer «Mi equipo» dentro de «Atención» como sub-pantalla de
   otra entrada. Mantiene el número, pero esconde la única puerta para aceptar a alguien.
2. **Agregar «Mi equipo» como duodécimo renglón** (esta decisión).
3. **Un rol global `SUPPORT_STAFF`/`SECRETARY`** para distinguir al personal de apoyo. Rechazada:
   confunde persona con vínculo y obligaría a la API a emitir un rol por cada organización.
4. **Distinguir por tipo de organización.** Rechazada: el hospital y su secretaria comparten tipo.

## Decisión

### 1. «Mi equipo» es el duodécimo renglón del doctor

- Entra a la lista cerrada del doctor **un solo renglón**: «Mi equipo» (`my-team`, `roles:
  ['PRACTITIONER']`). La lista pasa de once a doce y la prueba lo dice.
- **Nada más entra.** «Actividad de mi equipo» no es una entrada de menú: es una pantalla hija de
  «Mi equipo» (`/my-team/activity`), a la que se llega desde esa pantalla. Mismo criterio para
  «Mi actividad» de la persona de apoyo (`/my-support/activity`, hija de «Mis accesos»). Así el
  menú crece uno y no tres.
- La revisión **de producto** que falta es del propietario: si prefiere no crecer la lista, la
  alternativa es la opción 1, que cuesta que el doctor tenga que encontrar la puerta por otro
  camino. La decisión técnica no cambia.

### 2. El personal de apoyo no es un rol: es una clase de cuenta más un vínculo

| Quién | Cómo se distingue | Dónde se ve |
|---|---|---|
| El hospital como **cuenta** | `accountKind: 'ORGANIZATION'` y el rol `SECURITY_ADMIN` (lo que la API exige en `/org/*`) | `AppSection.onlyForAccountKind: 'ORGANIZATION'` y `roles: ['SECURITY_ADMIN']` |
| La **persona de apoyo** | `accountKind: 'PERSON'` y rol `USER`; lo que puede hacer **no está en el token**: sale de sus vínculos | `onlyForAccountKind: 'PERSON'`, `roles: ['USER']`, `onlyForTenantTypes` de organizaciones médicas |
| El **doctor** | rol `PRACTITIONER` | `roles: ['PRACTITIONER']` |
| Lo que cada persona de apoyo puede hacer | las filas `support_scope_grants` de **su vínculo** con **esa** organización, resueltas por la API | `allowedActions` y `denialReason` de cada respuesta; el front solo los pinta |

- `onlyForAccountKind` y `hiddenForAccountKind` (en `navigation.types.ts`) se preguntan **primero y sin
  excepciones**: ni `SUPERADMIN` ni un acceso global cambian de qué clase de cuenta es una sesión.
- Una persona con `SECURITY_ADMIN` que es una **persona** (`PERSON`) no ve las pantallas de la
  organización, y la cuenta de la organización sin `SECURITY_ADMIN` tampoco: la clase de cuenta no es
  un permiso y el rol no es una clase de cuenta. Las dos condiciones juntas son lo que la API exige.
- Un vínculo **suspendido** (recertificación vencida) o **terminado** deja a la persona sin acceso aunque
  su token siga igual: por eso el token no sirve para decidir nada de esto.

### 3. Las secciones viven en su propio archivo

Las secciones del personal de apoyo se mudaron de `navigation.map.ts` a `navigation.support.ts` (y la
cuenta de laboratorio a `navigation.laboratory.ts`), siguiendo el patrón de `navigation.platform.ts`:
`APP_SECTIONS` las esparce en el mismo lugar, así que el orden del menú no cambia.

## Consecuencias positivas

- El doctor tiene una puerta a su equipo y el menú crece **un** renglón.
- No hay un rol por organización que la API tenga que emitir ni mantener.
- La misma persona puede ser personal de apoyo en dos organizaciones con permisos distintos.
- Las pruebas del mapa fijan **quién ve qué**, incluido que ni un `SECURITY_ADMIN` persona ni el comodín
  `SUPERADMIN` abren las pantallas de la organización.

## Consecuencias negativas

- La lista cerrada del doctor crece (once → doce); la prueba tuvo que cambiar y eso es un cambio de
  producto que alguien debe aprobar.
- Para saber qué puede hacer una persona de apoyo hay que preguntarle a la API: no se puede inferir
  del token, y una pantalla que quiera mostrarlo sin red no tiene de dónde sacarlo.
- `accountKind` es un claim **propuesto** para hospitales y clínicas (hoy solo lo emiten las cuentas de
  farmacia, laboratorio y aseguradora); hasta que la API lo emita detrás de `org_account_mode`, un
  hospital se ve como persona.

## Riesgos

- Que alguien lea `onlyForAccountKind` como autorización. No lo es: ocultar una sección no cierra una
  puerta. Está dicho en su comentario y en `CLAUDE.md`.
- Que se agregue «Actividad» o «Revisión» como renglones del doctor «porque son parecidos»: la prueba del
  menú del médico lo detecta.

## Evidencia

- `src/app/core/navigation/navigation.support.ts`, `navigation.types.ts` (`onlyForAccountKind`).
- `src/app/core/navigation/navigation.service.spec.ts`: «el menú del médico son las opciones del cliente…».
- `src/app/core/navigation/navigation.map.spec.ts`: «secciones del personal de apoyo».
- `src/app/core/auth/session.store.ts` (`isOrganizationAccount`) y `access-token.ts` (`accountKind`).
- Controladores de la API: `@Roles('SECURITY_ADMIN')` en `support-engagements.controller.ts`.

## Plan de revisión

Revisar cuando la API emita `accountKind` para hospitales y clínicas, o si el propietario decide no
crecer la lista del doctor (volver a la opción 1).
