# CARRIL 05 — Perfil del doctor · reporte (frontend)

**Base:** `origin/dev` @ `b60957c` (Merge PR #108 — fix/alovida-c09-patient_medical_record)
**Integrado en:** `dev` @ `bdc138c` — **PR #117**, branch
`pablo/perfil-profesional-y-bloques-de-ayuda` (commit `d2b5146`, «feat(perfil):
vista de perfil profesional y bloques de ayuda por pestaña»).
**Fecha:** 15/08/2026

> El trabajo se desarrolló sobre `fix/alovida-c05-doctor_profile` y el titular
> del repo lo llevó a `dev` por esa PR mientras el carril seguía en curso — por
> eso la branch del carril no existe ya en el remoto. **La parte de frontend está
> integrada y verificada en `dev`.**

---

## 1. Punto de partida

El usuario fue explícito: «Mi perfil» **estaba mal, no funcionaba bien**. No se
buscó envolver lo existente en tres pestañas, sino arreglar lo que faltaba de
fondo.

Ya existía —y se **reutilizó**, no se duplicó— una base sólida del carril R2-4:
`practitioner-profile-view` es presentacional pura y es **el mismo componente**
con el que la Guía de profesionales pinta el perfil de otro doctor. Sobre eso se
construyó.

---

## 2. Qué se hizo

### Las 3 pestañas superiores (`practitioner-profile-view`)

- **Cabecera, fuera de las pestañas** — foto, nombre, descripción profesional,
  cargo y **especialidades consolidadas como tags**. La «Presentación» dejó de
  ser un bloque aparte y subió a la cabecera, que es donde el carril la pide.
- **1· Trayectoria** — línea de tiempo vertical **por fases**: Actividad actual
  (primero, es lo relevante hoy), Experiencia histórica y Formación. Cada fase
  con su propio texto de vacío. Debajo, el formulario de alta.
- **2· Credenciales y verificaciones** — agrupación explícita **Verificado vs
  Declarado**, derivada de `verificationSourceUri` / sellos ya existentes (sin
  inventar campos), más las sub-pestañas de Especialidades y Matrículas que ya
  estaban.
- **3· Vista previa del perfil público** — **el mismo componente reinstanciado**
  con `esPropio=false` y `previewMode=true`, alimentado por el mismo `perfil()`
  ya cargado. No es una maqueta: es literalmente el dibujo que ve el paciente, y
  por construcción **no puede divergir**. `previewMode` corta la recursión y
  suprime toda acción de escritura.

### Ayuda y tutorial por pestaña (corrección #6)

Nuevo `app-tab-help-block` (`shared/components/molecules/tab-help-block/`):
explicación + ejemplo concreto proyectados + botón «Ver tutorial», **cerrable y
recordado por cuenta**. Compone el `<app-alert dismissible>` que ya existía con
un store nuevo (`core/tutorials/help-block-dismissal.store.ts`) que copia el
patrón de persistencia de `tutorial-progress.store.ts` (por cuenta, degradado a
memoria si `localStorage` falla, no-op bajo SSR).

El tutorial `PERFIL_PROFESIONAL` se **extendió** (no se duplicó) a las 3
pestañas y subió a **versión mayor 2.0**: el recorrido cambió de verdad, así que
quien ya lo completó lo vuelve a ver — que es la regla que el propio store
define.

### Dos defectos preexistentes corregidos de paso

1. **El botón «Ver mi perfil público» llevaba al lugar equivocado**: apuntaba a
   `/my-account/preview`, que es la *vitrina comunitaria* del carril 16 — otra
   funcionalidad, con otro contrato y otra fuente de datos. Ahora selecciona la
   pestaña Preview real. La vitrina no se tocó.
2. **`practitioner-profile-view` nunca importaba `TutorialTarget`**: los cuatro
   `appTutorialTarget` de la pantalla estaban **inertes** y el tutorial no podía
   encontrar sus objetivos. Se agregó la directiva a `imports`.

### Historial laboral

`work-history` no se borró ni se duplicó: se le agregó
`layout: input<'flat'|'timeline'>` para que, embebido en la pestaña Trayectoria,
suprima su listado plano (ya está la línea de tiempo arriba) y aporte sólo el
formulario, más un output `added` para que el contenedor recargue. Se quitó su
montaje redundante al pie de `my-profile.html`.

---

## 3. Archivos

**Nuevos**
- `shared/components/molecules/tab-help-block/{tab-help-block.ts,.html,.css,.spec.ts}`
- `core/tutorials/help-block-dismissal.store.ts` (+ `.spec.ts`)

**Modificados**
- `core/data-access/profiles/profiles.types.ts` — `affiliations`, `verificationSourceUri`
- `core/data-access/profiles/profiles.client.ts` (+ `.spec.ts`) — reutiliza `toAffiliation`
- `.../practitioner-profile-view.{ts,html,css,types.ts,spec.ts}` — las 3 pestañas
- `.../practitioner-profile.{ts,html,spec.ts}` — `afiliacionesDe()`, recarga
- `features/directory/practitioner-detail.{ts,spec.ts}` — mismo `afiliacionesDe()`
- `.../work-history.{ts,html,spec.ts}` — `layout`, `added`
- `features/account/my-profile/{my-profile.ts,my-profile.html}`
- `core/tutorials/definitions/index.ts` — `PERFIL_PROFESIONAL` v2.0
- `.../practitioner-profile-edit.spec.ts` — fixture

`afiliacionesDe()` se duplica a propósito en el contenedor propio y en el detalle
de la guía, siguiendo el criterio ya documentado en `practitioner-detail.ts` para
las otras cuatro conversiones.

---

## 4. Pruebas

| Comando | Resultado |
| --- | --- |
| `yarn typecheck` | ✅ limpio |
| `yarn lint` | 1 error **preexistente** en `features/dashboard/dashboard.ts` (`TutorialTarget` sin usar) — verificado: está igual en `dev`, fuera del diff de este carril |
| `ng test` (Vitest) | ✅ **2461/2461 · 257/257 archivos** |

Cobertura nueva/actualizada: 3 pestañas y quién ve cuál, estados vacío/parcial/
completo por fase, agrupación declarado/verificado, la vista previa reinstancia
el mismo componente sin acciones de dueño y sin ofrecerse a sí misma, el botón ya
no navega a la vitrina, `layout="timeline"` suprime el listado, persistencia del
bloque de ayuda por cuenta, y `practitioner-profile` vs `practitioner-detail`
producen el **mismo** reparto de afiliaciones.

---

## 5. Evidencia funcional (API real, base sembrada)

```
me/summary  vs  :profileId/summary   (vista previa contra vista del paciente)
  mismas claves: True
  campos que difieren: NINGUNO — contrato idéntico

Trayectoria del doctor de prueba:
  ACTIVIDAD ACTUAL  → Sede Central Sopocachi | desde 2019-04-01
  EXPERIENCIA HIST. → Hospital Obrero N.º 1  | 2008-03-01 → 2013-02-28

yarn seed:dev → 545/545 conformes, 0 fuera de lo esperado
```

**Bloqueo encontrado y resuelto en el backend:** la tabla
`profiles.practitioner_affiliations` **no existía** (entidad y endpoints
shippeados sin DDL en un carril anterior), así que la pestaña Trayectoria daba
500. Ver `CARRIL_REPORT.md` del repo de API, §2 — incluye una nota de
integración porque el `.puml` y `SQL/` **no están bajo control de versiones**.

---

## 6. Deuda restante

- **Cypress e2e no se ejecutó**: la evidencia de que la vista previa coincide con
  la del paciente se obtuvo a nivel de contrato (API) y de unidad. Un spec e2e
  que compare ambas pantallas renderizadas queda pendiente.
- `fileId` de credenciales sigue sin exponerse: la pestaña muestra la fuente de
  verificación (decisión acordada); ver el archivo exige definir el acceso de un
  paciente a un documento del doctor.
- Sin tabla de reconocimientos/publicaciones en el modelo, esa sección se omite
  — el carril lo condiciona a «si el modelo ya lo contempla».

## 7. Estado

**Frontend: integrado en `dev`** vía PR #117 (`dev` @ `bdc138c`). Verificado
después del merge: los 6 archivos nuevos, la estructura de 3 pestañas y el campo
`affiliations` están presentes en `dev`.

**Backend: pendiente de merge.** Vive en `fix/alovida-c05-doctor_profile` del
repo de API (commit `c2d0f365`) e incluye el DDL que hace que la pestaña
Trayectoria funcione contra datos reales. Hasta que se integre, la pestaña
Trayectoria en `dev` **no tiene backend que la sirva**: el `affiliations` del
summary y la tabla `practitioner_affiliations` viajan en esa branch.
